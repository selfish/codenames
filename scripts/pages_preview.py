"""Validate static build data and stage only an approved Pages subdirectory."""

import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

APPROVED = {
    14: "eb34cc11e28aba93d4bba286f2b79b090f4d820e",
    18: "e95be1cc484bd335c5910528e58aba5628b71d09",
}
NOINDEX = '<meta name="robots" content="noindex, nofollow, noimageindex">'


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args])


def stage_preview(source, pages, number, head):
    if APPROVED.get(number) != head:
        raise ValueError("Preview is not approved for this exact PR and commit")
    source, pages = Path(source).resolve(), Path(pages).resolve()
    if git(pages, "status", "--porcelain").strip():
        raise ValueError("Pages checkout must be clean")
    prefix = f"pr-preview/pr-{number}"
    # Neither existing Pages content nor downloaded files may redirect writes.
    for ancestor in (pages / "pr-preview", pages / prefix):
        if ancestor.is_symlink():
            raise ValueError("Preview destination cannot be a symlink")
    files = []
    total = 0
    for path in source.rglob("*"):
        relative = path.relative_to(source)
        if path.is_symlink() or any(part.startswith(".") for part in relative.parts):
            raise ValueError("Hidden files and symlinks are not publishable")
        if path.is_dir():
            continue
        if not path.is_file() or path.suffix.lower() == ".map" or path.name == "CNAME":
            raise ValueError("Unexpected preview artifact")
        if not re.fullmatch(r"[A-Za-z0-9_./-]+", relative.as_posix()):
            raise ValueError("Unexpected artifact filename")
        total += path.stat().st_size
        files.append(path)
    if not files or total > 25 * 1024 * 1024 or len(files) > 1000:
        raise ValueError("Unexpected preview artifact size")
    if not (source / "index.html").is_file():
        raise ValueError("Preview must have index.html")
    prepared = {}
    for path in files:
        relative = path.relative_to(source).as_posix()
        content = path.read_bytes()
        if path.suffix.lower() == ".html":
            html = content.decode("utf-8")
            if "</head>" not in html:
                raise ValueError("Preview HTML must have a head element")
            # Apply to build output only; production source remains unchanged.
            html = html.replace("</head>", NOINDEX + "</head>", 1)
            if relative == "index.html" and f"/{prefix}/static/" not in html:
                raise ValueError("Build assets must use the approved preview prefix")
            content = html.encode("utf-8")
        elif relative in ("manifest.json", "site.webmanifest"):
            manifest = json.loads(content)
            manifest["start_url"] = "./"
            manifest["scope"] = "./"
            for icon in manifest.get("icons", []):
                icon["src"] = icon["src"].lstrip("/")
            content = (json.dumps(manifest, indent=2) + "\n").encode()
        prepared[relative] = content
    prepared["preview.json"] = (json.dumps({"pull_request": number, "head": head}) + "\n").encode()
    target = pages / prefix
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for relative, content in prepared.items():
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    git(pages, "add", "--", prefix)
    changed = git(pages, "diff", "--cached", "--name-only", "-z").decode().split("\0")
    if any(name and not name.startswith(prefix + "/") for name in changed):
        raise ValueError("Refusing changes outside the approved preview directory")
    git(pages, "diff", "--cached", "--check")
    print("Validated preview; production and unrelated preview files are unchanged.")


if __name__ == "__main__":
    stage_preview(sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4])
