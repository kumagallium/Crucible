import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "http://api:8000";
const API_KEY = process.env.REGISTRY_API_KEY || "";

// CLI 実行はインストール + 実行で最大 3 分かかりうる
const CLI_TIMEOUT_MS = 180_000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    const res = await fetch(`${API_BASE}/api/cli/run`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CLI_TIMEOUT_MS),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}
