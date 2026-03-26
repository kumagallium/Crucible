# Crucible Registry — デザインシステム

> **Source of Truth**: このファイルは Registry UI のデザインシステムの正式な定義書。
> コンポーネント実装時は必ずこのファイルを参照すること。

---

## 1. ブランドアイデンティティ

| 項目 | 値 |
|------|-----|
| プロダクト名 | Crucible（るつぼ） |
| コンセプト | 多様な MCP サーバーが一つの場所に集まり、AI エージェントの力へと変わる器 |
| キーワード | **誠実** · **やさしい** · **モダン** · **シンプル** · **居心地の良さ** |
| ターゲット | 内部チーム + 外部ユーザー（丁寧さ・わかりやすさを重視） |

---

## 2. カラーシステム

### 2.1 ベーストークン（`globals.css` @theme で定義）

| トークン | 値 | 用途 |
|---------|-----|------|
| `--color-background` | `#fafdf7` | ページ背景（温かみのあるオフホワイト） |
| `--color-foreground` | `#1a2e1d` | テキスト基本色（深いグリーンブラック） |
| `--color-card` | `#ffffff` | カード背景 |
| `--color-card-foreground` | `#1a2e1d` | カード内テキスト |
| `--color-primary` | `#4B7A52` | ブランドカラー（フォレストグリーン） |
| `--color-primary-foreground` | `#ffffff` | プライマリー上のテキスト |
| `--color-secondary` | `#f0f5ef` | セカンダリー背景 |
| `--color-secondary-foreground` | `#2d4a32` | セカンダリーテキスト |
| `--color-muted` | `#f0f5ef` | ミュート背景 |
| `--color-muted-foreground` | `#4a6350` | ミュートテキスト |
| `--color-accent` | `#e8f0e8` | アクセント背景 |
| `--color-accent-foreground` | `#2d4a32` | アクセントテキスト |
| `--color-destructive` | `#ef4444` | 破壊的操作 |
| `--color-destructive-text` | `#dc2626` | 破壊的テキスト |
| `--color-border` | `#d5e0d7` | ボーダー（淡いグリーングレー） |
| `--color-input` | `#d5e0d7` | 入力フィールドボーダー |
| `--color-ring` | `#4B7A52` | フォーカスリング |

### 2.2 ステータストークン

各ステータスには 4 つのバリエーションがある: `text` / `bg` / `bg-deep` / `border`

| ステータス | テキスト | 背景 | 背景(深) | ボーダー |
|-----------|---------|------|---------|---------|
| **Running** | `#2e7d32` | `#e8f5e9` | `#c8e6c9` | `#a5d6a7` |
| **Stopped** | stone-500 相当 | stone-100 相当 | stone-200 相当 | stone-200 相当 |
| **Error** | `#dc2626` | red-50 相当 | red-200 相当 | red-200 相当 |
| **Deploying** | sky-700 相当 | sky-50 相当 | sky-200 相当 | sky-200 相当 |

**Tailwind での使い方:**
```tsx
// テキスト
className="text-status-running"
// 背景
className="bg-status-running-bg"
// グラデーション
className="bg-gradient-to-br from-status-running-bg to-status-running-bg-deep"
// ボーダー
className="border-status-running-border"
```

### 2.3 セマンティックトークン

| 用途 | テキスト | 背景 | ボーダー |
|------|---------|------|---------|
| **Success** | `#2d4a32` | `#edf5ee` | `#b8d4bb` |
| **Warning** | amber-700 相当 | amber-50 相当 | amber-200 相当 |
| **Info** | sky-700 相当 | sky-50 相当 | sky-200 相当 |

**Tailwind での使い方:**
```tsx
className="bg-success-bg text-success border-success-border"
className="bg-warning-bg text-warning border-warning-border"
className="bg-info-bg text-info border-info-border"
```

### 2.4 色の使用ルール

- **ハードコード禁止**: `#2e7d32` や `bg-red-50` ではなく、必ずトークンを使用
- **Tailwind 任意値禁止**: `bg-[#e8f5e9]` ではなく `bg-status-running-bg`
- **色だけで情報を伝えない**: アイコン・テキストを併用する

---

## 3. タイポグラフィ

### 3.1 フォントファミリー

| 用途 | フォント |
|------|---------|
| 本文 | Inter（Google Fonts） |
| コード | `ui-monospace, 'SF Mono', monospace` |

### 3.2 テキストスケール（Tailwind クラスのみ使用）

