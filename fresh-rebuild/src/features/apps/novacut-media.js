/*
 * NexusNova NovaCut Media Ingestion Core
 * Asynchronous media file selection, bounded binary metadata parsing,
 * and multi-clip timeline injection for native WebView containers.
 *
 * Boundaries:
 * - Browser File objects only. No filesystem paths are requested or exposed.
 * - No external packages, node runtimes, blob-parser libraries, or globals.
 * - Binary inspection is slice-based and memory bounded.
 * - DOM listeners are scoped to the supplied NovaCut root.
 */

const DEFAULT_MEDIA_OPTIONS = Object.freeze({
  probeBytes: 2 * 1024 * 1024,
  maxAtomReadBytes: 8 * 1024 * 1024,
  maxFilesPerBatch: 64,
  maxFileBytes: 4 * 1024 * 1024 * 1024,
  parseConcurrency: 2,
  mediaProbeTimeoutMs: 12000,
  imageDurationMs: 3000,
  startMode: "append",
  accept: "video/*,audio/*,image/*"
});

const MP4_CONTAINER_TYPES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "mvex",
  "udta",
  "meta",
  "ilst"
]);

const MEDIA_EXTENSIONS = Object.freeze({
  video: new Set([
    "mp4", "m4v", "mov", "mkv", "webm", "avi", "wmv", "mpeg", "mpg",
    "m2ts", "mts", "3gp", "3g2", "ogv"
  ]),
  audio: new Set([
    "mp3", "wav", "m4a", "aac", "flac", "ogg", "oga", "opus", "wma", "amr"
  ]),
  image: new Set([
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "heic", "heif"
  ])
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 0) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(finite(value), min), max);
}

function isFileLike(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.size === "number" &&
    typeof value.slice === "function" &&
    typeof value.name === "string"
  );
}

function isElement(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.closest === "function" &&
    typeof value.addEventListener === "function"
  );
}

function extensionOf(name = "") {
  return String(name).match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase() || "";
}

function kindFromFile(file) {
  const mime = String(file?.type || "").toLowerCase();

  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";

  const extension = extensionOf(file?.name || "");
  if (MEDIA_EXTENSIONS.audio.has(extension)) return "audio";
  if (MEDIA_EXTENSIONS.image.has(extension)) return "image";
  if (MEDIA_EXTENSIONS.video.has(extension)) return "video";

  return null;
}

function normalizeFileList(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.filter(isFileLike);
  }

  if (
    typeof FileList !== "undefined" &&
    input instanceof FileList
  ) {
    return Array.from(input).filter(isFileLike);
  }

  if (
    typeof DataTransferItemList !== "undefined" &&
    input instanceof DataTransferItemList
  ) {
    return Array.from(input)
      .map((item) => item?.kind === "file" ? item.getAsFile() : null)
      .filter(isFileLike);
  }

  return [];
}

function fileFingerprint(file) {
  return [
    file.name,
    finite(file.size),
    finite(file.lastModified),
    file.type || ""
  ].join("\u0001");
}

function readAscii(data, offset, length) {
  if (!(data instanceof Uint8Array)) return "";
  if (offset < 0 || offset + length > data.length) return "";

  let value = "";
  for (let index = 0; index < length; index += 1) {
    const byte = data[offset + index];
    value += byte >= 0x20 && byte <= 0x7e
      ? String.fromCharCode(byte)
      : "\u0000";
  }

  return value;
}

function readUint32(data, offset) {
  if (
    !(data instanceof DataView) ||
    offset < 0 ||
    offset + 4 > data.byteLength
  ) {
    return 0;
  }

  return data.getUint32(offset, false);
}

function readUint64Safe(data, offset) {
  if (
    !(data instanceof DataView) ||
    offset < 0 ||
    offset + 8 > data.byteLength
  ) {
    return 0;
  }

  if (typeof data.getBigUint64 === "function") {
    const value = data.getBigUint64(offset, false);
    const number = Number(value);
    return Number.isSafeInteger(number)
      ? number
      : Number.MAX_SAFE_INTEGER;
  }

  const high = readUint32(data, offset);
  const low = readUint32(data, offset + 4);
  const value = high * 0x100000000 + low;

  return Number.isSafeInteger(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function readFixed1616(data, offset) {
  if (
    !(data instanceof DataView) ||
    offset < 0 ||
    offset + 4 > data.byteLength
  ) {
    return 0;
  }

  return data.getInt32(offset, false) / 65536;
}

function readUint16LE(data, offset) {
  if (
    !(data instanceof DataView) ||
    offset < 0 ||
    offset + 2 > data.byteLength
  ) {
    return 0;
  }

  return data.getUint16(offset, true);
}

function readUint32LE(data, offset) {
  if (
    !(data instanceof DataView) ||
    offset < 0 ||
    offset + 4 > data.byteLength
  ) {
    return 0;
  }

  return data.getUint32(offset, true);
}

function readVint(data, offset, maskPayload = true) {
  if (
    !(data instanceof Uint8Array) ||
    offset < 0 ||
    offset >= data.length
  ) {
    return null;
  }

  const first = data[offset];
  if (!first) return null;

  let length = 1;
  let mask = 0x80;

  while (
    length <= 8 &&
    (first & mask) === 0
  ) {
    mask >>= 1;
    length += 1;
  }

  if (
    length > 8 ||
    offset + length > data.length
  ) {
    return null;
  }

  let value = maskPayload
    ? first & (mask - 1)
    : first;

  for (let index = 1; index < length; index += 1) {
    value = value * 256 + data[offset + index];
  }

  const unknown =
    maskPayload &&
    value === Math.pow(2, 7 * length) - 1;

  return {
    length,
    value,
    unknown
  };
}

function readEbmlId(data, offset) {
  const vint =
    readVint(
      data,
      offset,
      false
    );

  if (!vint) return null;

  let id = 0;

  for (
    let index = 0;
    index < vint.length;
    index += 1
  ) {
    id =
      id * 256 +
      data[offset + index];
  }

  return {
    id,
    length: vint.length
  };
}

function readEbmlInteger(data, start, end) {
  const length =
    Math.min(
      8,
      Math.max(
        0,
        end - start
      )
    );

  let value = 0;

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    value =
      value * 256 +
      data[start + index];
  }

  return value;
}

function readEbmlFloat(data, start, end) {
  const length = end - start;

  if (length === 4) {
    return new DataView(
      data.buffer,
      data.byteOffset + start,
      4
    ).getFloat32(0, false);
  }

  if (length === 8) {
    return new DataView(
      data.buffer,
      data.byteOffset + start,
      8
    ).getFloat64(0, false);
  }

  return NaN;
}

function makeParseError(message, cause = null) {
  const error =
    new Error(
      String(message)
    );

  if (cause) {
    error.cause = cause;
  }

  return error;
}

async function readSlice(file, start, end) {
  const safeStart =
    clamp(
      start,
      0,
      file.size
    );

  const safeEnd =
    clamp(
      end,
      safeStart,
      file.size
    );

  if (safeEnd <= safeStart) {
    return new ArrayBuffer(0);
  }

  const blob =
    file.slice(
      safeStart,
      safeEnd
    );

  if (typeof FileReader !== "undefined") {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onerror =
          () => {
            reject(
              reader.error ||
              new Error(
                "Failed to read media slice " +
                safeStart +
                "-" +
                safeEnd +
                "."
              )
            );
          };

        reader.onabort =
          () => {
            reject(
              new Error(
                "Media slice read aborted " +
                safeStart +
                "-" +
                safeEnd +
                "."
              )
            );
          };

        reader.onload =
          () => {
            if (
              !(reader.result instanceof ArrayBuffer)
            ) {
              reject(
                new Error(
                  "FileReader returned an unexpected media buffer."
                )
              );
              return;
            }

            resolve(
              reader.result
            );
          };

        reader.readAsArrayBuffer(
          blob
        );
      }
    );
  }

  if (
    typeof blob.arrayBuffer ===
    "function"
  ) {
    return blob.arrayBuffer();
  }

  throw new Error(
    "This WebView does not expose a supported binary FileReader API."
  );
}

