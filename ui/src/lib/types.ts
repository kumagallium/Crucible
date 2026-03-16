// API レスポンス型定義

export interface Server {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  github_url: string;
  branch: string;
  subdir: string;
  group: "default" | "user";
  port: number;
  static_ip: string;
  status: "running" | "stopped" | "error" | "deploying";
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
  github_url: string;
  branch: string;
  subdir: string;
  github_token: string;
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
