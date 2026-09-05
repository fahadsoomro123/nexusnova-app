import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2);
const sourcePath='tools/ai-photo-flagship-qa/behavior-qa.mjs';
const source=fs.readFileSync(sourcePath,'utf8');
const stale=`await expect('Quick Tools','Remove BG Reset Auto remains available','return !document.querySelector(\"[data-nxqt-refine-undo]\").disabled&&document.querySelector(\"[data-nxqt-refine-feather]\").value===\"0\";');`;
const current=`await expect('Quick Tools','Remove BG reset preserves active refinement baseline','const undo=document.querySelector(\"[data-nxqt-refine-undo]\"),feather=document.querySelector(\"[data-nxqt-refine-feather]\"),reset=document.querySelector(\"[data-nxqt-refine-reset]\"),ml=!!document.querySelector(\".nx-ml-refine\");return !!undo&&!!feather&&!undo.disabled&&feather.value===(ml?\"1\":\"0\")&&/Reset (AI|Auto)/.test(reset?.textContent||\"\");');`;
if(!source.includes(stale))throw new Error('V16 behavior wrapper could not find the exact stale Remove BG reset assertion. Refusing to weaken or silently skip the suite.');
if(source.split(stale).length!==2)throw new Error('V16 behavior wrapper found the stale Remove BG reset assertion more than once.');
const patched=source.replace(stale,current);
const temp=path.join(os.tmpdir(),`nexusnova-behavior-v16-${process.pid}.mjs`);
try{
  fs.writeFileSync(temp,patched);
  const run=spawnSync(process.execPath,[temp,...args],{stdio:'inherit'});
  if(run.error)throw run.error;
  process.exitCode=run.status??1;
}finally{
  try{fs.unlinkSync(temp)}catch{}
}