async function mapWithConcurrency(
  items,
  limit,
  worker
) {
  const results =
    new Array(items.length);

  let cursor = 0;

  const workerCount =
    Math.max(
      1,
      Math.min(
        items.length || 1,
        Math.floor(
          positive(
            limit,
            1
          )
        )
      )
    );

  const workers =
    Array.from(
      { length: workerCount },
      async () => {
        while (true) {
          const index =
            cursor;

          cursor += 1;

          if (
            index >= items.length
          ) {
            return;
          }

          try {
            results[index] =
              await worker(
                items[index],
                index
              );
          } catch (error) {
            results[index] = {
              index,
              file: items[index],
              ok: false,
              error
            };
          }
        }
      }
    );

  await Promise.all(
    workers
  );

  return results;
}

function scanMp4Atoms(
  data,
  start,
  end,
  baseOffset,
  visitor
) {
  const view =
    new DataView(
      data.buffer,
      data.byteOffset,
      data.byteLength
    );

  let offset =
    Math.max(
      0,
      start
    );

  const upper =
    Math.min(
      data.length,
      end
    );

  while (
    offset + 8 <= upper
  ) {
    const atomStart =
      offset;

    let declaredSize =
      readUint32(
        view,
        offset
      );

    const type =
      readAscii(
        data,
        offset + 4,
        4
      );

    if (!type) {
      break;
    }

    let headerSize = 8;

    if (declaredSize === 1) {
      if (
        offset + 16 > upper
      ) {
        break;
      }

      declaredSize =
        readUint64Safe(
          view,
          offset + 8
        );

      headerSize = 16;
    } else if (
      declaredSize === 0
    ) {
      declaredSize =
        upper - offset;
    }

    if (
      !Number.isFinite(
        declaredSize
      ) ||
      declaredSize < headerSize
    ) {
      break;
    }

    const atomEnd =
      Math.min(
        upper,
        offset + declaredSize
      );

    const atom = {
      type,
      start: atomStart,
      end: atomEnd,
      headerSize,
      size: declaredSize,
      complete:
        atomEnd -
          atomStart >=
        declaredSize,
      absoluteStart:
        baseOffset +
        atomStart,
      absoluteEnd:
        baseOffset +
        atomEnd
    };

    const descend =
      visitor(atom);

    if (
      descend !== false &&
      MP4_CONTAINER_TYPES.has(type) &&
      atomEnd -
        (atomStart + headerSize) >=
        8
    ) {
      scanMp4Atoms(
        data,
        atomStart + headerSize,
        atomEnd,
        baseOffset,
        visitor
      );
    }

    if (
      atomEnd <=
      offset
    ) {
      break;
    }

    offset =
      atomEnd;
  }
}

function findMp4Atom(
  data,
  baseOffset,
  typeWanted
) {
  let found = null;

  scanMp4Atoms(
    data,
    0,
    data.length,
    baseOffset,
    (atom) => {
      if (
        atom.type ===
          typeWanted &&
        !found
      ) {
        found = atom;
      }

      return false;
    }
  );

  return found;
}

function parseMp4TrackLeaf(
  data,
  atom,
  track
) {
  const absolute =
    atom.start;

  const header =
    atom.headerSize;

  const end =
    atom.end;

  const view =
    new DataView(
      data.buffer,
      data.byteOffset,
      data.byteLength
    );

  if (
    atom.type ===
    "tkhd"
  ) {
    if (
      absolute +
        header +
        8 >
      end
    ) {
      return;
    }

    const version =
      data[
        absolute +
        header
      ];

    const widthOffset =
      version === 1
        ? absolute + 96
        : absolute + 84;

    const heightOffset =
      version === 1
        ? absolute + 100
        : absolute + 88;

    const width =
      readFixed1616(
        view,
        widthOffset
      );

    const height =
      readFixed1616(
        view,
        heightOffset
      );

    if (
      width > 0
    ) {
      track.width =
        Math.round(
          width
        );
    }

    if (
      height > 0
    ) {
      track.height =
        Math.round(
          height
        );
    }

    return;
  }

  if (
    atom.type ===
    "mdhd"
  ) {
    const version =
      data[
        absolute +
        header
      ];

    if (
      version === 1
    ) {
      track.timeScale =
        readUint32(
          view,
          absolute +
            header +
            20
        );

      track.durationUnits =
        readUint64Safe(
          view,
          absolute +
            header +
            24
        );
    } else {
      track.timeScale =
        readUint32(
          view,
          absolute +
            header +
            12
        );

      track.durationUnits =
        readUint32(
          view,
          absolute +
            header +
            16
        );
    }

    return;
  }

  if (
    atom.type ===
    "hdlr"
  ) {
    track.handlerType =
      readAscii(
        data,
        absolute +
          header +
          8,
        4
      );

    return;
  }

  if (
    atom.type ===
    "stts"
  ) {
    const entryCount =
      readUint32(
        view,
        absolute +
          header +
          4
      );

    let cursor =
      absolute +
      header +
      8;

    let sampleCount = 0;
    let durationUnits = 0;

    const boundedEntries =
      Math.min(
        entryCount,
        Math.floor(
          (end - cursor) /
          8
        )
      );

    for (
      let index = 0;
      index < boundedEntries;
      index += 1
    ) {
      const count =
        readUint32(
          view,
          cursor
        );

      const delta =
        readUint32(
          view,
          cursor + 4
        );

      sampleCount +=
        count;

      durationUnits +=
        count * delta;

      cursor += 8;
    }

    track.sampleCount =
      sampleCount;

    track.sampleDurationUnits =
      durationUnits;

    return;
  }

  if (
    atom.type ===
    "stsz"
  ) {
    const sampleSize =
      readUint32(
        view,
        absolute +
          header +
          4
      );

    const sampleCount =
      readUint32(
        view,
        absolute +
          header +
          8
      );

    if (
      sampleCount > 0 &&
      (
        !track.sampleCount ||
        track.sampleCount <
          sampleCount
      )
    ) {
      track.sampleCount =
        sampleCount;
    }

    if (
      sampleSize > 0
    ) {
      track.constantSampleSize =
        sampleSize;
    }

    return;
  }

  if (
    atom.type ===
    "stz2"
  ) {
    const fieldSize =
      data[
        Math.min(
          end - 1,
          absolute +
            header +
            7
        )
      ];

    const sampleCount =
      readUint32(
        view,
        absolute +
          header +
          8
      );

    if (
      sampleCount > 0 &&
      (
        !track.sampleCount ||
        track.sampleCount <
          sampleCount
      )
    ) {
      track.sampleCount =
        sampleCount;
    }

    if (
      fieldSize > 0
    ) {
      track.compressedSampleFieldBits =
        fieldSize;
    }

    return;
  }

  if (
    atom.type ===
    "stsd"
  ) {
    const entryCount =
      readUint32(
        view,
        absolute +
          header +
          4
      );

    if (
      !entryCount ||
      absolute +
        header +
        16 >
        end
    ) {
      return;
    }

    const cursor =
      absolute +
      header +
      8;

    const size =
      readUint32(
        view,
        cursor
      );

    const codec =
      readAscii(
        data,
        cursor + 4,
        4
      );

    if (
      size >= 8 &&
      codec
    ) {
      track.codec =
        codec.trim() ||
        codec;
    }
  }
}

