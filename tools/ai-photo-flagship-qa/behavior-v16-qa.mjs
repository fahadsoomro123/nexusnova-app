import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2);
const sourcePath='tools/ai-photo-flagship-qa/behavior-qa.mjs';
const source=fs.readFileSync(sourcePath,'utf8');
const stale=`await expect('Quick Tools','Remove BG Reset Auto remains available','return !document.querySelector(\"[data-nxqt-refine-undo]\").disabled&&document.querySelector(\"[data-nxqt-refine-feather]\").value===\"0\";');`;
const current=`await expect('Quick Tools','Remove BG reset preserves active refinement baseline','const undo=document.querySelector(\"[data-nxqt-refine-undo]\"),feather=document.querySelector(\"[data-nxqt-refine-feather]\"),reset=document.querySelector(\"[data-nxqt-refine-reset]\"),ml=!!document.querySelector(\".nx-ml-refine\");return !!undo&&!!feather&&!undo.disabled&&feather.value===(ml?\"1\":\"0\")&&/Reset (AI|Auto)/.test(reset?.textContent||\"\");');`;
const staleTemplate=`await expect('Templates','Approved preview matches actual editable design','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d?.templateId===\"nx-approved-featured-photo-portrait\"&&d.elements?.[0]?.sourceCrop?.x===0&&d.elements?.[0]?.sourceCrop?.w===0.25;');`;
const currentTemplate=`await expect('Templates','Approved featured design opens as structured editable layers','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d?.templateId===\"nx-approved-featured-photo-portrait\"&&d.elements?.length>=10&&d.elements.some(e=>e.role===\"Headline\"&&e.type===\"text\")&&d.elements.some(e=>e.role===\"Product photo\"&&e.type===\"photo\")&&!d.elements.some(e=>String(e.src||\"\").includes(\"locked-featured.webp\"));');`;
if(!source.includes(stale))throw new Error('V16 behavior wrapper could not find the exact stale Remove BG reset assertion. Refusing to weaken or silently skip the suite.');
if(source.split(stale).length!==2)throw new Error('V16 behavior wrapper found the stale Remove BG reset assertion more than once.');
if(!source.includes(staleTemplate))throw new Error('V16 behavior wrapper could not find the exact flattened featured-template assertion.');
if(source.split(staleTemplate).length!==2)throw new Error('V16 behavior wrapper found the flattened featured-template assertion more than once.');
const patched=source.replace(stale,current).replace(staleTemplate,currentTemplate);
const temp=path.join(os.tmpdir(),`nexusnova-behavior-v16-${process.pid}.mjs`);
try{
  fs.writeFileSync(temp,patched);
  const run=spawnSync(process.execPath,[temp,...args],{stdio:'inherit'});
  if(run.error)throw run.error;
  process.exitCode=run.status??1;
}finally{
  try{fs.unlinkSync(temp)}catch{}
}
