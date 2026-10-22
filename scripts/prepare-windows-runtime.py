"""Fetch the pinned official Node Windows runtime and verify its published SHA-256."""
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile
import hashlib, json, io
VERSION='v24.22.1'
ARCHIVE=f'node-{VERSION}-win-x64.zip'
BASE=f'https://nodejs.org/dist/{VERSION}/'
cache=Path('windows/runtime-cache');cache.mkdir(parents=True,exist_ok=True)
checks=urlopen(BASE+'SHASUMS256.txt',timeout=45).read().decode()
expected=next(line.split()[0] for line in checks.splitlines() if line.split()[-1]==ARCHIVE)
data=urlopen(BASE+ARCHIVE,timeout=60).read()
actual=hashlib.sha256(data).hexdigest()
if actual != expected: raise RuntimeError('Official Node archive checksum mismatch')
with ZipFile(io.BytesIO(data)) as archive:
    for name in ['node.exe','LICENSE']:
        (cache/name).write_bytes(archive.read(f'node-{VERSION}-win-x64/{name}'))
manifest={'version':VERSION,'architecture':'windows-x64','url':BASE+ARCHIVE,'archiveSha256':actual,'nodeExeSha256':hashlib.sha256((cache/'node.exe').read_bytes()).hexdigest()}
(cache/'runtime-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Official runtime verified:', VERSION, actual, len(data), 'bytes')