function parseMp4Moov(
  data,
  baseOffset = 0
) {
  const moov =
    findMp4Atom(
      data,
      baseOffset,
      "moov"
    );

  if (!moov) {
    return null;
  }

  const tracks = [];

  const visitRange =
    (
      start,
      end,
      activeTrack,
      depth = 0
    ) => {
      if (
        depth > 12 ||
        end - start < 8
      ) {
        return;
      }

      const view =
        new DataView(
          data.buffer,
          data.byteOffset,
          data.byteLength
        );

      let offset = start;

      while (
        offset + 8 <= end
      ) {
        const atomStart =
          offset;

        let size =
          readUint32(
            view,
            offset
          );

        const type =
          readAscii(
            data,
            offset + 4,
            4
          );

        let headerSize = 8;

        if (
          size === 1
        ) {
          if (
            offset + 16 >
            end
          ) {
            break;
          }

          size =
            readUint64Safe(
              view,
              offset + 8
            );

          headerSize =
            16;
        } else if (
          size === 0
        ) {
          size =
            end - offset;
        }

        if (
          !type ||
          !Number.isFinite(size) ||
          size < headerSize
        ) {
          break;
        }

        const atomEnd =
          Math.min(
            end,
            offset + size
          );

        if (
          type === "trak"
        ) {
          const track = {
            handlerType: "",
            width: 0,
            height: 0,
            timeScale: 0,
            durationUnits: 0,
            sampleCount: 0,
            sampleDurationUnits: 0,
            codec: ""
          };

          tracks.push(
            track
          );

          visitRange(
            atomStart +
              headerSize,
            atomEnd,
            track,
            depth + 1
          );
        } else if (
          activeTrack
        ) {
          parseMp4TrackLeaf(
            data,
            {
              type,
              start: atomStart,
              end: atomEnd,
              headerSize
            },
            activeTrack
          );

          if (
            MP4_CONTAINER_TYPES.has(
              type
            ) &&
            atomEnd -
              (atomStart + headerSize) >=
              8
          ) {
            visitRange(
              atomStart +
                headerSize,
              atomEnd,
              activeTrack,
              depth + 1
            );
          }
        } else if (
          MP4_CONTAINER_TYPES.has(
            type
          ) &&
          atomEnd -
            (atomStart + headerSize) >=
            8
        ) {
          visitRange(
            atomStart +
              headerSize,
            atomEnd,
            null,
            depth + 1
          );
        }

        if (
          atomEnd <=
          offset
        ) {
          break;
        }

        offset =
          atomEnd;
      }
    };

  if (!moov.complete) {
    return null;
  }

  visitRange(
    moov.start +
      moov.headerSize,
    moov.end,
    null
  );

  const video =
    tracks.find(
      (track) =>
        track.handlerType ===
        "vide"
    );

  const audio =
    tracks.find(
      (track) =>
        track.handlerType ===
        "soun"
    );

  const selected =
    video ||
    audio ||
    tracks[0] ||
    null;

  if (!selected) {
    return null;
  }

  const durationUnits =
    positive(
      selected.sampleDurationUnits,
      selected.durationUnits
    );

  const durationMs =
    selected.timeScale > 0
      ? (
          durationUnits /
          selected.timeScale
        ) *
        1000
      : 0;

  const frameRate =
    selected.handlerType === "vide" &&
    durationMs > 0 &&
    selected.sampleCount > 0
      ? (
          selected.sampleCount /
          (durationMs / 1000)
        )
      : 0;

  const frameDurationMs =
    frameRate > 0
      ? 1000 / frameRate
      : 0;

  return {
    durationMs,
    width:
      video?.width ||
      0,
    height:
      video?.height ||
      0,
    timeScale:
      selected.timeScale ||
      0,
    frameCount:
      video?.sampleCount ||
      0,
    frameRate,
    frameDurationMs,
    codec:
      video?.codec ||
      "",
    trackCount:
      tracks.length,
    hasAudio: Boolean(audio)
  };
}

function detectMp4Container(
  data
) {
  const ftyp =
    findMp4Atom(
      data,
      0,
      "ftyp"
    );

  if (
    !ftyp ||
    ftyp.start +
      ftyp.headerSize +
      8 >
      ftyp.end
  ) {
    return null;
  }

  const majorBrand =
    readAscii(
      data,
      ftyp.start +
        ftyp.headerSize,
      4
    ).trim();

  if (
    majorBrand ===
    "qt"
  ) {
    return "mov";
  }

  return "mp4";
}

function parseImageHeader(
  data,
  fileName
) {
  if (
    data.length >= 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4E &&
    data[3] === 0x47 &&
    data[4] === 0x0D &&
    data[5] === 0x0A &&
    data[6] === 0x1A &&
    data[7] === 0x0A
  ) {
    const view =
      new DataView(
        data.buffer,
        data.byteOffset,
        data.byteLength
      );

    return {
      container: "png",
      width: readUint32(
        view,
        16
      ),
      height: readUint32(
        view,
        20
      ),
      frameCount: 1
    };
  }

  if (
    data.length >= 10 &&
    (
      readAscii(data, 0, 6) === "GIF87a" ||
      readAscii(data, 0, 6) === "GIF89a"
    )
  ) {
    const view =
      new DataView(
        data.buffer,
        data.byteOffset,
        data.byteLength
      );

    return {
      container: "gif",
      width:
        readUint16LE(
          view,
          6
        ),
      height:
        readUint16LE(
          view,
          8
        ),
      frameCount: 1
    };
  }

  if (
    data.length >= 30 &&
    readAscii(
      data,
      0,
      2
    ) === "BM"
  ) {
    const view =
      new DataView(
        data.buffer,
        data.byteOffset,
        data.byteLength
      );

    return {
      container: "bmp",
      width:
        readUint32LE(
          view,
          18
        ),
      height:
        Math.abs(
          view.getInt32(
            22,
            true
          )
        ),
      frameCount: 1
    };
  }

  if (
    data.length >= 30 &&
    readAscii(
      data,
      0,
      4
    ) === "RIFF" &&
    readAscii(
      data,
      8,
      4
    ) === "WEBP"
  ) {
    const chunk =
      readAscii(
        data,
        12,
        4
      );

    if (
      chunk === "VP8X" &&
      data.length >= 30
    ) {
      const width =
        1 +
        data[24] +
        (data[25] << 8) +
        (data[26] << 16);

      const height =
        1 +
        data[27] +
        (data[28] << 8) +
        (data[29] << 16);

      return {
        container: "webp",
        width,
        height,
        frameCount: 1
      };
    }
  }

  const extension =
    extensionOf(
      fileName
    );

  return {
    container:
      extension ||
      "image",
    width: 0,
    height: 0,
    frameCount: 1
  };
}

