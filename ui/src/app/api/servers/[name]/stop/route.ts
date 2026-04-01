import { NextRequest } from "next/server";
import { proxyPost } from "../../../proxy";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return proxyPost(`/api/servers/${name}/stop`);
}
