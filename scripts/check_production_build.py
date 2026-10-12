"""Reject source collisions with namespaces preserved by Pages deployment."""
import sys
from pathlib import Path

PROTECTED = {'pr-preview', 'CNAME', '.nojekyll'}


def check_build(root):
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Build must be a real directory')
    # rsync's unanchored protection patterns also match nested paths.
    for entry in root.rglob('*'):
        if entry.name in PROTECTED or entry.is_symlink():
            raise ValueError(f'Unsafe production build path: {entry.relative_to(root)}')


if __name__ == '__main__':
    try:
        check_build(sys.argv[1])
    except ValueError as error:
        sys.exit(str(error))