async function parseMp4File(
  file,
  options
) {
  const probeBytes =
    Math.min(
      Math.max(
        64 * 1024,
        positive(
          options.probeBytes,
          DEFAULT_MEDIA_OPTIONS.probeBytes
        )
      ),
      file.size
    );

  const headBufferPromise =
    readSlice(
      file,
      0,
      probeBytes
    );

  const tailStart =
    Math.max(
      0,
      file.size -
        probeBytes
    );

  const tailBufferPromise =
    tailStart > 0
      ? readSlice(
          file,
          tailStart,
          file.size
        )
      : Promise.resolve(
          new ArrayBuffer(0)
        );

  const [
    headBuffer,
    tailBuffer
  ] =
    await Promise.all([
      headBufferPromise,
      tailBufferPromise
    ]);

  const head =
    new Uint8Array(
      headBuffer
    );

  const tail =
    new Uint8Array(
      tailBuffer
    );

  const container =
    detectMp4Container(
      head
    ) ||
    detectMp4Container(
      tail
    ) ||
    (
      extensionOf(file.name) ===
      "mov"
        ? "mov"
        : "mp4"
    );

  let moov =
    findMp4Atom(
      head,
      0,
      "moov"
    );

  let probe =
    head;

  let probeBase = 0;

  if (
    !moov &&
    tail.length
  ) {
    moov =
      findMp4Atom(
        tail,
        tailStart,
        "moov"
      );

    probe =
      tail;

    probeBase =
      tailStart;
  }

  if (!moov) {
    return {
      container,
      durationMs: 0,
      width: 0,
      height: 0,
      timeScale: 0,
      frameCount: 0,
      frameRate: 0,
      frameDurationMs: 0,
      codec: "",
      trackCount: 0,
      parser: "binary-header"
    };
  }

  const maxAtomReadBytes =
    Math.max(
      64 * 1024,
      positive(
        options.maxAtomReadBytes,
        DEFAULT_MEDIA_OPTIONS.maxAtomReadBytes
      )
    );

  if (
    moov.complete &&
    moov.size <=
      probe.length -
        moov.start
  ) {
    const parsed =
      parseMp4Moov(
        probe,
        probeBase
      );

    if (parsed) {
      return {
        ...parsed,
        container,
        parser:
          "binary-header"
      };
    }
  }

  if (
    moov.size <=
    maxAtomReadBytes
  ) {
    const exact =
      await readSlice(
        file,
        moov.absoluteStart,
        Math.min(
          file.size,
          moov.absoluteStart +
            moov.size
        )
      );

    const parsed =
      parseMp4Moov(
        new Uint8Array(
          exact
        ),
        moov.absoluteStart
      );

    if (parsed) {
      return {
        ...parsed,
        container,
        parser:
          "binary-header"
      };
    }
  }

  return {
    container,
    durationMs: 0,
    width: 0,
    height: 0,
    timeScale: 0,
    frameCount: 0,
    frameRate: 0,
    frameDurationMs: 0,
    codec: "",
    trackCount: 0,
    parser:
      "binary-header-partial"
  };
}

function findMatroskaElement(
  data,
  start,
  end,
  wantedId
) {
  let result = null;
  let offset = start;

  while (
    offset < end
  ) {
    const id =
      readEbmlId(
        data,
        offset
      );

    if (!id) break;

    const size =
      readVint(
        data,
        offset +
          id.length,
        true
      );

    if (!size) break;

    const payloadStart =
      offset +
      id.length +
      size.length;

    const payloadEnd =
      size.unknown
        ? end
        : Math.min(
            end,
            payloadStart +
              size.value
          );

    if (
      id.id === wantedId
    ) {
      result = {
        id: id.id,
        start: offset,
        payloadStart,
        end: payloadEnd,
        sizeUnknown:
          size.unknown
      };
      break;
    }

    if (
      payloadEnd <=
      offset
    ) {
      break;
    }

    offset =
      payloadEnd;
  }

  return result;
}

function parseMatroskaHeader(
  data
) {
  const EBML_ID = 0x1A45DFA3;
  const SEGMENT_ID = 0x18538067;
  const INFO_ID = 0x1549A966;
  const TRACKS_ID = 0x1654AE6B;
  const TRACK_ENTRY_ID = 0xAE;
  const VIDEO_ID = 0xE0;
  const TRACK_TYPE_ID = 0x83;
  const PIXEL_WIDTH_ID = 0xB0;
  const PIXEL_HEIGHT_ID = 0xBA;
  const TIMECODE_SCALE_ID = 0x2AD7B1;
  const DURATION_ID = 0x4489;
  const DEFAULT_DURATION_ID = 0x23E383;

  let ebml =
    findMatroskaElement(
      data,
      0,
      data.length,
      EBML_ID
    );

  if (!ebml) {
    for (
      let offset = 0;
      offset + 4 <=
        Math.min(
          data.length,
          64
        );
      offset += 1
    ) {
      if (
        data[offset] === 0x1A &&
        data[offset + 1] === 0x45 &&
        data[offset + 2] === 0xDF &&
        data[offset + 3] === 0xA3
      ) {
        ebml = {
          start: offset
        };
        break;
      }
    }
  }

  if (!ebml) {
    return null;
  }

  const segment =
    findMatroskaElement(
      data,
      ebml.start,
      data.length,
      SEGMENT_ID
    );

  if (!segment) {
    return null;
  }

  const segmentEnd =
    segment.sizeUnknown
      ? data.length
      : segment.end;

  const info =
    findMatroskaElement(
      data,
      segment.payloadStart,
      segmentEnd,
      INFO_ID
    );

  const tracks =
    findMatroskaElement(
      data,
      segment.payloadStart,
      segmentEnd,
      TRACKS_ID
    );

  let timecodeScale =
    1000000;

  let durationUnits = 0;

  if (info) {
    let offset =
      info.payloadStart;

    while (
      offset <
      info.end
    ) {
      const id =
        readEbmlId(
          data,
          offset
        );

      if (!id) break;

      const size =
        readVint(
          data,
          offset +
            id.length,
          true
        );

      if (!size) break;

      const payloadStart =
        offset +
        id.length +
        size.length;

      const payloadEnd =
        size.unknown
          ? info.end
          : Math.min(
              info.end,
              payloadStart +
                size.value
            );

      if (
        id.id ===
        TIMECODE_SCALE_ID
      ) {
        timecodeScale =
          Math.max(
            1,
            readEbmlInteger(
              data,
              payloadStart,
              payloadEnd
            )
          );
      }

      if (
        id.id ===
        DURATION_ID
      ) {
        durationUnits =
          readEbmlFloat(
            data,
            payloadStart,
            payloadEnd
          );
      }

      if (
        payloadEnd <=
        offset
      ) {
        break;
      }

      offset =
        payloadEnd;
    }
  }

  let videoWidth = 0;
  let videoHeight = 0;
  let defaultDuration = 0;
  let trackType = 0;
  let trackCount = 0;
  let hasAudio = false;

  if (tracks) {
    let offset =
      tracks.payloadStart;

    while (
      offset <
      tracks.end
    ) {
      const id =
        readEbmlId(
          data,
          offset
        );

      if (!id) break;

      const size =
        readVint(
          data,
          offset +
            id.length,
          true
        );

      if (!size) break;

      const payloadStart =
        offset +
        id.length +
        size.length;

      const payloadEnd =
        size.unknown
          ? tracks.end
          : Math.min(
              tracks.end,
              payloadStart +
                size.value
            );

      if (
        id.id ===
        TRACK_ENTRY_ID
      ) {
        trackCount += 1;

        let trackOffset =
          payloadStart;

        let localTrackType = 0;
        let localDefaultDuration = 0;
        let localWidth = 0;
        let localHeight = 0;

        while (
          trackOffset <
          payloadEnd
        ) {
          const childId =
            readEbmlId(
              data,
              trackOffset
            );

          if (!childId) break;

          const childSize =
            readVint(
              data,
              trackOffset +
                childId.length,
              true
            );

          if (!childSize) break;

          const childPayloadStart =
            trackOffset +
            childId.length +
            childSize.length;

          const childPayloadEnd =
            childSize.unknown
              ? payloadEnd
              : Math.min(
                  payloadEnd,
                  childPayloadStart +
                    childSize.value
                );

          if (
            childId.id ===
            TRACK_TYPE_ID
          ) {
            localTrackType =
              readEbmlInteger(
                data,
                childPayloadStart,
                childPayloadEnd
              );
          } else if (
            childId.id ===
            DEFAULT_DURATION_ID
          ) {
            localDefaultDuration =
              readEbmlInteger(
                data,
                childPayloadStart,
                childPayloadEnd
              );
          } else if (
            childId.id ===
            VIDEO_ID
          ) {
            let videoOffset =
              childPayloadStart;

            while (
              videoOffset <
              childPayloadEnd
            ) {
              const videoChildId =
                readEbmlId(
                  data,
                  videoOffset
                );

              if (!videoChildId) break;

              const videoChildSize =
                readVint(
                  data,
                  videoOffset +
                    videoChildId.length,
                  true
                );

              if (!videoChildSize) break;

              const videoPayloadStart =
                videoOffset +
                videoChildId.length +
                videoChildSize.length;

              const videoPayloadEnd =
                videoChildSize.unknown
                  ? childPayloadEnd
                  : Math.min(
                      childPayloadEnd,
                      videoPayloadStart +
                        videoChildSize.value
                    );

              if (
                videoChildId.id ===
                PIXEL_WIDTH_ID
              ) {
                localWidth =
                  readEbmlInteger(
                    data,
                    videoPayloadStart,
                    videoPayloadEnd
                  );
              } else if (
                videoChildId.id ===
                PIXEL_HEIGHT_ID
              ) {
                localHeight =
                  readEbmlInteger(
                    data,
                    videoPayloadStart,
                    videoPayloadEnd
                  );
              }

              if (
                videoPayloadEnd <=
                videoOffset
              ) {
                break;
              }

              videoOffset =
                videoPayloadEnd;
            }
          }

          if (
            childPayloadEnd <=
            trackOffset
          ) {
            break;
          }

          trackOffset =
            childPayloadEnd;
        }

        if (
          localTrackType === 1
        ) {
          trackType = 1;
          videoWidth =
            localWidth ||
            videoWidth;
          videoHeight =
            localHeight ||
            videoHeight;

          defaultDuration =
            localDefaultDuration ||
            defaultDuration;
        } else if (localTrackType === 2) {
          hasAudio = true;
        }
      }

      if (
        payloadEnd <=
        offset
      ) {
        break;
      }

      offset =
        payloadEnd;
    }
  }

  const frameRate =
    defaultDuration > 0
      ? 1000000000 /
        defaultDuration
      : 0;

  const durationMs =
    Number.isFinite(
      durationUnits
    ) &&
    durationUnits > 0
      ? (
          durationUnits *
          timecodeScale
        ) /
        1000000
      : 0;

  return {
    container: "mkv",
    durationMs,
    width:
      Math.max(
        0,
        Math.round(
          videoWidth
        )
      ),
    height:
      Math.max(
        0,
        Math.round(
          videoHeight
        )
      ),
    timeScale:
      timecodeScale,
    frameCount: 0,
    frameRate,
    frameDurationMs:
      frameRate > 0
        ? 1000 / frameRate
        : 0,
    codec: "",
    trackCount,
    trackType,
    hasAudio
  };
}

