// e4m MCP カタログ API へのプロキシ
import { NextResponse } from "next/server";

const E4M_API_BASE = process.env.E4M_API_BASE_URL || "https://e4m.jp/api";

export async function GET() {
  try {
    const [serversRes, categoriesRes] = await Promise.all([
      fetch(`${E4M_API_BASE}/v1/mcpservers/`, { cache: "no-store" }),
      fetch(`${E4M_API_BASE}/v1/mcpserver-categories/`, { cache: "no-store" }),
    ]);

    if (!serversRes.ok || !categoriesRes.ok) {
      return NextResponse.json(
        { detail: "e4m API unreachable" },
        { status: 502 },
      );
    }

    const servers = await serversRes.json();
    const categories = await categoriesRes.json();

    return NextResponse.json({ servers, categories });
  } catch {
    return NextResponse.json(
      { detail: "e4m API unreachable" },
      { status: 502 },
    );
  }
}
