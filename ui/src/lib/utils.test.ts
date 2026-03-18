import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("単一クラス名をそのまま返す", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("複数クラス名を結合する", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("Tailwind の競合を解決する", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("falsy 値を除外する", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("条件付きクラスを処理する", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });
});