async function parseMatroskaFile(
  file,
  options
) {
  const probeBytes =
    Math.min(
      Math.max(
        64 * 1024,
        positive(
          options.probeBytes,
          DEFAULT_MEDIA_OPTIONS.probeBytes
        )
      ),
      file.size
    );

  const buffer =
    new Uint8Array(
      await readSlice(
        file,
        0,
        probeBytes
      )
    );

  const parsed =
    parseMatroskaHeader(
      buffer
    );

  if (!parsed) {
    throw makeParseError(
      "NovaCut could not parse the Matroska header for " +
      file.name +
      "."
    );
  }

  return {
    ...parsed,
    parser: "binary-header"
  };
}

async function parseImageFile(
  file,
  options
) {
  const probeBytes =
    Math.min(
      Math.max(
        32 * 1024,
        positive(
          options.probeBytes,
          DEFAULT_MEDIA_OPTIONS.probeBytes
        )
      ),
      file.size
    );

  const data =
    new Uint8Array(
      await readSlice(
        file,
        0,
        probeBytes
      )
    );

  return {
    ...parseImageHeader(
      data,
      file.name
    ),
    durationMs: 0,
    timeScale: 0,
    frameRate: 0,
    frameDurationMs: 0,
    codec: "",
    trackCount: 1,
    parser: "binary-header"
  };
}

async function parseBinaryHeader(
  file,
  kind,
  options
) {
  if (
    kind === "image"
  ) {
    return parseImageFile(
      file,
      options
    );
  }

  const probeBytes =
    Math.min(
      512 * 1024,
      Math.max(
        64 * 1024,
        positive(
          options.probeBytes,
          DEFAULT_MEDIA_OPTIONS.probeBytes
        )
      ),
      file.size
    );

  const firstBuffer =
    new Uint8Array(
      await readSlice(
        file,
        0,
        probeBytes
      )
    );

  const isMatroska =
    firstBuffer.length >= 4 &&
    firstBuffer[0] === 0x1A &&
    firstBuffer[1] === 0x45 &&
    firstBuffer[2] === 0xDF &&
    firstBuffer[3] === 0xA3;

  const hasFtyp =
    Boolean(
      findMp4Atom(
        firstBuffer,
        0,
        "ftyp"
      )
    );

  const extension =
    extensionOf(
      file.name
    );

  if (
    isMatroska ||
    extension === "mkv"
  ) {
    return parseMatroskaFile(
      file,
      options
    );
  }

  if (
    hasFtyp ||
    ["mp4", "m4v", "mov", "m4a"].includes(
      extension
    )
  ) {
    return parseMp4File(
      file,
      options
    );
  }

  return {
    container:
      extension ||
      kind,
    durationMs: 0,
    width: 0,
    height: 0,
    timeScale: 0,
    frameCount: 0,
    frameRate: 0,
    frameDurationMs: 0,
    codec: "",
    trackCount: 0,
    parser: "mime-fallback"
  };
}

function waitForMediaMetadata(
  media,
  timeoutMs
) {
  return new Promise(
    (resolve, reject) => {
      let timer = 0;

      const cleanup =
        () => {
          if (timer) {
            clearTimeout(
              timer
            );
            timer = 0;
          }

          media.removeEventListener(
            "loadedmetadata",
            onLoaded
          );

          media.removeEventListener(
            "error",
            onError
          );
        };

      const onLoaded =
        () => {
          cleanup();
          resolve();
        };

      const onError =
        () => {
          cleanup();
          reject(
            new Error(
              "Browser media decoder rejected this file."
            )
          );
        };

      timer =
        window.setTimeout(
          () => {
            cleanup();
            reject(
              new Error(
                "Browser media metadata probe timed out."
              )
            );
          },
          Math.max(
            1000,
            timeoutMs
          )
        );

      media.addEventListener(
        "loadedmetadata",
        onLoaded,
        { once: true }
      );

      media.addEventListener(
        "error",
        onError,
        { once: true }
      );

      try {
        media.load();
      } catch (error) {
        cleanup();
        reject(
          error
        );
      }
    }
  );
}

