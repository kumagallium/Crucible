import { NextRequest } from "next/server";
import { proxyGet, proxyDelete } from "../../proxy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return proxyGet(`/api/servers/${name}`);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return proxyDelete(`/api/servers/${name}`);
}
