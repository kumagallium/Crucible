import { describe, it, expect, vi, beforeEach } from "vitest";

// global fetch をモック
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// window を undefined にしてサーバーサイドモードでテスト
// api.ts は window === "undefined" で API_BASE を決定する
vi.stubGlobal("window", undefined);

// 環境変数のモック
vi.stubEnv("API_BASE_URL", "http://localhost:8000");
vi.stubEnv("REGISTRY_API_KEY", "test-key");

describe("api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("extractDetail", () => {
    // extractDetail は内部関数なので、registerServer のエラーハンドリング経由でテスト
    it("文字列 detail を含むエラーレスポンスを処理する", async () => {
      const { registerServer } = await import("./api");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ detail: "Server already exists" }),
        statusText: "Conflict",
      });

      await expect(
        registerServer({
          description: "",
          icon: "🔧",
          github_url: "https://github.com/test/repo",
          branch: "main",
          subdir: "",
          github_token: "",
          group: "user",
          dify_auto_register: true,
          env_vars: {},
        })
      ).rejects.toThrow("Server already exists");
    });

    it("配列 detail（バリデーションエラー）を処理する", async () => {
      const { registerServer } = await import("./api");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            detail: [
              { loc: ["body", "name"], msg: "too short", type: "value_error" },
            ],
          }),
        statusText: "Unprocessable Entity",
      });

      await expect(
        registerServer({
          description: "",
          icon: "🔧",
          github_url: "https://github.com/test/repo",
          branch: "main",
          subdir: "",
          github_token: "",
          group: "user",
          dify_auto_register: true,
          env_vars: {},
        })
      ).rejects.toThrow("body → name: too short");
    });

    it("JSON パース失敗時に statusText をフォールバックとして使う", async () => {
      const { registerServer } = await import("./api");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("parse error")),
        statusText: "Internal Server Error",
      });

      await expect(
        registerServer({
          description: "",
          icon: "🔧",
          github_url: "https://github.com/test/repo",
          branch: "main",
          subdir: "",
          github_token: "",
          group: "user",
          dify_auto_register: true,
          env_vars: {},
        })
      ).rejects.toThrow("Internal Server Error");
    });
  });

  describe("fetchServers", () => {
    it("サーバー一覧を取得する", async () => {
      const { fetchServers } = await import("./api");
      const servers = [{ name: "test", status: "running" }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(servers),
      });

      const result = await fetchServers();
      expect(result).toEqual(servers);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/servers"),
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        })
      );
    });

    it("API エラー時に例外を投げる", async () => {
      const { fetchServers } = await import("./api");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(fetchServers()).rejects.toThrow("API error: 500");
    });
  });

  describe("fetchHealth", () => {
    it("ヘルスステータスを取得する", async () => {
      const { fetchHealth } = await import("./api");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

      const result = await fetchHealth();
      expect(result).toEqual({ status: "ok" });
    });
  });

  describe("registerServer", () => {
    it("成功時にジョブレスポンスを返す", async () => {
      const { registerServer } = await import("./api");
      const job = { job_id: "abc", server_name: "test", status: "pending" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(job),
      });

      const result = await registerServer({
        description: "",
        icon: "🔧",
        github_url: "https://github.com/test/repo",
        branch: "main",
        subdir: "",
        github_token: "",
        group: "user",
        dify_auto_register: true,
        env_vars: {},
      });
      expect(result).toEqual(job);
    });
  });

  describe("restartServer", () => {
    it("再起動ジョブを返す", async () => {
      const { restartServer } = await import("./api");
      const job = { job_id: "def", server_name: "test", status: "pending" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(job),
      });

      const result = await restartServer("test");
      expect(result).toEqual(job);
    });

    it("エラー時に例外を投げる", async () => {
      const { restartServer } = await import("./api");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: "Not found" }),
        statusText: "Not Found",
      });

      await expect(restartServer("unknown")).rejects.toThrow("Not found");
    });
  });

  describe("deleteServer", () => {
    it("削除ジョブを返す", async () => {
      const { deleteServer } = await import("./api");
      const job = { job_id: "ghi", server_name: "test", status: "pending" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(job),
      });

      const result = await deleteServer("test");
      expect(result).toEqual(job);
    });
  });

  describe("fetchJobLogs", () => {
    it("ログを取得する", async () => {
      const { fetchJobLogs } = await import("./api");
      const logs = { job_id: "abc", status: "running", logs: ["line1"], total: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(logs),
      });

      const result = await fetchJobLogs("abc", 0);
      expect(result).toEqual(logs);
    });

    it("offset パラメータを含む", async () => {
      const { fetchJobLogs } = await import("./api");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ job_id: "abc", status: "success", logs: [], total: 5 }),
      });

      await fetchJobLogs("abc", 3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("offset=3"),
      );
    });

    it("エラー時に例外を投げる", async () => {
      const { fetchJobLogs } = await import("./api");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(fetchJobLogs("unknown")).rejects.toThrow("API error: 404");
    });
  });
});
