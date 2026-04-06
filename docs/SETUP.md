# GitHub Pages セットアップ手順

LP を公開するには、GitHub リポジトリの設定で GitHub Pages を有効化する必要があります（手動作業）。

## 手順

1. GitHub リポジトリの **Settings** を開く
2. 左メニューから **Pages** を選択
3. 以下を設定:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/docs`
4. **Save** をクリック

数分後に `https://kumagallium.github.io/Crucible/` で LP が公開されます。

## リポジトリ description の更新（推奨）

GitHub リポジトリの About（description）を以下に変更する:

```
Self-hosted AI tool management platform — deploy servers, register CLI libraries and skills from GitHub URLs. Works with private repos.
```