| レベル | クラス | 用途 |
|--------|--------|------|
| ページタイトル | ロゴ画像 (`/logo.png`, 140×42) | ブランドロゴ |
| セクション見出し | `text-lg font-semibold` | タブ内の見出し |
| カードタイトル | `text-sm font-semibold` | サーバー名 |
| 本文 | `text-sm` | 説明文・フォーム要素 |
| 小文字 | `text-xs` | Badge・補足テキスト |
| キャプション | `text-xs text-muted-foreground` | 日付・ハッシュ |
| モノスペース | `text-xs font-mono` | エンドポイント・コード |

**禁止**: `text-[11px]`、`text-[10.5px]` 等の任意値

### 3.3 行間

| 用途 | 値 |
|------|-----|
| 本文 | `leading-relaxed`（1.625） |
| コードブロック | `leading-relaxed` |
| ヘッダー | デフォルト |

---

## 4. スペーシングシステム

### 4.1 基本単位: 4px（Tailwind の 1 = 0.25rem = 4px）

### 4.2 セクション間スペーシング

| 用途 | クラス | 値 |
|------|--------|-----|
| ページタイトル → 説明 | `mb-1` | 4px |
| 説明 → コンテンツ | `mb-6` | 24px |
| セクション間 | `space-y-4` | 16px |
| 見出し → コンテンツ | `mb-3` | 12px |
| フォームフィールド間 | `space-y-6` | 24px |
| フォームグリッド内 | `gap-3` | 12px |
| カードグリッド | `gap-4` | 16px |
| バッジグループ | `gap-1.5` | 6px |
| フィルターチップ | `gap-1.5` | 6px |

### 4.3 コンポーネント内パディング

| コンポーネント | クラス |
|---------------|--------|
| カード本体 | `px-4 pt-2.5 pb-2.5` |
| カードセクション | `p-6` |
| カードフッター | `px-3.5 py-2` |
| バナー | `px-3.5 pb-2` |
| コードブロック | `px-4 py-3` |
| ログ表示 | `p-3` |
| アラートボックス | `p-4` |

---

## 5. 角丸（Border Radius）

| コンポーネント | クラス | 値 |
|---------------|--------|-----|
| カード | `rounded-xl` | 12px |
| ボタン | `rounded-lg` | 8px |
| 入力フィールド | `rounded-lg` | 8px |
| セレクト | `rounded-lg` | 8px |
| テキストエリア | `rounded-lg` | 8px |
| ダイアログ | `rounded-xl` | 12px |
| コードブロック | `rounded-lg` | 8px |
| Badge | `rounded-full` | 9999px |
| アイコン背景 | `rounded-lg` | 8px |

**ルール**: `rounded-md` は使用しない。`rounded-lg` 以上を使用する。

---

## 6. 影（Shadow）

| コンポーネント | 通常 | ホバー |
|---------------|------|--------|
| カード | `shadow-sm` | `shadow-md` |
| ダイアログ | `shadow-lg` | — |
| ドロップダウン | `shadow-md` | — |
| ボタン | なし | なし |

---

## 7. トランジション

| 用途 | クラス |
|------|--------|
| 色変化 | `transition-colors duration-200` |
| 全プロパティ | `transition-all duration-200` |
| 透明度（コピーボタン等） | `transition-opacity` |

---

## 8. コンポーネントパターン

### 8.1 ページヘッダー

```tsx
<h2 className="text-lg font-semibold mb-1">{title}</h2>
<p className="text-sm text-muted-foreground mb-6">{description}</p>
```

### 8.2 セクションカード

```tsx
<section className="rounded-xl border bg-card p-6">
  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    {title}
  </h3>
  {children}
</section>
```

### 8.3 空状態

```tsx
<div className="text-center py-16 px-8 bg-muted border border-dashed rounded-xl">
  <Icon className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
  <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
  <p className="text-xs text-muted-foreground">{hint}</p>
</div>
```

### 8.4 フィルターチップ

```tsx
<button className={cn(
  "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border transition-all duration-200",
  isActive
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
)}>
```

### 8.5 アラート

| タイプ | クラス |
|--------|--------|
| 成功 | `bg-success-bg border-success-border` + `text-success` |
| エラー | `bg-status-error-bg border-status-error-border` + `text-status-error` |
| 警告 | `bg-warning-bg border-warning-border` + `text-warning` |
| 情報 | `bg-info-bg border-info-border` + `text-info` |

### 8.6 コードブロック

```tsx
<pre className="text-xs font-mono bg-muted border rounded-lg px-4 py-3 overflow-x-auto leading-relaxed">
  {code}
</pre>
```

### 8.7 ログ表示（ダークターミナル）

