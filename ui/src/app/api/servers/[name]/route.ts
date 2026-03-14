import { NextRequest } from "next/server";
import { proxyDelete } from "../../proxy";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return proxyDelete(`/api/servers/${name}`);
}
