import { describe, it, expect, vi, beforeEach } from "vitest";

// NextResponse のモック
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status: number }) => ({
      data,
      status: init?.status ?? 200,
    }),
  },
}));

// global fetch をモック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// 環境変数
vi.stubEnv("API_BASE_URL", "http://backend:8000");
vi.stubEnv("REGISTRY_API_KEY", "secret-key");

describe("proxy", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("proxyGet", () => {
    it("バックエンドにGETリクエストを転送する", async () => {
      const { proxyGet } = await import("./proxy");
      const mockData = { status: "ok" };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockData),
      });

      const result = await proxyGet("/health");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://backend:8000/health",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-API-Key": "secret-key",
          }),
          cache: "no-store",
        })
      );
      expect((result as { data: unknown }).data).toEqual(mockData);
    });

    it("バックエンド到達不可時に502を返す", async () => {
      const { proxyGet } = await import("./proxy");
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await proxyGet("/health");
      expect((result as { status: number }).status).toBe(502);
      expect((result as { data: { detail: string } }).data.detail).toBe(
        "Backend unreachable"
      );
    });

    it("バックエンドのステータスコードをそのまま転送する", async () => {
      const { proxyGet } = await import("./proxy");
      mockFetch.mockResolvedValueOnce({
        status: 404,
        json: () => Promise.resolve({ detail: "Not found" }),
      });

      const result = await proxyGet("/api/servers/unknown");
      expect((result as { status: number }).status).toBe(404);
    });
  });

  describe("proxyPost", () => {
    it("ボディ付きPOSTリクエストを転送する", async () => {
      const { proxyPost } = await import("./proxy");
      const body = { name: "test-server" };
      mockFetch.mockResolvedValueOnce({
        status: 202,
        json: () => Promise.resolve({ job_id: "abc" }),
      });

      const result = await proxyPost("/api/servers", body);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://backend:8000/api/servers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        })
      );
      expect((result as { status: number }).status).toBe(202);
    });

    it("ボディなしPOSTリクエストを転送する", async () => {
      const { proxyPost } = await import("./proxy");
      mockFetch.mockResolvedValueOnce({
        status: 202,
        json: () => Promise.resolve({ job_id: "abc" }),
      });

      await proxyPost("/api/servers/test/restart");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: undefined,
        })
      );
    });

    it("バックエンド到達不可時に502を返す", async () => {
      const { proxyPost } = await import("./proxy");
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await proxyPost("/api/servers", {});
      expect((result as { status: number }).status).toBe(502);
    });
  });

  describe("proxyDelete", () => {
    it("DELETEリクエストを転送する", async () => {
      const { proxyDelete } = await import("./proxy");
      mockFetch.mockResolvedValueOnce({
        status: 202,
        json: () => Promise.resolve({ job_id: "abc" }),
      });

      const result = await proxyDelete("/api/servers/test");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://backend:8000/api/servers/test",
        expect.objectContaining({
          method: "DELETE",
        })
      );
      expect((result as { status: number }).status).toBe(202);
    });

    it("バックエンド到達不可時に502を返す", async () => {
      const { proxyDelete } = await import("./proxy");
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await proxyDelete("/api/servers/test");
      expect((result as { status: number }).status).toBe(502);
    });
  });
});