function waitForImage(
  image,
  timeoutMs
) {
  return new Promise(
    (resolve, reject) => {
      let timer = 0;

      const cleanup =
        () => {
          if (timer) {
            clearTimeout(
              timer
            );
            timer = 0;
          }

          image.removeEventListener(
            "load",
            onLoad
          );

          image.removeEventListener(
            "error",
            onError
          );
        };

      const onLoad =
        () => {
          cleanup();
          resolve();
        };

      const onError =
        () => {
          cleanup();
          reject(
            new Error(
              "Browser image decoder rejected this file."
            )
          );
        };

      timer =
        window.setTimeout(
          () => {
            cleanup();
            reject(
              new Error(
                "Browser image metadata probe timed out."
              )
            );
          },
          Math.max(
            1000,
            timeoutMs
          )
        );

      image.addEventListener(
        "load",
        onLoad,
        { once: true }
      );

      image.addEventListener(
        "error",
        onError,
        { once: true }
      );
    }
  );
}

async function probeImageMetadata(
  file,
  timeoutMs
) {
  if (
    typeof createImageBitmap ===
    "function"
  ) {
    let timer = 0;

    try {
      const bitmapPromise =
        createImageBitmap(
          file
        );

      const timeoutPromise =
        new Promise(
          (_, reject) => {
            timer =
              window.setTimeout(
                () => {
                  reject(
                    new Error(
                      "Browser image decoder timed out."
                    )
                  );
                },
                Math.max(
                  1000,
                  timeoutMs
                )
              );
          }
        );

      const bitmap =
        await Promise.race([
          bitmapPromise,
          timeoutPromise
        ]);

      if (timer) {
        clearTimeout(
          timer
        );
        timer = 0;
      }

      try {
        return {
          width: bitmap.width,
          height: bitmap.height,
          durationMs: 0
        };
      } finally {
        bitmap.close?.();
      }
    } catch (error) {
      if (timer) {
        clearTimeout(
          timer
        );
        timer = 0;
      }

      throw error;
    }
  }

  const url =
    URL.createObjectURL(
      file
    );

  try {
    const image =
      new Image();

    image.decoding =
      "async";

    image.src =
      url;

    await waitForImage(
      image,
      timeoutMs
    );

    return {
      width:
        image.naturalWidth,
      height:
        image.naturalHeight,
      durationMs: 0
    };
  } finally {
    URL.revokeObjectURL(
      url
    );
  }
}

async function probeMediaElementMetadata(
  file,
  kind,
  timeoutMs
) {
  if (
    kind === "image"
  ) {
    return probeImageMetadata(
      file,
      timeoutMs
    );
  }

  const tag =
    kind === "audio"
      ? "audio"
      : "video";

  const media =
    document.createElement(
      tag
    );

  const url =
    URL.createObjectURL(
      file
    );

  try {
    media.preload =
      "metadata";

    if (
      "playsInline" in
      media
    ) {
      media.playsInline =
        true;
    }

    media.muted =
      true;

    media.src =
      url;

    await waitForMediaMetadata(
      media,
      timeoutMs
    );

    return {
      width:
        tag === "video"
          ? Math.max(
              0,
              Number(
                media.videoWidth
              ) || 0
            )
          : 0,
      height:
        tag === "video"
          ? Math.max(
              0,
              Number(
                media.videoHeight
              ) || 0
            )
          : 0,
      durationMs:
        Number.isFinite(
          media.duration
        ) &&
        media.duration > 0
          ? media.duration *
            1000
          : 0
    };
  } finally {
    try {
      media.pause?.();
      media.removeAttribute(
        "src"
      );
      media.load?.();
    } catch (_) {
      // Decoder teardown is best-effort.
    }

    URL.revokeObjectURL(
      url
    );
  }
}

function mergeMetadata(
  file,
  kind,
  binary,
  decoded,
  options
) {
  const decodedDurationMs = positive(decoded?.durationMs, 0);
  const binaryDurationMs = positive(binary?.durationMs, 0);
  // Some Android decoders expose a shorter duration than the container's
  // sample table. Prefer the longer credible value for video to prevent cut-off.
  const durationMs = kind === "video"
    ? Math.max(decodedDurationMs, binaryDurationMs)
    : positive(decodedDurationMs, binaryDurationMs);

  const width =
    Math.max(
      0,
      Math.round(
        positive(
          decoded?.width,
          binary?.width
        )
      )
    );

  const height =
    Math.max(
      0,
      Math.round(
        positive(
          decoded?.height,
          binary?.height
        )
      )
    );

  const frameRate =
    positive(
      binary?.frameRate,
      0
    );

  const frameDurationMs =
    frameRate > 0
      ? 1000 / frameRate
      : positive(
          binary?.frameDurationMs,
          0
        );

  const frameCount =
    Math.max(
      0,
      Math.floor(
        positive(
          binary?.frameCount,
          0
        )
      )
    );

  const frameDensity =
    durationMs > 0 &&
    frameCount > 0
      ? frameCount /
        (durationMs / 1000)
      : frameRate;

  const imageDuration =
    kind === "image"
      ? Math.max(
          1,
          positive(
            options.imageDurationMs,
            DEFAULT_MEDIA_OPTIONS.imageDurationMs
          )
        )
      : durationMs;

  return Object.freeze({
    id:
      kind +
      "-" +
      fileFingerprint(
        file
      ),
    kind,
    name:
      file.name,
    type:
      file.type ||
      "application/octet-stream",
    sizeBytes:
      Math.max(
        0,
        finite(
          file.size
        )
      ),
    lastModified:
      Math.max(
        0,
        finite(
          file.lastModified
        )
      ),
    container:
      binary?.container ||
      extensionOf(
        file.name
      ) ||
      kind,
    codec:
      binary?.codec ||
      "",
    hasAudio: binary?.hasAudio === true,
    width,
    height,
    durationMs:
      Math.max(
        1,
        imageDuration
      ),
    frameCount,
    frameRate:
      Math.max(
        0,
        frameRate
      ),
    frameDurationMs:
      Math.max(
        0,
        frameDurationMs
      ),
    frameDensity:
      Math.max(
        0,
        finite(
          frameDensity
        )
      ),
    timeScale:
      Math.max(
        0,
        finite(
          binary?.timeScale
        )
      ),
    trackCount:
      Math.max(
        0,
        Math.floor(
          finite(
            binary?.trackCount
          )
        )
      ),
    parser:
      binary?.parser ||
      "media-element",
    metadataSource:
      decoded &&
      (
        decoded.durationMs > 0 ||
        decoded.width > 0 ||
        decoded.height > 0
      )
        ? binary?.parser
          ? "binary+browser"
          : "browser"
        : "binary",
    file
  });
}

