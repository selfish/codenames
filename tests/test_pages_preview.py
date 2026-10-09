import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("pages_preview", Path(__file__).parents[1] / "scripts/pages_preview.py")
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


class PreviewSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pages, self.source = self.root / "pages", self.root / "build"
        self.pages.mkdir()
        self.source.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "selfish")
        self.git("config", "user.email", "7327741+selfish@users.noreply.github.com")
        for name, content in {"CNAME": "codenames.nit.ai", "index.html": "production", "robots.txt": "User-agent: *\nDisallow:\n", "pr-preview/pr-99/index.html": "unrelated", "pr-preview/pr-14/old.js": "stale"}.items():
            path = self.pages / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        self.git("add", ".")
        self.git("commit", "-qm", "Test fixture")
        (self.source / "index.html").write_text('<html><head><script src="/pr-preview/pr-14/static/main.js"></script></head></html>')
        (self.source / "manifest.json").write_text('{"icons":[{"src":"/icon.png"}]}')
        (self.source / "static").mkdir()
        (self.source / "static/main.js").write_text("void 0;")

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.pages), *args])

    def publish(self, number=14, head=preview.APPROVED[14]):
        preview.stage_preview(self.source, self.pages, number, head)

    def test_preserves_production_cname_and_unrelated_previews(self):
        before = {p.relative_to(self.pages): p.read_bytes() for p in self.pages.rglob("*") if p.is_file() and ".git" not in p.parts and "pr-14" not in p.parts}
        self.publish()
        for path, content in before.items():
            self.assertEqual((self.pages / path).read_bytes(), content)
        self.assertFalse((self.pages / "pr-preview/pr-14/old.js").exists())
        html = (self.pages / "pr-preview/pr-14/index.html").read_text()
        self.assertIn(preview.NOINDEX, html)
        manifest = preview.json.loads((self.pages / "pr-preview/pr-14/manifest.json").read_text())
        self.assertEqual(manifest["scope"], "./")
        self.assertEqual(manifest["icons"][0]["src"], "icon.png")
        self.assertTrue(all(p.startswith("pr-preview/pr-14/") for p in self.git("diff", "--cached", "--name-only").decode().splitlines()))

    def test_rejects_other_pr_or_commit(self):
        for number, head in [(99, preview.APPROVED[14]), (14, "0" * 40)]:
            with self.assertRaises(ValueError):
                self.publish(number, head)
        self.assertFalse(self.git("status", "--porcelain").strip())

    def test_rejects_dirty_destination(self):
        (self.pages / "CNAME").write_text("changed")
        with self.assertRaises(ValueError):
            self.publish()

    def test_rejects_artifact_symlink_without_changing_pages(self):
        (self.source / "escape.js").symlink_to(self.pages / "CNAME")
        with self.assertRaises(ValueError):
            self.publish()
        self.assertFalse(self.git("status", "--porcelain").strip())

    def test_rejects_destination_symlink(self):
        self.git("rm", "-qr", "pr-preview")
        (self.pages / "pr-preview").symlink_to(self.source, target_is_directory=True)
        self.git("add", ".")
        self.git("commit", "-qm", "Symlink fixture")
        with self.assertRaises(ValueError):
            self.publish()

    def test_rejects_source_map_hidden_file_or_cname(self):
        for name in ["main.js.map", ".gitconfig", "CNAME"]:
            path = self.source / name
            path.write_text("not publishable")
            with self.assertRaises(ValueError):
                self.publish()
            path.unlink()
            self.assertFalse(self.git("status", "--porcelain").strip())

    def test_rejects_root_asset_build_before_changes(self):
        (self.source / "index.html").write_text('<head><script src="/static/main.js"></script></head>')
        with self.assertRaises(ValueError):
            self.publish()
        self.assertFalse(self.git("status", "--porcelain").strip())

    def test_identical_publish_is_idempotent(self):
        self.publish()
        self.git("commit", "-qm", "Preview fixture")
        self.publish()
        self.assertFalse(self.git("status", "--porcelain").strip())


if __name__ == "__main__":
    unittest.main()