```tsx
<div className="h-56 overflow-y-auto rounded-lg border bg-stone-900 text-stone-400 font-mono text-xs leading-relaxed p-3 whitespace-pre-wrap break-all">
  {logs}
</div>
```

---

## 9. バッジバリアント

| バリアント | 用途 | Tailwind クラス |
|-----------|------|----------------|
| `running` | サーバー稼働中 | `border-status-running-border bg-status-running-bg text-status-running` |
| `stopped` | サーバー停止 | `border-status-stopped-border bg-status-stopped-bg text-status-stopped` |
| `error` | エラー | `border-status-error-border bg-status-error-bg text-status-error` |
| `deploying` | デプロイ中 | `border-status-deploying-border bg-status-deploying-bg text-status-deploying` |
| `official` | 公式グループ | `border-success-border bg-success-bg text-success` |
| `community` | コミュニティ | `border-warning-border bg-warning-bg text-warning` |
| `difyOk` | Dify 登録済み | `border-success-border bg-success-bg text-success` |
| `difyNg` | Dify 未登録 | `border-status-stopped-border bg-status-stopped-bg text-status-stopped` |
| `port` | ポート番号 | `border-status-stopped-border bg-status-stopped-bg text-status-stopped font-mono` |

---

## 10. レイアウト

### 10.1 グローバルレイアウト

```
┌─────────────────────────────────────────┐
│ Header (h-14, border-b)                 │
│  [Logo]                      [Nav] [EN] │
├─────────────────────────────────────────┤
│ Main (max-w-[1200px], px-6, py-6)      │
│                                         │
│  コンテンツ                              │
│                                         │
└─────────────────────────────────────────┘
```

### 10.2 レスポンシブグリッド

| 画面幅 | カラム数 |
|--------|---------|
| モバイル (< 768px) | 1列 |
| タブレット (768px+) | 2列 |
| デスクトップ (1024px+) | 3列 |

```tsx
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
```

### 10.3 コンテンツ幅制限

| 用途 | クラス |
|------|--------|
| メインコンテンツ | `max-w-[1200px]` |
| 読み物ページ（Guide, About） | `max-w-3xl mx-auto` |

---

## 11. インタラクションパターン

### 11.1 ホバー

| 要素 | 効果 |
|------|------|
| カード | `hover:shadow-md hover:border-primary/30` |
| ナビリンク | `hover:text-foreground hover:bg-accent/50` |
| ゴーストボタン | `hover:bg-accent hover:text-accent-foreground` |
| リスト行 | `hover:bg-accent` |

### 11.2 アクティブ状態

| 要素 | 効果 |
|------|------|
| ナビリンク | `text-foreground bg-accent` |
| フィルターチップ | `bg-primary text-primary-foreground border-primary` |

### 11.3 無効状態

```tsx
disabled:pointer-events-none disabled:opacity-50
```

### 11.4 フォーカス

```tsx
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

---

## 12. アイコン

- **ライブラリ**: Lucide React
- **サイズ規約**:
  - セクション見出しアイコン: `h-4 w-4`
  - ボタン内アイコン: `h-4 w-4`（自動、`[&_svg]:size-4`）
  - 小さいボタン内: `h-3 w-3`
  - 空状態アイコン: `h-9 w-9`
  - アラートアイコン: `h-6 w-6`
- **色**: セクション見出しでは `text-muted-foreground`
- **絵文字は UI アイコンとして使わない**（サーバーの `icon` フィールドは例外）

---

## 13. アクセシビリティ

- すべてのインタラクティブ要素に `focus-visible` リングを設定
- 画像には `alt` テキストを設定
- フォームフィールドには `<Label htmlFor>` を設定
- 破壊的操作はダイアログで確認
- ボーダー・テキストのコントラスト比は WCAG AA（4.5:1）以上を目標
- ステータスは色 + テキスト + アイコンで伝達（色のみに依存しない）

---

## 14. アンチパターン（やってはいけないこと）

| カテゴリ | 禁止事項 |
|---------|---------|
| 色 | ハードコードの hex 値（`#2e7d32`）、Tailwind 任意値（`bg-[#e8f5e9]`） |
| 角丸 | `rounded-md`（`rounded-lg` 以上を使用） |
| テキスト | 任意サイズ値（`text-[11px]`） |
| アイコン | 構造的 UI に絵文字を使用 |
| スペーシング | 規約外の任意値（`p-[13px]`） |
| レイアウト | 水平スクロール、固定 px 幅のコンテナ |
| 色の伝達 | 色のみで情報を表現（テキスト・アイコンの併用必須） |
