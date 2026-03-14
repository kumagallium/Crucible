import { NextRequest } from "next/server";
import { proxyGet } from "../../../proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const offset = req.nextUrl.searchParams.get("offset") || "0";
  return proxyGet(`/api/jobs/${jobId}/logs?offset=${offset}`);
}
