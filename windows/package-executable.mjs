import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {rm, stat} from 'node:fs/promises';
import path from 'node:path';
const run=promisify(execFile);
const output=path.resolve('MaintenPro_PC_1.2.9_Instalar.exe');
const stage=path.resolve('windows/installer-package');
try {
  await run(process.execPath,['windows/package-installer.mjs','--keep-stage']);
  await run(process.env.MAINTENPRO_MAKENSIS||'makensis',[
    '-V2',`-DOUTPUT=${output}`,`-DSTAGE=${stage}`,path.resolve('windows/installer/MaintenPro.nsi')
  ],{maxBuffer:1024*1024});
  console.log(`Created ${path.basename(output)} (${(await stat(output)).size} bytes)`);
} finally {await rm(stage,{recursive:true,force:true});}
