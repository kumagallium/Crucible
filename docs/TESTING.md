# テスト概要

## CI

GitHub Actions で push / PR 時に自動実行される。
結果は Actions の Summary タブにカバレッジテーブルとして表示。

```
.github/workflows/test.yml
```

---

## Python API テスト

```bash
cd api && pip install -r requirements.txt && pip install pytest pytest-cov httpx
pytest
```

### テストファイル一覧

| ファイル | 件数 | 対象 |
|---------|------|------|
| `test_models.py` | 26 | Pydantic バリデーション |
| `test_crypto.py` | 10 | AES-256-GCM 暗号化・復号 |
| `test_registry.py` | 29 | レジストリ管理（ファイル I/O, ポート/IP 割り当て） |
| `test_main.py` | 30 | FastAPI エンドポイント・認証・ジョブ管理 |
| `test_deployer.py` | 48 | デプロイロジック全段階 |

### 各モジュールのテスト内容

**test_models.py** — 入力バリデーション
- サーバー名: 小文字英数字+ハイフン、3〜50文字、None 許可
- GitHub URL: `https://github.com/...` 形式のみ
- ブランチ名: パス走査（`..`）やシェルメタ文字の拒否
- 環境変数名: 英字/アンダースコア始まり、不正文字の拒否
- ServerRecord / DeployJob / LogsResponse のデフォルト値

**test_crypto.py** — セキュリティ
- 暗号化 → 復号のラウンドトリップ
- 空文字列の処理
- nonce のランダム性（同じ平文でも毎回異なる暗号文）
- 改ざん検知、不正 Base64、キー不一致 → 空文字返却
- Unicode / 長いトークンの対応

**test_registry.py** — データ永続化
- JSON ファイルの読み書き（flock ロック）
- CRUD 操作（get_all, get, upsert, delete, exists）
- ポート割り当て（default: 8001〜, user: 8100〜、Docker 使用中ポートのスキップ）
- IP 割り当て（同上）
- 枯渇時の RuntimeError

**test_main.py** — API エンドポイント
- 認証: API キー未設定時のスキップ、有効/無効キー、ヘッダー欠落
- GET /health, GET /api/settings
- GET /api/servers（一覧）、GET /api/servers/{name}（詳細、404）
- POST /api/servers（202 ジョブ作成、409 重複、422 バリデーション）
- DELETE /api/servers/{name}、POST /api/servers/{name}/restart
- GET /api/jobs/{job_id}、GET /api/jobs/{job_id}/logs（offset 対応）
- バックグラウンドスレッドの完了確認

**test_deployer.py** — デプロイフロー（全て外部依存モック）
- `_run` / `_run_stream`: コマンド実行、エラー処理、トークンのログマスク
- `_resolve_request_from_mcp_json`: 未入力フィールドの自動補完
- `_clone_repo`: 公開/プライベートリポ、トークン埋め込み
- `_detect_transport`: auto/sse/stdio の判定
- `_patch_fastmcp_enabled`: FastMCP 3.x 互換パッチ
- `_build_image`: Docker ビルド（サブディレクトリ対応）
- `_start_container`: 既存コンテナ削除、ネットワーク選択
- `_health_check`: HTTP 応答確認、タイムアウト＝ストリーミング判定、リトライ
- `_register_dify` / `_unregister_dify`: Dify 登録・解除
- `deploy()`: フルフロー成功、重複チェック、mcp.json なし
- `remove()` / `restart()` / `refresh_statuses()`

### モック戦略

外部サービスなしで CI 完結:

| 外部依存 | モック方法 |
|---------|----------|
| Docker | `unittest.mock.patch("subprocess.run")` |
| Git | 同上 |
| ファイル I/O | `tmp_path` fixture |
| HTTP (requests) | `patch.dict("sys.modules", ...)` |
| Dify DB (psql) | subprocess モック |

---

## TypeScript UI テスト

```bash
cd ui && npm install && npm test
```

### テストファイル一覧

| ファイル | 件数 | 対象 |
|---------|------|------|
| `lib/utils.test.ts` | 5 | CSS ユーティリティ (cn) |
| `lib/api.test.ts` | 14 | API クライアント関数 |
| `app/api/proxy.test.ts` | 7 | バックエンドプロキシ |

### 各モジュールのテスト内容

**utils.test.ts** — CSS クラス結合
- 単一/複数クラス、Tailwind 競合解決、falsy 除外、条件付きクラス

**api.test.ts** — API クライアント
- `fetchServers` / `fetchHealth`: 成功、エラー時の例外
- `registerServer`: 成功、文字列 detail エラー、配列 detail（バリデーションエラー）、JSON パース失敗時のフォールバック
- `restartServer` / `deleteServer` / `fetchJobLogs`: 成功、エラー、offset パラメータ

**proxy.test.ts** — Next.js → FastAPI プロキシ
- `proxyGet` / `proxyPost` / `proxyDelete`: リクエスト転送、API キーヘッダー付与、ステータスコード透過、バックエンド到達不可時の 502