async function parseOneFile(
  file,
  options
) {
  if (!isFileLike(file)) {
    throw makeParseError(
      "NovaCut received a non-file input."
    );
  }

  if (
    file.size <= 0
  ) {
    throw makeParseError(
      '"' +
      file.name +
      '" is empty.'
    );
  }

  if (
    file.size >
    options.maxFileBytes
  ) {
    throw makeParseError(
      '"' +
      file.name +
      '" exceeds the supported media allocation limit.'
    );
  }

  const kind =
    kindFromFile(
      file
    );

  if (!kind) {
    throw makeParseError(
      '"' +
      file.name +
      '" is not a supported video, audio, or image input.'
    );
  }

  let binary = null;
  let decoded = null;
  let binaryError = null;
  let decodedError = null;

  const binaryPromise =
    parseBinaryHeader(
      file,
      kind,
      options
    ).catch(
      (error) => {
        binaryError =
          error;
        return null;
      }
    );

  const decodedPromise =
    probeMediaElementMetadata(
      file,
      kind,
      options.mediaProbeTimeoutMs
    ).catch(
      (error) => {
        decodedError =
          error;
        return null;
      }
    );

  [
    binary,
    decoded
  ] =
    await Promise.all([
      binaryPromise,
      decodedPromise
    ]);

  const metadata =
    mergeMetadata(
      file,
      kind,
      binary,
      decoded,
      options
    );

  if (
    kind !== "image" &&
    metadata.durationMs <= 1
  ) {
    throw makeParseError(
      "NovaCut could not determine a stable duration for " +
      '"' +
      file.name +
      '".',
      decodedError ||
        binaryError
    );
  }

  return {
    ok: true,
    file,
    metadata,
    warnings: [
      binaryError
        ? "Binary header parse fallback: " +
          binaryError.message
        : null,
      decodedError
        ? "Browser decoder fallback: " +
          decodedError.message
        : null
    ].filter(Boolean)
  };
}

function getTrackEnd(track) {
  return Math.max(
    0,
    finite(
      track?.startTime
    ) +
    finite(
      track?.duration
    )
  );
}

function resolveAppendTime(
  engine,
  kind,
  startMode
) {
  if (
    startMode ===
    "playhead"
  ) {
    return Math.max(
      0,
      finite(
        engine?.currentTimestamp
      )
    );
  }

  if (
    kind === "audio"
  ) {
    return Math.max(
      0,
      ...(
        engine?.registry?.audioTracks ||
        []
      ).map(
        getTrackEnd
      )
    );
  }

  return Math.max(
    0,
    ...(
      engine?.registry?.videoTracks ||
      []
    ).map(
      getTrackEnd
    )
  );
}

function emitEngineEvent(
  engine,
  name,
  payload
) {
  try {
    engine?.events?.emit?.(
      name,
      payload
    );
  } catch (_) {
    // Event fan-out must never break ingestion.
  }
}

function injectMetadataRecord(
  engine,
  record,
  options
) {
  if (!engine) {
    throw makeParseError(
      "NovaCut media injection requires a live NovaCutEngine."
    );
  }

  const metadata =
    record.metadata;

  const startTime =
    resolveAppendTime(
      engine,
      metadata.kind,
      options.startMode
    );

  if (
    metadata.kind ===
    "audio"
  ) {
    const payload = {
      id:
        "audio-" +
        metadata.id,
      file:
        metadata.file,
      startTime,
      duration:
        metadata.durationMs,
      volume: 1
    };

    let segment = null;

    if (
      typeof engine.addAudioSegment ===
      "function"
    ) {
      segment =
        engine.addAudioSegment(
          payload
        );
    } else if (
      typeof engine.addAudioClip ===
      "function"
    ) {
      segment =
        engine.addAudioClip(
          payload
        );
    }

    if (!segment) {
      throw makeParseError(
        "NovaCutEngine exposes neither addAudioSegment() nor addAudioClip()."
      );
    }

    segment.metadata =
      metadata;

    record.track =
      segment;

    emitEngineEvent(
      engine,
      "media:injected",
      record
    );

    return segment;
  }

  const payload = {
    id:
      "video-" +
      metadata.id,
    file:
      metadata.file,
    startTime,
    duration:
      metadata.durationMs,
    sourceStartTime: 0,
    x_offset: 0,
    scale: 1
  };

  if (
    typeof engine.addVideoClip !==
    "function"
  ) {
    throw makeParseError(
      "NovaCutEngine.addVideoClip() is not available."
    );
  }

  const clip =
    engine.addVideoClip(
      payload
    );

  clip.metadata =
    metadata;

  if (metadata.kind === "video" && typeof engine.applyInitialAspectRatio === "function") {
    engine.applyInitialAspectRatio(clip, metadata);
  }

  record.track =
    clip;

  emitEngineEvent(
    engine,
    "media:injected",
    record
  );

  return clip;
}

export class NovaCutMediaParser {
  constructor(
    root,
    engine,
    options = {}
  ) {
    if (!root) {
      throw new Error(
        "NovaCutMediaParser requires a mounted NovaCut root."
      );
    }

    if (!engine) {
      throw new Error(
        "NovaCutMediaParser requires a NovaCutEngine instance."
      );
    }

    this.root =
      root;

    this.engine =
      engine;

    const hardwareConcurrency =
      Math.max(
        1,
        Number(
          globalThis.navigator?.hardwareConcurrency
        ) || 1
      );

    this.options =
      Object.freeze({
        ...DEFAULT_MEDIA_OPTIONS,
        ...options,
        parseConcurrency:
          clamp(
            options.parseConcurrency ??
              Math.min(
                2,
                Math.max(
                  1,
                  hardwareConcurrency - 1
                )
              ),
            1,
            4
          )
      });

    this.input =
      null;

    this.abortController =
      new AbortController();

    this.isDisposed =
      false;

    this.activeBatch =
      null;

    this.batchQueue =
      Promise.resolve([]);

    this.pendingPicker =
      null;

    this.records =
      [];

    this.metadata =
      [];

    this.acceptedFingerprints =
      new Set();

    this.pendingFingerprints =
      new Set();

    this.mount();
  }

  mount() {
    this.createInput();
    this.bindRootPickerTriggers();
    this.bindDropZone(
      this.root
    );
    return this;
  }

  createInput() {
    const existing =
      this.root.querySelector(
        "input[data-novacut-media-input]"
      );

    this.input =
      existing ||
      document.createElement(
        "input"
      );

    this.input.type =
      "file";

    this.input.accept =
      this.options.accept;

    this.input.multiple =
      true;

    this.input.hidden =
      true;

    this.input.setAttribute(
      "aria-hidden",
      "true"
    );

    this.input.dataset.novacutMediaInput =
      "true";

    if (!existing) {
      this.root.appendChild(
        this.input
      );
    }

    const signal =
      this.abortController.signal;

    this.input.addEventListener(
      "change",
      () => {
        const files =
          normalizeFileList(
            this.input.files
          );

        this.input.value =
          "";

        const promise =
          this.handleFiles(
            files,
            {
              source:
                "file-picker"
            }
          );

        if (
          this.pendingPicker
        ) {
          const pending =
            this.pendingPicker;

          this.pendingPicker =
            null;

          promise.then(
            pending.resolve,
            pending.reject
          );
        }
      },
      { signal }
    );

    this.input.addEventListener(
      "cancel",
      () => {
        if (
          this.pendingPicker
        ) {
          const pending =
            this.pendingPicker;

          this.pendingPicker =
            null;

          pending.resolve(
            []
          );
        }
      },
      { signal }
    );
  }

  bindRootPickerTriggers() {
    const signal =
      this.abortController.signal;

    this.root.addEventListener(
      "click",
      (event) => {
        if (
          !isElement(
            event.target
          )
        ) {
          return;
        }

        const target =
          event.target.closest(
            "[data-novacut-media-open], [data-action='media'], [data-action='import-media']"
          );

        if (!target) {
          return;
        }

        event.preventDefault();

        void this.openFilePicker();
      },
      { signal }
    );
  }

