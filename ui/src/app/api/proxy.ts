// FastAPI バックエンドへのプロキシユーティリティ
import { NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "http://api:8000";
const API_KEY = process.env.REGISTRY_API_KEY || "";

function proxyHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (API_KEY) h["X-API-Key"] = API_KEY;
  return h;
}

export async function proxyGet(path: string) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: proxyHeaders(),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}

export async function proxyPost(path: string, body?: unknown) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: proxyHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}

export async function proxyDelete(path: string) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: proxyHeaders(),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Backend unreachable" }, { status: 502 });
  }
}
