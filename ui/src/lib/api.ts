import type { Server, RegisterRequest, JobResponse, LogsResponse, CatalogEntry, CatalogCategory } from "./types";

// サーバーサイド: 環境変数から取得、クライアントサイド: /api プロキシ経由
const API_BASE =
  typeof window === "undefined"
    ? process.env.API_BASE_URL || "http://api:8000"
    : "";

const API_KEY = typeof window === "undefined" ? process.env.REGISTRY_API_KEY || "" : "";

function headers(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (API_KEY) h["X-API-Key"] = API_KEY;
  return h;
}

/** FastAPI の detail フィールドを人間が読める文字列に変換する */
function extractDetail(err: Record<string, unknown>): string {
  const d = err.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    // FastAPI バリデーションエラー: [{loc, msg, type}, ...]
    return d
      .map((e: Record<string, unknown>) => {
        const loc = Array.isArray(e.loc) ? e.loc.join(" → ") : "";
        return loc ? `${loc}: ${e.msg}` : String(e.msg);
      })
      .join("; ");
  }
  if (d && typeof d === "object") return JSON.stringify(d);
  return "";
}

// --- サーバーサイド用（Server Components / Route Handlers） ---

export async function fetchServers(): Promise<Server[]> {
  const res = await fetch(`${API_BASE}/api/servers`, {
    headers: headers(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`, {
    headers: headers(),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- クライアントサイド用（Route Handler 経由のプロキシ） ---

export async function fetchServer(name: string): Promise<Server> {
  const res = await fetch(`/api/servers/${encodeURIComponent(name)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractDetail(err) || `API error: ${res.status}`);
  }
  return res.json();
}

export async function registerServer(data: RegisterRequest): Promise<JobResponse> {
  const res = await fetch("/api/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractDetail(err) || `API error: ${res.status}`);
  }
  return res.json();
}

export async function stopServer(name: string): Promise<JobResponse> {
  const res = await fetch(`/api/servers/${name}/stop`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractDetail(err) || `API error: ${res.status}`);
  }
  return res.json();
}

export async function restartServer(name: string): Promise<JobResponse> {
  const res = await fetch(`/api/servers/${name}/restart`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractDetail(err) || `API error: ${res.status}`);
  }
  return res.json();
}

export async function difyConnectServer(name: string): Promise<JobResponse> {
  const res = await fetch(`/api/servers/${name}/dify-connect`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractDetail(err) || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteServer(name: string): Promise<JobResponse> {
  const res = await fetch(`/api/servers/${name}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractDetail(err) || `API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchJobLogs(jobId: string, offset = 0): Promise<LogsResponse> {
  const res = await fetch(`/api/jobs/${jobId}/logs?offset=${offset}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- e4m MCP カタログ ---

export async function fetchCatalog(): Promise<{
  servers: CatalogEntry[];
  categories: CatalogCategory[];
}> {
  const res = await fetch("/api/catalog");
  if (!res.ok) throw new Error(`Catalog API error: ${res.status}`);
  return res.json();
}
