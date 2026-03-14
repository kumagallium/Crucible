import { NextRequest } from "next/server";
import { proxyGet, proxyPost } from "../proxy";

export async function GET() {
  return proxyGet("/api/servers");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyPost("/api/servers", body);
}
