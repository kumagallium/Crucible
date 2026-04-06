// CatalogImport コンポーネントのストーリー
// e4m カタログからツールを検索・選択する UI

import type { Meta, StoryObj } from "@storybook/react";
import { CatalogImport } from "@/components/catalog-import";
import type { CatalogEntry, CatalogCategory } from "@/lib/types";

// モックデータ — e4m カタログの代表的なエントリ
const mockCategories: CatalogCategory[] = [
  { id: 1, slug: "materials", label: "材料科学" },
  { id: 2, slug: "chemistry", label: "化学・物理" },
  { id: 3, slug: "biology", label: "生命科学" },
  { id: 4, slug: "data", label: "データ・DB" },
  { id: 5, slug: "literature", label: "文献・知識" },
  { id: 6, slug: "web", label: "ウェブ・検索" },
  { id: 7, slug: "file", label: "ファイル・メモリ" },
  { id: 8, slug: "dev", label: "開発ツール" },
];

const mockEntries: CatalogEntry[] = [
  {
    id: 1,
    name: "E4M Utils",
    description: "汎用ユーティリティ — 単位変換・DOI文献フォーマット",
    author: "E4M",
    repo: "https://github.com/kumagallium/e4m-mcp",
    category_slug: "materials",
    category_label: "材料科学",
    tags: ["単位変換", "DOI", "文献", "Python"],
    install_command: "cd e4m-utils && uv sync",
    tool_count: 4,
    tool_types: ["mcp_server"],
    trust_level: "e4m",
    featured: true,
    tools_json: [
      { name: "e4m_convert_unit", description: "物理単位変換（pint ベース）" },
    ],
    env_vars_json: [],
    config_json: {},
    skill_content: "",
    cli_execution: {},
  },
  {
    id: 2,
    name: "E4M Materials",
    description: "科学計算 — 組成変換・体積/質量計算・元素物性",
    author: "E4M",
    repo: "https://github.com/kumagallium/e4m-mcp",
    category_slug: "materials",
    category_label: "材料科学",
    tags: ["組成変換", "元素", "科学計算", "Python"],
    install_command: "cd e4m-materials && uv sync",
    tool_count: 11,
    tool_types: ["mcp_server"],
    trust_level: "e4m",
    featured: true,
    tools_json: [],
    env_vars_json: [],
    config_json: {},
    skill_content: "",
    cli_execution: {},
  },
  {
    id: 3,
    name: "E4M Data",
    description: "外部データベース連携 — Materials Project・Starrydata",
    author: "E4M",
    repo: "https://github.com/kumagallium/e4m-mcp",
    category_slug: "data",
    category_label: "データ・DB",
    tags: ["Materials Project", "Starrydata", "データベース", "Python"],
    install_command: "cd e4m-data && uv sync",
    tool_count: 5,
    tool_types: ["mcp_server"],
    trust_level: "e4m",
    featured: true,
    tools_json: [],
    env_vars_json: [
      { name: "MP_API_KEY", description: "Materials Project API キー", required: true },
    ],
    config_json: {},
    skill_content: "",
    cli_execution: {},
  },
  {
    id: 4,
    name: "RDKit MCP Server",
    description: "化学情報学 — 分子描画・SMILES 変換・物性予測・部分構造検索",
    author: "tandemai-inc",
    repo: "https://github.com/tandemai-inc/rdkit-mcp-server",
    category_slug: "chemistry",
    category_label: "化学・物理",
    tags: ["RDKit", "SMILES", "分子", "化学情報学"],
    install_command: "pip install rdkit-mcp-server",
    tool_count: 10,
    tool_types: ["mcp_server", "cli_library"],
    trust_level: "community",
    featured: false,
    tools_json: [],
    env_vars_json: [],
    config_json: {},
    skill_content: "",
    cli_execution: {},
  },
  {
    id: 5,
    name: "GitHub MCP Server",
    description: "GitHub API — リポジトリ操作・Issue/PR 管理・コード検索",
    author: "GitHub",
    repo: "https://github.com/modelcontextprotocol/servers",
    category_slug: "dev",
    category_label: "開発ツール",
    tags: ["GitHub", "リポジトリ", "Issue", "PR"],
    install_command: "npx -y @modelcontextprotocol/server-github",
    tool_count: 20,
    tool_types: ["mcp_server", "cli_library"],
    trust_level: "official",
    featured: false,
    tools_json: [],
    env_vars_json: [
      { name: "GITHUB_PERSONAL_ACCESS_TOKEN", description: "GitHub PAT", required: true },
    ],
    config_json: {},
    skill_content: "",
    cli_execution: {},
  },
  {
    id: 6,
    name: "TogoMCP",
    description: "RDF ポータル — SPARQL・UniProt・PubChem 等の生物医学データベース統合アクセス",
    author: "DBCLS",
    repo: "https://github.com/dbcls/togomcp",
    category_slug: "biology",
    category_label: "生命科学",
    tags: ["RDF", "SPARQL", "UniProt", "PubChem", "ライフサイエンス"],
    install_command: "git clone && uv sync",
    tool_count: 11,
    tool_types: ["mcp_server", "cli_library"],
    trust_level: "community",
    featured: false,
    tools_json: [],
    env_vars_json: [
      { name: "NCBI_API_KEY", description: "NCBI E-utilities API キー", required: true },
    ],
    config_json: {},
    skill_content: "",
    cli_execution: {},
  },
];

// カタログ API をモックする loader
function createCatalogMock(entries: CatalogEntry[], categories: CatalogCategory[]) {
  return async () => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;

      if (url.includes("/api/catalog")) {
        return new Response(
          JSON.stringify({ servers: entries, categories }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return originalFetch(input, init);
    };
    return {};
  };
}

const meta = {
  title: "Components/CatalogImport",
  component: CatalogImport,
  parameters: {
    layout: "padded",
  },
  args: {
    onSelect: (entry: CatalogEntry) => console.log("Selected:", entry.name),
    toolType: "mcp_server",
  },
  loaders: [createCatalogMock(mockEntries, mockCategories)],
} satisfies Meta<typeof CatalogImport>;

export default meta;
type Story = StoryObj<typeof meta>;

/** デフォルト — 全カタログ表示 */
export const Default: Story = {};

/** 検索結果なし */
export const Empty: Story = {
  loaders: [createCatalogMock([], mockCategories)],
};

/** API エラー */
export const Error: Story = {
  loaders: [
    async () => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/catalog")) {
          return new Response(
            JSON.stringify({ detail: "e4m API unreachable" }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }
        return originalFetch(input, init);
      };
      return {};
    },
  ],
};
