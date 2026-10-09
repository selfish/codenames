"""Exercise v4.9.0 receiver protection using real GNU rsync, without Git/publishing."""
from pathlib import Path
import subprocess
import tempfile
import unittest

from scripts.check_production_build import check_build, PROTECTED


class ProductionBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'build'
        self.target = Path(self.temp.name) / 'pages'
        self.source.mkdir()
        self.target.mkdir()

    def write(self, root, name, content):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def sync(self):
        # Exact effective flags from the pinned action's src/git.ts for this
        # root deployment: no target-folder; hosting excludes depend on source.
        subprocess.run(['rsync', '-q', '-av', '--checksum', '--progress',
                        str(self.source) + '/.', str(self.target), '--delete',
                        '--filter', 'P pr-preview/', '--filter', 'P CNAME',
                        '--filter', 'P .nojekyll',
                        *[arg for name in ['CNAME', '.nojekyll']
                          if not (self.source / name).exists() for arg in ['--exclude', name]],
                        '--exclude', '.ssh',
                        '--exclude', '.git', '--exclude', '.github'], check=True,
                       capture_output=True)

    def test_preserves_nested_previews_and_hosting_files_removes_stale_production(self):
        protected = {'pr-preview/pr-14/index.html': b'fourteen',
                     'pr-preview/pr-14/static/js/main.js': b'nested js',
                     'pr-preview/pr-18/index.html': b'eighteen',
                     'pr-preview/pr-18/deep/nested/icon.png': b'icon',
                     'CNAME': b'codenames.nit.ai\n', '.nojekyll': b''}
        for name, content in protected.items():
            self.write(self.target, name, content)
        self.write(self.target, 'index.html', b'old')
        self.write(self.target, 'static/js/stale.js', b'stale')
        self.write(self.source, 'index.html', b'new')
        self.write(self.source, 'static/js/new.js', b'new js')
        check_build(self.source)
        self.sync()
        expected = protected | {'index.html': b'new', 'static/js/new.js': b'new js'}
        actual = {p.relative_to(self.target).as_posix(): p.read_bytes()
                  for p in self.target.rglob('*') if p.is_file()}
        self.assertEqual(actual, expected)

    def test_receiver_protection_alone_allows_preview_overwrite(self):
        for name in ['pr-preview/pr-14/index.html', 'CNAME', '.nojekyll']:
            with self.subTest(name=name):
                self.write(self.target, name, b'approved')
                self.write(self.source, name, b'collision')
                with self.assertRaises(ValueError):
                    check_build(self.source)
                # Negative control proves why the guard must precede the action.
                self.sync()
                self.assertEqual((self.target / name).read_bytes(), b'collision')

    def test_rejects_protected_names_at_any_depth_and_symlinks(self):
        for prefix in ['', 'nested/']:
            for name in PROTECTED:
                for kind in ['file', 'directory', 'broken_symlink']:
                    with self.subTest(prefix=prefix, name=name, kind=kind):
                        path = self.source / (prefix + name)
                        path.parent.mkdir(parents=True, exist_ok=True)
                        if kind == 'file':
                            path.write_text('collision')
                        elif kind == 'directory':
                            path.mkdir()
                        else:
                            path.symlink_to('missing')
                        with self.assertRaises(ValueError):
                            check_build(self.source)
                        if kind == 'directory':
                            path.rmdir()
                        else:
                            path.unlink()
        (self.source / 'ordinary-link').symlink_to('missing')
        with self.assertRaises(ValueError):
            check_build(self.source)

    def test_rejects_missing_or_symlink_build_root(self):
        with self.assertRaises(ValueError):
            check_build(self.source / 'missing')
        link = self.source / 'link'
        link.symlink_to(self.target)
        with self.assertRaises(ValueError):
            check_build(link)