  bindDropZone(
    element
  ) {
    if (!element) return;

    const signal =
      this.abortController.signal;

    element.addEventListener(
      "dragover",
      (event) => {
        if (
          !this.hasFiles(
            event.dataTransfer
          )
        ) {
          return;
        }

        event.preventDefault();

        try {
          event.dataTransfer.dropEffect =
            "copy";
        } catch (_) {}
      },
      {
        signal,
        passive: false
      }
    );

    element.addEventListener(
      "drop",
      (event) => {
        if (
          !this.hasFiles(
            event.dataTransfer
          )
        ) {
          return;
        }

        event.preventDefault();

        const files =
          normalizeFileList(
            event.dataTransfer.files
          );

        void this.handleFiles(
          files,
          {
            source:
              "drag-drop"
          }
        );
      },
      {
        signal,
        passive: false
      }
    );

    element.addEventListener(
      "paste",
      (event) => {
        const files =
          normalizeFileList(
            event.clipboardData?.items
          );

        if (!files.length) {
          return;
        }

        event.preventDefault();

        void this.handleFiles(
          files,
          {
            source:
              "paste"
          }
        );
      },
      { signal }
    );
  }

  hasFiles(
    dataTransfer
  ) {
    if (!dataTransfer) {
      return false;
    }

    if (
      typeof dataTransfer.types?.includes ===
      "function"
    ) {
      return dataTransfer.types.includes(
        "Files"
      );
    }

    return Boolean(
      dataTransfer.files?.length
    );
  }

  openFilePicker() {
    if (
      this.isDisposed ||
      !this.input
    ) {
      return Promise.resolve(
        []
      );
    }

    if (
      this.activeBatch
    ) {
      return this.activeBatch;
    }

    if (
      this.pendingPicker
    ) {
      return this.pendingPicker.promise;
    }

    const pending = {};

    pending.promise =
      new Promise(
        (resolve, reject) => {
          pending.resolve =
            resolve;

          pending.reject =
            reject;
        }
      );

    this.pendingPicker =
      pending;

    try {
      this.input.value =
        "";

      this.input.click();
    } catch (error) {
      this.pendingPicker =
        null;

      this.reportError(
        "selector",
        error
      );

      pending.reject(
        error
      );
    }

    return pending.promise;
  }

  async handleFiles(
    input,
    context = {}
  ) {
    if (this.isDisposed) {
      return [];
    }

    const files =
      normalizeFileList(
        input
      );

    if (!files.length) {
      return [];
    }

    const available =
      Math.max(
        0,
        this.options.maxFilesPerBatch
      );

    const seen =
      new Set();

    const deduplicated =
      files
        .filter(
          (file) => {
            const fingerprint =
              fileFingerprint(
                file
              );

            if (
              seen.has(
                fingerprint
              )
            ) {
              return false;
            }

            seen.add(
              fingerprint
            );

            if (
              this.acceptedFingerprints.has(
                fingerprint
              ) ||
              this.pendingFingerprints.has(
                fingerprint
              )
            ) {
              return false;
            }

            return true;
          }
        )
        .slice(
          0,
          available
        );

    if (
      !deduplicated.length
    ) {
      return [];
    }

    deduplicated.forEach(
      (file) => {
        this.pendingFingerprints.add(
          fileFingerprint(
            file
          )
        );
      }
    );

    const run =
      this.batchQueue
        .catch(
          () => []
        )
        .then(
          () =>
            this.parseBatch(
              deduplicated,
              context
            )
        );

    this.batchQueue =
      run.catch(
        () => []
      );

    this.activeBatch =
      run.finally(
        () => {
          if (
            this.activeBatch ===
            run
          ) {
            this.activeBatch =
              null;
          }

          deduplicated.forEach(
            (file) => {
              this.pendingFingerprints.delete(
                fileFingerprint(
                  file
                )
              );
            }
          );
        }
      );

    return this.activeBatch;
  }

  async parseBatch(
    files,
    context
  ) {
    const batchId =
      "batch-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2);

    const batch = {
      id: batchId,
      source:
        String(
          context?.source ||
          "unknown"
        ),
      total:
        files.length,
      completed: 0,
      imported: 0,
      failed: 0
    };

    this.emit(
      "batch:start",
      batch
    );

    const results =
      new Array(
        files.length
      );

    let nextInjectIndex = 0;

    const flushReady =
      () => {
        while (
          nextInjectIndex <
            results.length &&
          results[nextInjectIndex]
        ) {
          const record =
            results[
              nextInjectIndex
            ];

          if (
            record.ok &&
            !record.injected
          ) {
            try {
              injectMetadataRecord(
                this.engine,
                record,
                this.options
              );

              record.injected =
                true;

              batch.imported +=
                1;

              this.records.push(
                record
              );

              this.metadata.push(
                record.metadata
              );

              this.acceptedFingerprints.add(
                fileFingerprint(
                  record.file
                )
              );

              this.emit(
                "file:injected",
                {
                  batch,
                  record
                }
              );
            } catch (error) {
              record.ok =
                false;

              record.error =
                error;

              this.emit(
                "file:error",
                {
                  batch,
                  record
                }
              );
            }
          }

          nextInjectIndex +=
            1;
        }
      };

    await mapWithConcurrency(
      files,
      this.options.parseConcurrency,
      async (file, index) => {
        this.emit(
          "file:parse-start",
          {
            batch,
            file,
            index
          }
        );

        let result;

        try {
          result =
            await parseOneFile(
              file,
              this.options
            );

          results[index] = {
            ...result,
            index,
            batchId
          };

          this.emit(
            "file:parsed",
            {
              batch,
              result:
                results[index]
            }
          );
        } catch (error) {
          results[index] = {
            ok: false,
            index,
            file,
            batchId,
            error
          };

          this.emit(
            "file:error",
            {
              batch,
              record:
                results[index]
            }
          );
        }

        batch.completed +=
          1;

        flushReady();

        return results[index];
      }
    );

    flushReady();

    batch.failed =
      results.filter(
        (result) =>
          !result?.ok
      ).length;

    batch.imported =
      results.filter(
        (result) =>
          result?.injected
      ).length;

    this.emit(
      "batch:complete",
      {
        ...batch,
        results
      }
    );

    return results;
  }

  emit(
    name,
    payload
  ) {
    try {
      this.root.dispatchEvent(
        new CustomEvent(
          "novacut-media:" +
          name,
          {
            detail:
              payload
          }
        )
      );
    } catch (_) {
      // Event delivery must not break media ingestion.
    }

    emitEngineEvent(
      this.engine,
      "media:" +
      name,
      payload
    );
  }

  reportError(
    scope,
    error
  ) {
    const normalized =
      error instanceof Error
        ? error
        : new Error(
            String(
              error
            )
          );

    this.emit(
      "error",
      {
        scope,
        error:
          normalized
      }
    );

    try {
      this.engine.reportError(
        "media:" +
        scope,
        normalized
      );
    } catch (_) {
      // Error reporting must remain non-throwing.
    }
  }

  getMetadataArray() {
    return [
      ...this.metadata
    ];
  }

  getRecords() {
    return [
      ...this.records
    ];
  }

  clearMetadata() {
    this.metadata.length =
      0;

    this.records.length =
      0;

    this.acceptedFingerprints.clear();
  }

  dispose() {
    if (
      this.isDisposed
    ) {
      return;
    }

    this.isDisposed =
      true;

    if (
      this.pendingPicker
    ) {
      this.pendingPicker.resolve(
        []
      );

      this.pendingPicker =
        null;
    }

    this.abortController.abort();

    this.input =
      null;

    this.root =
      null;

    this.engine =
      null;
  }
}

export function createNovaCutMediaParser(
  root,
  engine,
  options = {}
) {
  return new NovaCutMediaParser(
    root,
    engine,
    options
  );
}

export function attachNovaCutMediaParser(
  root,
  engine,
  options = {}
) {
  return createNovaCutMediaParser(
    root,
    engine,
    options
  );
}
