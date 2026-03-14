"""
git ログからリリースノート JSON を生成するスクリプト。
registry/ui/release_notes.json に出力する。

使い方:
  python registry/ui/generate_release_notes.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys


def generate(count: int = 50) -> list[dict]:
    """git log から直近 count 件のコミットを取得してリストで返す"""
    # このスクリプトが置かれているディレクトリの親（registry/）を基準にリポジトリルートを探す
    repo_root = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()

    result = subprocess.run(
        ["git", "log", "--pretty=format:%H|||%s|||%ci", f"-{count}"],
        capture_output=True, text=True, check=True, cwd=repo_root,
    )

    commits = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|||", 2)
        if len(parts) != 3:
            continue
        sha, msg, date = parts
        commits.append({
            "sha": sha[:7],
            "message": msg,
            "date": date[:10],
        })
    return commits


def main() -> None:
    commits = generate()
    out_path = os.path.join(os.path.dirname(__file__), "public", "release_notes.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(commits, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(commits)} 件のコミットを {out_path} に出力しました")


if __name__ == "__main__":
    main()
