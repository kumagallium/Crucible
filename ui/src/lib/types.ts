// API レスポンス型定義

export type ToolType = "mcp_server" | "cli_library" | "skill";

export interface Server {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  github_url: string;
  branch: string;
  subdir: string;
  tool_type?: ToolType;
  group: "default" | "user";
  port: number;
  static_ip: string;
  install_command?: string;
  status: "running" | "stopped" | "error" | "deploying" | "registered";
  created_at: string;
  updated_at: string;
  error_message: string | null;
  dify_registered: boolean;
  endpoint_path?: string;
}

export interface RegisterRequest {
  name?: string | null;
  display_name?: string | null;
  description: string;
  icon: string;
  github_url?: string;
  branch?: string;
  subdir?: string;
  tool_type?: ToolType;
  install_command?: string;
  content?: string;
  github_token?: string;
  group: "default" | "user";
  dify_auto_register: boolean;
  env_vars: Record<string, string>;
}

export interface JobResponse {
  job_id: string;
  server_name: string;
  status: string;
}

export interface LogsResponse {
  job_id: string;
  status: "pending" | "running" | "success" | "error";
  logs: string[];
  total: number;
}

export interface ReleaseNote {
  sha: string;
  message: string;
  date: string;
}

export type ServerStatus = Server["status"];
export type ServerGroup = Server["group"];

// --- e4m MCP カタログ ---

export interface CatalogTool {
  name: string;
  description: string;
  example?: string;
}

export interface CatalogEnvVar {
  name: string;
  description: string;
  required: boolean;
}

export interface CatalogEntry {
  id: number;
  name: string;
  description: string;
  author: string;
  repo: string;
  category_slug: string;
  category_label: string;
  tags: string[];
  install_command: string;
  tool_count: number;
  tools_json: CatalogTool[];
  env_vars_json: CatalogEnvVar[];
  config_json: Record<string, unknown>;
  trust_level: "e4m" | "official" | "verified" | "community";
  featured: boolean;
}

export interface CatalogCategory {
  id: number;
  slug: string;
  label: string;
}
