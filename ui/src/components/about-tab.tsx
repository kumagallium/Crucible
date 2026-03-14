"use client";

import { BookOpen, Target, Palette } from "lucide-react";

export function AboutTab() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold mb-1">About Crucible</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Crucible（るつぼ）— 多様な MCP サーバーが一つの場所に集まり、AI
        エージェントの力へと変わる器。
      </p>

      <div className="space-y-4">
        {/* 名前の由来 */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            名前の由来
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Crucible
              は「るつぼ」を意味する英語です。るつぼとは、様々な素材を一つの器に集め、新たな価値を生み出すための容器。MCP
              サーバーという多様なツール群を一箇所に集約し、AI
              エージェントが自在に活用できる環境を整える —
              そのコンセプトに「るつぼ」というイメージが重なりました。
            </p>
            <p>
              MCP エコシステムには{" "}
              <a
                href="https://smithery.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Smithery
              </a>
              （鍛冶場）のようなプラットフォームが存在しますが、Crucible
              もまた金属・鍛造にルーツを持つ名前です。鍛冶場で道具が打ち出される前に、素材がるつぼの中で一つになる
              — Crucible はその最初の一歩を担う場所です。
            </p>
          </div>
        </section>

        {/* Crucible のアプローチ */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Crucible のアプローチ
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Smithery や Tooluniverse
              のようなオープンプラットフォームとは異なり、Crucible
              は各ユーザーやグループが
              <span className="font-medium text-foreground">
                自分たちのるつぼ
              </span>
              をクローズドに立ち上げられることを目指しています。
            </p>
            <p>
              大きな共有の炉ではなく、手元に置ける小さなるつぼ。自分たちのインフラの上で、自分たちの
              MCP サーバーを管理し、自分たちの AI エージェントに力を与える —
              そんなソブリンな MCP 基盤が Crucible です。
            </p>
          </div>
        </section>

        {/* ロゴについて */}
        <section className="rounded-xl border bg-card p-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            ロゴについて
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Crucible のロゴは、サーバーを U
            字に曲げてるつぼの形を表現し、その中に MCP
            サーバーを示す丸が収められたデザインです。多様なサーバーが一つの器に集まる様子をシンボリックに表しています。
          </p>
        </section>
      </div>
    </div>
  );
}
