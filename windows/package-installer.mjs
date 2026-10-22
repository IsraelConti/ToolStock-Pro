import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const stage = 'windows/installer-package';
const archive = 'MaintenPro_PC_1.2.9_CANDIDATO_2026-10-21.zip';

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function createZip(sourceDir, archivePath) {
  const source = path.resolve(sourceDir);
  const destination = path.resolve(archivePath);
  try {
    await execFileAsync('zip', ['-q9r', destination, '.', '-x', '.*', '*/.*'], { cwd: source });
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (process.platform !== 'win32') {
    throw new Error('No se encontró el comando zip para empaquetar el instalador.');
  }
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source = ${psQuote(source)}
$destination = ${psQuote(destination)}
if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
$archive = [System.IO.Compression.ZipFile]::Open($destination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($source.Length).TrimStart([char[]]@('\\', '/'))
    $entryName = $relative.Replace('\\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName)
  }
} finally {
  $archive.Dispose()
}
`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

await rm(stage, { recursive: true, force: true });
await mkdir(`${stage}/app`, { recursive: true });
await mkdir(`${stage}/installer`, { recursive: true });
await cp('windows/dist', `${stage}/app`, { recursive: true });
await cp('windows/installer/Instalar.ps1', `${stage}/installer/Instalar.ps1`);
await cp('windows/installer/Desinstalar.ps1', `${stage}/installer/Desinstalar.ps1`);
await cp('windows/Instalar_MaintenPro_PC.bat', `${stage}/Instalar_MaintenPro_PC.bat`);
await cp('windows/installer/LEEME_ANTES_DE_INSTALAR.txt', `${stage}/LEEME_ANTES_DE_INSTALAR.txt`);
await cp('INTEGRACION_1.2.9.md', `${stage}/ESTADO_Y_PRUEBAS_1.2.9.md`);
await rm(archive, { force: true });
await createZip(stage, archive);
const info = await stat(archive);
console.log(`Created ${archive} (${info.size} bytes)`);
if (!process.argv.includes('--keep-stage')) await rm(stage, { recursive: true, force: true });
