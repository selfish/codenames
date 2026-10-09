"""Create/verify deterministic fixtures independently across artifact jobs."""
import hashlib
from pathlib import Path
import sys

FILES = {
    'index.html': b'<!doctype html><title>Artifact fixture</title>\n',
    'static/js/main.js': b'console.log("round trip");\n',
    'static/media/icon.bin': bytes(range(256)),
    'nested/path with spaces/data.txt': b'nested fixture\n',
}


def main(mode, directory):
    root = Path(directory)
    if mode == 'create':
        for name, content in FILES.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        # upload-artifact's current default excludes hidden files.
        (root / '.excluded').write_text('must not be transferred')
    elif mode == 'verify':
        entries = list(root.rglob('*'))
        if any(p.is_symlink() for p in entries):
            raise ValueError('Unexpected artifact symlink')
        actual = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in entries if p.is_file()}
        expected = {name: hashlib.sha256(content).hexdigest() for name, content in FILES.items()}
        if actual != expected:
            raise ValueError(f'Artifact paths or hashes differ: {actual}')
        for name, digest in sorted(actual.items()):
            print(f'{digest}  {name}')
    else:
        raise ValueError('Expected create or verify')


if __name__ == '__main__':
    main(*sys.argv[1:])
