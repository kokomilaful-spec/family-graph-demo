"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── TrendLife Brand Tokens ─────────────────────────────────
const brand = {
  red: "#D71920",
  coral: "#FF3B42",
  burgundy: "#460002",
  cream: "#F6EFE9",
  charcoal: "#153241",
  darkTeal: "#026D7D",
  lightTeal: "#0091A7",
  sky: "#AFE0EF",
  pink: "#FFAAB7",
  lilac: "#B1B7FF",
  orange: "#FF6200",
  yellow: "#FEB914",
};

// ─── Types ──────────────────────────────────────────────────
type Phase =
  | "welcome"
  | "naming"
  | "family-count"
  | "family-input"
  | "family-confirm"
  | "ready"
  | "ordering-demo"
  | "grandma-view"
  | "invite"
  | "invite-member"
  | "constitution";

interface FamilyMember {
  name: string;
  age: string;
  role: "parent" | "child" | "grandparent" | "teen" | "young-child";
  emoji: string;
}

interface ConstitutionRule {
  icon: string;
  title: string;
  description: string;
  source: string;
  confirmed: boolean | null;
}

// ─── Helpers ────────────────────────────────────────────────
function inferRole(age: number): FamilyMember["role"] {
  if (age >= 60) return "grandparent";
  if (age >= 18) return "parent";
  if (age >= 13) return "teen";
  if (age >= 8) return "child";
  return "young-child";
}

function roleLabel(role: FamilyMember["role"]): string {
  switch (role) {
    case "grandparent": return "長輩";
    case "parent": return "家人";
    case "teen": return "青少年";
    case "child": return "兒童";
    case "young-child": return "幼童";
  }
}

function roleEmoji(role: FamilyMember["role"], index: number): string {
  switch (role) {
    case "grandparent": return index % 2 === 0 ? "👵" : "👴";
    case "parent": return index % 2 === 0 ? "👨" : "👩";
    case "teen": return "👧";
    case "child": return "👦";
    case "young-child": return "👶";
  }
}

// ─── Chat Bubble ────────────────────────────────────────────
function ChatBubble({
  children,
  isUser = false,
  delay = 0,
  avatar,
}: {
  children: React.ReactNode;
  isUser?: boolean;
  delay?: number;
  avatar?: string;
}) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const t = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(t);
    }
  }, [delay]);

  if (!visible) return <div className="h-12" />;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-[slideUp_0.3s_ease-out]`}
    >
      {!isUser && (
        <div
          className="mr-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg shadow-md"
          style={{
            background: `linear-gradient(135deg, ${brand.darkTeal}, ${brand.lightTeal})`,
          }}
        >
          {avatar || "🤵"}
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
          isUser ? "rounded-br-md text-white" : "rounded-bl-md"
        }`}
        style={
          isUser
            ? { background: brand.darkTeal, color: "#fff" }
            : { background: "#fff", color: brand.charcoal }
        }
      >
        {children}
      </div>
    </div>
  );
}

// ─── Pill Button ────────────────────────────────────────────
function PillButton({
  children,
  onClick,
  variant = "default",
  size = "md",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "rounded-full font-medium transition-all duration-200 active:scale-95 ";
  const sizes = {
    sm: "px-4 py-1.5 text-sm",
    md: "px-5 py-2.5 text-[15px]",
    lg: "px-6 py-3 text-base",
  };
  const variants = {
    default: "bg-white shadow-sm border border-gray-100 hover:shadow-md",
    primary: "text-white shadow-md hover:shadow-lg",
    outline: "border-2 hover:bg-opacity-5",
    ghost: "hover:bg-black/5",
  };

  return (
    <button
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]}`}
      style={
        variant === "primary"
          ? {
              background: `linear-gradient(135deg, ${brand.darkTeal}, ${brand.lightTeal})`,
            }
          : variant === "outline"
            ? { borderColor: brand.darkTeal, color: brand.darkTeal }
            : { color: brand.charcoal }
      }
    >
      {children}
    </button>
  );
}

// ─── Progress Dots ──────────────────────────────────────────
function ProgressDots({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? "w-6" : "w-1.5"
          }`}
          style={{
            background:
              i === current
                ? brand.darkTeal
                : i < current
                  ? brand.lightTeal
                  : "#D9D5D0",
          }}
        />
      ))}
    </div>
  );
}

// ─── Life Link Decoration (TrendLife signature curve) ────────
function LifeLinkCurve({
  position = "top",
}: {
  position?: "top" | "bottom";
}) {
  if (position === "top") {
    return (
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 opacity-20">
        <svg viewBox="0 0 200 200" fill="none">
          <path
            d="M200 0C200 110.457 110.457 200 0 200"
            stroke={brand.sky}
            strokeWidth="40"
          />
          <path
            d="M160 0C160 88.366 88.366 160 0 160"
            stroke={brand.red}
            strokeWidth="24"
            strokeOpacity="0.5"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 opacity-15">
      <svg viewBox="0 0 200 200" fill="none">
        <path
          d="M0 200C0 89.543 89.543 0 200 0"
          stroke={brand.sky}
          strokeWidth="40"
        />
        <path
          d="M40 200C40 111.634 111.634 40 200 40"
          stroke={brand.red}
          strokeWidth="20"
          strokeOpacity="0.4"
        />
      </svg>
    </div>
  );
}

// ─── QR Code Placeholder ────────────────────────────────────
function QRCodePlaceholder({ name }: { name: string }) {
  // Use a seeded simple hash so the pattern is stable per name
  const seed = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return (
    <div className="mx-auto flex flex-col items-center gap-3">
      <div
        className="flex h-44 w-44 items-center justify-center rounded-2xl border-2 shadow-lg"
        style={{ borderColor: brand.darkTeal, background: "#fff" }}
      >
        <div className="grid grid-cols-7 gap-[3px]">
          {Array.from({ length: 49 }).map((_, i) => {
            const row = Math.floor(i / 7);
            const col = i % 7;
            const isCornerBlock =
              (row < 3 && col < 3) ||
              (row < 3 && col >= 4) ||
              (row >= 4 && col < 3);
            const fill =
              isCornerBlock || ((seed + i * 7) % 3 !== 0);
            return (
              <div
                key={i}
                className="h-4 w-4 rounded-sm"
                style={{
                  background: fill ? brand.charcoal : "transparent",
                }}
              />
            );
          })}
        </div>
      </div>
      <p className="text-sm font-medium" style={{ color: brand.charcoal }}>
        {name}的專屬邀請
      </p>
      <p className="text-xs" style={{ color: "#888" }}>
        有效期限：7 天
      </p>
    </div>
  );
}

// ─── Family Context Badge ────────────────────────────────────
function FamilyContextBadge({
  text,
  icon = "👨‍👩‍👧‍👦",
  subtle = false,
}: {
  text: string;
  icon?: string;
  subtle?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2 animate-[slideUp_0.4s_ease-out]"
      style={{
        background: subtle
          ? `${brand.sky}12`
          : `linear-gradient(135deg, ${brand.sky}25, ${brand.lightTeal}15)`,
        borderColor: `${brand.lightTeal}40`,
      }}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-medium" style={{ color: brand.darkTeal }}>
        {text}
      </span>
    </div>
  );
}

// ─── Family Context Layer Explainer ─────────────────────────
function FamilyContextLayer() {
  return (
    <div
      className="mx-auto max-w-[90%] rounded-2xl border p-4 animate-[slideUp_0.5s_ease-out]"
      style={{
        background: `linear-gradient(135deg, ${brand.cream}, #fff)`,
        borderColor: `${brand.sky}60`,
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🏠</span>
        <span
          className="text-[13px] font-semibold"
          style={{ color: brand.darkTeal }}
        >
          Family Context Layer
        </span>
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: "#666" }}>
        ご家族の食事・健康・生活の好みは
        <strong style={{ color: brand.charcoal }}>「家族コンテキスト」</strong>
        として共有されます。
      </p>
      <div className="mt-2 space-y-1.5">
        {[
          { icon: "✓", text: "誰が教えたかは表示されません" },
          { icon: "✓", text: "家族全員のために活かされます" },
          { icon: "✓", text: "プライバシーを守りながら思いやりを届けます" },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold"
              style={{ color: brand.darkTeal }}
            >
              {item.icon}
            </span>
            <span className="text-[11px]" style={{ color: "#777" }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Phone Frame Wrapper ────────────────────────────────────
function PhoneFrame({
  label,
  persona,
  children,
}: {
  label: string;
  persona: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-[slideUp_0.4s_ease-out]">
      <p
        className="mb-2 text-center text-xs font-medium"
        style={{ color: "#999" }}
      >
        {label}
      </p>
      <div
        className="overflow-hidden rounded-2xl border shadow-lg"
        style={{ borderColor: "#E0DCD7" }}
      >
        {/* LINE header */}
        <div className="flex items-center justify-between bg-[#06C755] px-4 py-2">
          <span className="text-xs text-white/80">← Back</span>
          <p className="text-sm font-semibold text-white">{persona}</p>
          <span className="text-xs text-white/80">...</span>
        </div>
        <div style={{ background: "#E3F0D2" }}>{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── Main Onboarding Component ────────────────────────────
// ═══════════════════════════════════════════════════════════

export default function OnboardingMockup() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [butlerName, setButlerName] = useState("");
  const [familyCount, setFamilyCount] = useState(0);
  const [familyInput, setFamilyInput] = useState("");
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedInviteMember, setSelectedInviteMember] =
    useState<FamilyMember | null>(null);
  const [constitutionRules, setConstitutionRules] = useState<
    ConstitutionRule[]
  >([
    {
      icon: "🍽",
      title: "飲食守護",
      description: "お義母さんの食事は消化に良いもの優先、玄米は避ける",
      source: "Mayumi が「婆婆は玄米が消化しにくい」と 3 回言及",
      confirmed: null,
    },
    {
      icon: "💰",
      title: "消費守護",
      description: "1 回の注文が ¥5,000 を超える場合は確認が必要",
      source: "旦那さんが 4 回の注文で毎回価格を確認してから決定",
      confirmed: null,
    },
    {
      icon: "🔒",
      title: "隱私守護",
      description: "娘のプライベートな会話は家族と共有しない",
      source: "娘が「これは私の秘密」と言ったことがある",
      confirmed: null,
    },
    {
      icon: "⏰",
      title: "作息守護",
      description: "息子は夜 9 時以降のデバイス使用を控える",
      source: "Mayumi が息子の就寝時間について複数回言及",
      confirmed: null,
    },
  ]);
  const [orderStep, setOrderStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Default demo family
  const demoFamily: FamilyMember[] = [
    { name: "お義母さん", age: "78", role: "grandparent", emoji: "👵" },
    { name: "旦那さん", age: "42", role: "parent", emoji: "👨" },
    { name: "娘", age: "15", role: "teen", emoji: "👧" },
    { name: "息子", age: "9", role: "child", emoji: "👦" },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [phase, orderStep, familyMembers]);

  const parseFamilyInput = useCallback(() => {
    const lines = familyInput.trim().split("\n").filter(Boolean);
    const members: FamilyMember[] = lines.map((line, i) => {
      const ageMatch = line.match(/(\d+)/);
      const age = ageMatch ? parseInt(ageMatch[1]) : 35;
      const name = line.replace(/\d+歲?歳?/g, "").trim();
      const role = inferRole(age);
      return { name, age: String(age), role, emoji: roleEmoji(role, i) };
    });
    setFamilyMembers(members);
    setPhase("family-confirm");
  }, [familyInput]);

  const handleConstitutionAction = useCallback(
    (index: number, confirmed: boolean) => {
      setConstitutionRules((prev) =>
        prev.map((r, i) => (i === index ? { ...r, confirmed } : r)),
      );
    },
    [],
  );

  const ensureDemoData = useCallback(() => {
    if (!butlerName) setButlerName("小趨");
    if (familyMembers.length === 0) {
      setFamilyMembers(demoFamily);
      setFamilyCount(5);
    }
  }, [butlerName, familyMembers.length, demoFamily]);

  const phaseIndex: Record<Phase, number> = {
    welcome: 0,
    naming: 0,
    "family-count": 1,
    "family-input": 1,
    "family-confirm": 2,
    ready: 3,
    "ordering-demo": 3,
    "grandma-view": 4,
    invite: 5,
    "invite-member": 5,
    constitution: 6,
  };

  const allPhases: Phase[] = [
    "welcome",
    "naming",
    "family-count",
    "family-input",
    "family-confirm",
    "ready",
    "ordering-demo",
    "grandma-view",
    "invite",
    "constitution",
  ];

  const members = familyMembers.length > 0 ? familyMembers : demoFamily;
  const name = butlerName || "小趨";

  // ═══ Render ═══════════════════════════════════════════════
  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden"
      style={{
        background: brand.cream,
        fontFamily: "'Geist', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-5 pb-1 pt-3">
        <span className="text-sm font-medium" style={{ color: brand.charcoal }}>
          9:41
        </span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="12" viewBox="0 0 16 12" fill={brand.charcoal}>
            <rect x="0" y="4" width="3" height="8" rx="0.5" />
            <rect x="4.5" y="2.5" width="3" height="9.5" rx="0.5" />
            <rect x="9" y="0.5" width="3" height="11.5" rx="0.5" />
          </svg>
          <div
            className="h-3 w-6 rounded-sm border"
            style={{ borderColor: brand.charcoal }}
          >
            <div
              className="ml-0.5 mt-0.5 h-2 w-4 rounded-sm"
              style={{ background: brand.darkTeal }}
            />
          </div>
        </div>
      </div>

      {/* ── Header ── */}
      <header className="relative flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: brand.red }}
          >
            <span className="text-sm font-bold text-white">T</span>
          </div>
          <div>
            <h1
              className="text-base font-semibold tracking-tight"
              style={{ color: brand.charcoal }}
            >
              TrendLife
            </h1>
            <p
              className="text-[11px] font-medium tracking-wide"
              style={{ color: brand.lightTeal }}
            >
              AI Butler
            </p>
          </div>
        </div>
        <ProgressDots current={phaseIndex[phase]} total={7} />
      </header>

      <LifeLinkCurve position="top" />
      <LifeLinkCurve position="bottom" />

      {/* ── Content ── */}
      <div className="relative flex-1 overflow-y-auto px-5 pb-32">
        {/* ══════ WELCOME ══════ */}
        {phase === "welcome" && (
          <div className="flex flex-col items-center pt-10 animate-[slideUp_0.5s_ease-out]">
            <div
              className="mb-8 flex h-36 w-36 items-center justify-center rounded-full shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${brand.sky}40, ${brand.lightTeal}30)`,
                border: `3px solid ${brand.sky}60`,
              }}
            >
              <span className="text-6xl">🤵</span>
            </div>

            <h2
              className="mb-3 text-center text-2xl font-semibold tracking-tight"
              style={{ color: brand.charcoal }}
            >
              ようこそ TrendLife へ
            </h2>
            <p
              className="mb-2 text-center text-[15px] leading-relaxed"
              style={{ color: "#666" }}
            >
              今日から、あなた専属の AI バトラーが
              <br />
              ご家族のデジタルライフを守ります
            </p>

            <div className="mb-8 mt-6 grid w-full grid-cols-3 gap-3">
              {[
                { icon: "🛡", label: "安全を守る" },
                { icon: "💊", label: "健康を管理" },
                { icon: "💝", label: "絆をつなぐ" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: brand.charcoal }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <PillButton
              variant="primary"
              size="lg"
              onClick={() => setPhase("naming")}
            >
              AI バトラーを設定する
            </PillButton>
            <p className="mt-4 text-center text-xs" style={{ color: "#999" }}>
              たった 2 分で使い始められます
            </p>
          </div>
        )}

        {/* ══════ NAMING ══════ */}
        {phase === "naming" && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p className="font-medium">こんにちは！私はあなた専属の AI バトラーです 👋</p>
              <p className="mt-1.5 text-[14px] text-gray-500">
                今日から、ご家族のデジタルライフの安全をお守りします。
              </p>
              <p className="mt-3 font-medium">
                まず、私のことを何と呼びますか？
              </p>
            </ChatBubble>

            <div className="flex flex-wrap gap-2 pl-12">
              {["小趨", "Alfred", "タク"].map((n) => (
                <PillButton
                  key={n}
                  variant={butlerName === n ? "primary" : "default"}
                  size="sm"
                  onClick={() => setButlerName(n)}
                >
                  {n}
                </PillButton>
              ))}
              <PillButton
                variant="outline"
                size="sm"
                onClick={() => setButlerName("自訂")}
              >
                ✏️ カスタム
              </PillButton>
            </div>

            {butlerName && butlerName !== "自訂" && (
              <>
                <ChatBubble isUser delay={200}>
                  {butlerName} と呼ぶね！
                </ChatBubble>
                <ChatBubble delay={600}>
                  <p>
                    了解です！私は
                    <strong style={{ color: brand.darkTeal }}>
                      {butlerName}
                    </strong>
                    、よろしくお願いします 😊
                  </p>
                  <p className="mt-2 text-[14px] text-gray-500">
                    この名前はご家族全員のチャット画面に表示されます。
                  </p>
                </ChatBubble>
                <div className="flex justify-center pt-2">
                  <PillButton
                    variant="primary"
                    onClick={() => setPhase("family-count")}
                  >
                    次へ →
                  </PillButton>
                </div>
              </>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ FAMILY COUNT ══════ */}
        {phase === "family-count" && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p className="font-medium">
                ご家族は何人で一緒に守りますか？
              </p>
              <p className="mt-1.5 text-[14px] text-gray-500">
                Mayumi さんご本人を含め、最大 6 名です。
              </p>
            </ChatBubble>

            <div className="flex flex-wrap justify-center gap-3 py-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setFamilyCount(n);
                    setTimeout(() => setPhase("family-input"), 400);
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold shadow-sm transition-all active:scale-95"
                  style={{
                    background:
                      familyCount === n
                        ? `linear-gradient(135deg, ${brand.darkTeal}, ${brand.lightTeal})`
                        : "#fff",
                    color: familyCount === n ? "#fff" : brand.charcoal,
                    border:
                      familyCount === n ? "none" : "1px solid #E8E4DF",
                  }}
                >
                  {n}人
                </button>
              ))}
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ FAMILY INPUT ══════ */}
        {phase === "family-input" && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p className="font-medium">{familyCount} 人家族ですね！</p>
              <p className="mt-1.5 text-[14px] text-gray-500">
                他の {familyCount - 1} 名の家族を教えてください。
                <br />
                1 行に 1 人ずつ。あとで変更できます。
              </p>
              <div
                className="mt-3 rounded-xl p-3 text-[13px]"
                style={{
                  background: `${brand.sky}30`,
                  color: brand.charcoal,
                }}
              >
                💡 例：
                <br />
                お義母さん 78歳
                <br />
                旦那さん
                <br />
                娘 15歳
              </div>
            </ChatBubble>

            <div className="pl-12 pr-2">
              <textarea
                value={familyInput}
                onChange={(e) => setFamilyInput(e.target.value)}
                placeholder={
                  "お義母さん 78歳\n旦那さん\n娘 15歳\n息子 9歳"
                }
                rows={familyCount - 1}
                className="w-full rounded-2xl border bg-white p-4 text-[15px] leading-relaxed shadow-sm outline-none transition-shadow focus:shadow-md"
                style={{ borderColor: "#E8E4DF", color: brand.charcoal }}
              />
              <div className="mt-3 flex justify-end">
                <PillButton variant="primary" onClick={parseFamilyInput}>
                  送信 →
                </PillButton>
              </div>
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ FAMILY CONFIRM ══════ */}
        {phase === "family-confirm" && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p className="font-medium">
                了解しました！ご家族を確認しました 🏠
              </p>
            </ChatBubble>

            <div className="ml-12 overflow-hidden rounded-2xl bg-white shadow-md">
              <div
                className="px-4 py-3"
                style={{
                  background: `linear-gradient(135deg, ${brand.darkTeal}, ${brand.lightTeal})`,
                }}
              >
                <p className="text-sm font-semibold text-white">
                  ご家族メンバー
                </p>
              </div>
              <div
                className="flex items-center gap-3 border-b px-4 py-3"
                style={{ borderColor: "#F0ECE7" }}
              >
                <span className="text-2xl">👩</span>
                <div className="flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: brand.charcoal }}
                  >
                    Mayumi（あなた）
                  </p>
                  <p className="text-xs" style={{ color: "#999" }}>
                    バトラーオーナー
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ background: brand.darkTeal }}
                >
                  Admin
                </span>
              </div>
              {members.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  style={{ borderColor: "#F0ECE7" }}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: brand.charcoal }}
                    >
                      {m.name}
                      {m.age !== "35" && (
                        <span
                          className="ml-1 text-xs font-normal"
                          style={{ color: "#999" }}
                        >
                          {m.age}歳
                        </span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: "#999" }}>
                      {roleLabel(m.role)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <ChatBubble delay={400}>
              <p>修正はありますか？</p>
            </ChatBubble>

            <div className="flex justify-center gap-3 pt-1">
              <PillButton
                variant="primary"
                onClick={() => setPhase("ready")}
              >
                これで OK！
              </PillButton>
              <PillButton
                variant="outline"
                onClick={() => setPhase("family-input")}
              >
                修正する
              </PillButton>
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ READY — first value moment with ordering ══════ */}
        {phase === "ready" && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p className="font-medium">
                設定完了！今すぐ {name}{" "}
                とチャットできます 🎉
              </p>
              <p className="mt-2 text-[14px] text-gray-500">
                たとえば、こんなことを聞いてみてください：
              </p>
            </ChatBubble>

            {/* Ordering-focused suggestions */}
            <div className="space-y-2 pl-12 pr-2">
              {[
                {
                  text: "お義母さんに合う夕食を注文して",
                  icon: "🍽",
                  highlight: true,
                },
                {
                  text: "この電話番号は安全？",
                  icon: "🛡",
                  highlight: false,
                },
                {
                  text: "旦那さんにワクチンの予約をリマインド",
                  icon: "💉",
                  highlight: false,
                },
              ].map((s) => (
                <button
                  key={s.text}
                  onClick={() => {
                    if (s.highlight) {
                      ensureDemoData();
                      setOrderStep(0);
                      setPhase("ordering-demo");
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl p-3 text-left transition-all active:scale-[0.98] ${
                    s.highlight
                      ? "shadow-md"
                      : "shadow-sm"
                  }`}
                  style={{
                    background: s.highlight
                      ? `linear-gradient(135deg, ${brand.darkTeal}12, ${brand.lightTeal}08)`
                      : "#fff",
                    border: s.highlight
                      ? `2px solid ${brand.darkTeal}30`
                      : "1px solid #F0ECE7",
                  }}
                >
                  <span className="text-xl">{s.icon}</span>
                  <div>
                    <span
                      className="text-[13px]"
                      style={{ color: brand.charcoal }}
                    >
                      「{s.text}」
                    </span>
                    {s.highlight && (
                      <p
                        className="mt-0.5 text-[11px] font-medium"
                        style={{ color: brand.darkTeal }}
                      >
                        ← タップして体験 ✨
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 pt-4">
              <PillButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  ensureDemoData();
                  setPhase("invite");
                }}
              >
                家族を招待する →
              </PillButton>
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ ORDERING DEMO — Mayumi teaches preference ══════ */}
        {phase === "ordering-demo" && (
          <div className="space-y-4 pt-4">
            {/* Step 0: Mayumi asks to order */}
            <ChatBubble isUser>
              お義母さんに夕食を注文したいんだけど
            </ChatBubble>

            <ChatBubble delay={300}>
              <p>
                かしこまりました！お義母さん（78 歳）のお食事ですね。
              </p>
              <p className="mt-2 text-[14px] text-gray-500">
                お義母さんの食事で気をつけることはありますか？
              </p>
            </ChatBubble>

            {orderStep >= 1 && (
              <>
                <ChatBubble isUser delay={200}>
                  婆婆は玄米が消化しにくいから避けてほしい。
                  あと、お粥や柔らかいものが好きなの。
                </ChatBubble>

                {/* Family Context learned animation */}
                <div className="space-y-2 pl-12 animate-[slideUp_0.4s_ease-out]">
                  <FamilyContextBadge
                    text="家族コンテキストに保存：玄米を避ける（消化配慮）"
                    icon="🏠"
                  />
                  <FamilyContextBadge
                    text="家族コンテキストに保存：お粥・柔らかい食感を好む"
                    icon="🍽"
                  />
                </div>
              </>
            )}

            {orderStep >= 2 && (
              <ChatBubble delay={300}>
                <p className="font-medium" style={{ color: brand.darkTeal }}>
                  覚えました！✨
                </p>
                <p className="mt-1.5 text-[14px]">
                  お義母さんのお食事では、
                  <strong>玄米を避けて</strong>、
                  <strong>消化の良いもの</strong>
                  を優先的にお選びします。
                </p>
                <p className="mt-2 text-[14px] text-gray-500">
                  近くのお店を探しました：
                </p>

                {/* Restaurant suggestion card */}
                <div
                  className="mt-3 overflow-hidden rounded-xl border"
                  style={{ borderColor: "#E8E4DF" }}
                >
                  <div className="flex items-center gap-3 bg-white p-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                      style={{ background: `${brand.sky}30` }}
                    >
                      🍚
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: brand.charcoal }}
                      >
                        やさしいお粥屋さん
                      </p>
                      <p className="text-[11px]" style={{ color: "#999" }}>
                        Uber Eats · 配達 25 分 · ¥1,200〜
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-medium"
                      style={{
                        background: `${brand.darkTeal}15`,
                        color: brand.darkTeal,
                      }}
                    >
                      おすすめ
                    </span>
                  </div>
                  <div
                    className="border-t px-3 py-2 text-[12px]"
                    style={{
                      borderColor: "#F0ECE7",
                      background: `${brand.sky}10`,
                      color: "#666",
                    }}
                  >
                    🧠 玄米なし・消化に優しいメニューが豊富
                  </div>
                </div>
              </ChatBubble>
            )}

            {orderStep >= 3 && (
              <>
                <FamilyContextLayer />

                <ChatBubble delay={200}>
                  <p className="text-[14px] text-gray-500">
                    この情報は
                    <strong style={{ color: brand.darkTeal }}>
                      「家族コンテキスト」
                    </strong>
                    として保存されます。
                    <br />
                    お義母さんが直接注文する時にも、
                    <strong style={{ color: brand.darkTeal }}>
                      誰が教えたかは表示されず
                    </strong>
                    、自然な配慮として反映されます 👇
                  </p>
                </ChatBubble>
              </>
            )}

            {/* Step progression buttons */}
            {orderStep < 3 && (
              <div className="flex justify-center pt-2">
                <PillButton
                  variant="primary"
                  onClick={() => setOrderStep((s) => s + 1)}
                >
                  {orderStep === 0
                    ? "Mayumi が食の好みを伝える →"
                    : orderStep === 1
                      ? "AI バトラーが記憶する →"
                      : "この記憶がどう使われるか →"}
                </PillButton>
              </div>
            )}

            {orderStep >= 3 && (
              <div className="flex justify-center pt-2">
                <PillButton
                  variant="primary"
                  size="lg"
                  onClick={() => setPhase("grandma-view")}
                >
                  👵 お義母さん側の画面を見る →
                </PillButton>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ GRANDMA VIEW — Memory applied ══════ */}
        {phase === "grandma-view" && (
          <div className="space-y-4 pt-4">
            {/* Context badge */}
            <div className="flex justify-center">
              <div
                className="rounded-full px-4 py-1.5 text-xs font-medium"
                style={{
                  background: `${brand.pink}40`,
                  color: brand.burgundy,
                }}
              >
                📱 お義母さんの LINE 画面
              </div>
            </div>

            {/* Grandma's phone - LINE simulation */}
            <PhoneFrame label="" persona={`🤵 ${name}（家のバトラー）`}>
              <div className="space-y-3 p-4">
                {/* Grandma asks for food */}
                <div className="flex justify-end">
                  <div
                    className="rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] shadow-sm"
                    style={{ background: "#B2E281", color: brand.charcoal }}
                  >
                    今日の晩ごはん、何かいいものある？
                  </div>
                </div>

                {/* Butler responds with learned memory */}
                <div className="flex gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${brand.darkTeal}, ${brand.lightTeal})`,
                    }}
                  >
                    🤵
                  </div>
                  <div className="space-y-2">
                    <div
                      className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] shadow-sm"
                      style={{ color: brand.charcoal }}
                    >
                      <p className="font-medium">
                        お義母さん、こんばんは 😊
                      </p>
                      <p className="mt-1.5 text-[12px] text-gray-500">
                        お食事のご提案がございます。
                        消化の良いメニューを中心にお選びしました。
                      </p>
                    </div>

                    {/* Memory-powered suggestion */}
                    <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-sm">
                      {/* Memory badge */}
                      <div
                        className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1"
                        style={{
                          background: `${brand.sky}30`,
                        }}
                      >
                        <span className="text-[10px]">🧠</span>
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: brand.darkTeal }}
                        >
                          あなたの食の好みを学習済み
                        </span>
                      </div>

                      {/* Food items */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🍚</span>
                          <div>
                            <p
                              className="text-[13px] font-medium"
                              style={{ color: brand.charcoal }}
                            >
                              鶏だしお粥セット
                            </p>
                            <p
                              className="text-[11px]"
                              style={{ color: "#999" }}
                            >
                              ¥1,380 · やさしいお粥屋さん
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🐟</span>
                          <div>
                            <p
                              className="text-[13px] font-medium"
                              style={{ color: brand.charcoal }}
                            >
                              煮魚とお味噌汁定食
                            </p>
                            <p
                              className="text-[11px]"
                              style={{ color: "#999" }}
                            >
                              ¥1,560 · 和食なごみ
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Why these choices */}
                      <div
                        className="mt-2.5 rounded-lg px-2.5 py-1.5 text-[11px]"
                        style={{
                          background: `${brand.sky}15`,
                          color: "#666",
                        }}
                      >
                        ✓ 玄米なし &nbsp; ✓ 消化に優しい &nbsp; ✓ 柔らかい食感
                      </div>

                      {/* Action buttons */}
                      <div className="mt-2.5 flex gap-2">
                        <div
                          className="flex-1 rounded-xl py-2 text-center text-[12px] font-medium text-white"
                          style={{ background: brand.darkTeal }}
                        >
                          お粥セットを注文
                        </div>
                        <div
                          className="rounded-xl border px-3 py-2 text-center text-[12px] font-medium"
                          style={{
                            borderColor: "#E0DCD7",
                            color: "#888",
                          }}
                        >
                          他を見る
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PhoneFrame>

            {/* Explanation */}
            <ChatBubble delay={300}>
              <p className="font-medium" style={{ color: brand.darkTeal }}>
                これが Memory の力です ✨
              </p>
              <p className="mt-1.5 text-[14px]">
                Mayumi さんが教えてくれた
                「<strong>玄米を避ける</strong>」
                「<strong>柔らかいものが好き</strong>」を、
                お義母さんの注文にも自動的に反映しました。
              </p>
              <p className="mt-2 text-[14px] text-gray-500">
                家族の誰かが教えてくれたことを、
                家族全員のために活かします。
                <br />
                これが {name} の「家族記憶」です。
              </p>
            </ChatBubble>

            <div className="flex flex-col items-center gap-3 pt-4">
              <PillButton
                variant="primary"
                size="lg"
                onClick={() => setPhase("invite")}
              >
                👨‍👩‍👧‍👦 家族を招待する
              </PillButton>
              <PillButton
                variant="ghost"
                size="sm"
                onClick={() => setPhase("constitution")}
              >
                Phase 3：AI が提案する家族ルール →
              </PillButton>
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ INVITE ══════ */}
        {phase === "invite" && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p className="font-medium">
                誰を最初に招待しますか？
              </p>
              <p className="mt-1.5 text-[14px] text-gray-500">
                各メンバー専用の招待リンクがあります。
                QR コードを読み取るだけで完了です。
              </p>
            </ChatBubble>

            <div className="grid grid-cols-2 gap-3 pl-12 pr-2">
              {members.map((m, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedInviteMember(m);
                    setPhase("invite-member");
                  }}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="text-left">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: brand.charcoal }}
                    >
                      {m.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "#999" }}>
                      {roleLabel(m.role)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-center pt-2">
              <PillButton
                variant="ghost"
                size="sm"
                onClick={() => setPhase("ready")}
              >
                ← 後で招待する
              </PillButton>
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ INVITE MEMBER (QR) ══════ */}
        {phase === "invite-member" && selectedInviteMember && (
          <div className="space-y-4 pt-4">
            <ChatBubble>
              <p>
                {selectedInviteMember.emoji}{" "}
                <strong>{selectedInviteMember.name}</strong>
                {selectedInviteMember.role === "grandparent" &&
                  " — 穏やかで信頼感のある話し方でやり取りします。"}
                {selectedInviteMember.role === "teen" &&
                  " — 友達のような親しみのある口調でチャットします。"}
                {selectedInviteMember.role === "child" &&
                  " — 励ましながら見守ります。"}
              </p>
            </ChatBubble>

            <div className="ml-12 overflow-hidden rounded-2xl bg-white p-6 shadow-md animate-[slideUp_0.3s_ease-out]">
              <QRCodePlaceholder name={selectedInviteMember.name} />
            </div>

            <ChatBubble delay={300}>
              <p className="text-[14px]">
                この QR コードを{selectedInviteMember.name}
                に送ってください 📱
                <br />
                <span className="text-gray-500">
                  友だち追加するだけで完了。入力は不要です。
                </span>
              </p>
            </ChatBubble>

            {/* Family member LINE preview */}
            <div className="ml-12">
              <PhoneFrame
                label={`↓ ${selectedInviteMember.name}が見る画面 ↓`}
                persona={`🤵 ${name}`}
              >
                <div className="space-y-3 p-4">
                  <div className="flex gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                      style={{
                        background: `linear-gradient(135deg, ${brand.darkTeal}, ${brand.lightTeal})`,
                      }}
                    >
                      🤵
                    </div>
                    <div
                      className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] shadow-sm"
                      style={{ color: brand.charcoal }}
                    >
                      <p className="font-medium">
                        {selectedInviteMember.name}
                        {selectedInviteMember.role === "grandparent"
                          ? "さん"
                          : ""}
                        、こんにちは！👋
                      </p>
                      <p className="mt-1 text-[12px] text-gray-500">
                        私は{name}
                        、Mayumi
                        さんが手配した家族のバトラーです。
                      </p>
                      <p className="mt-1.5 text-[12px] text-gray-500">
                        設定は不要です。
                        <br />
                        そのままチャットしてください 😊
                      </p>
                    </div>
                  </div>
                </div>
              </PhoneFrame>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <PillButton
                variant="primary"
                onClick={() => setPhase("invite")}
              >
                次の家族を招待
              </PillButton>
              <PillButton
                variant="outline"
                onClick={() => setPhase("ready")}
              >
                招待完了
              </PillButton>
            </div>
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ══════ CONSTITUTION (AI-suggested, Week 2) ══════ */}
        {phase === "constitution" && (
          <div className="space-y-4 pt-4">
            <div className="flex justify-center">
              <div
                className="rounded-full px-4 py-1.5 text-xs font-medium"
                style={{
                  background: `${brand.sky}40`,
                  color: brand.darkTeal,
                }}
              >
                ⏰ 2 週間後 — AI バトラー観察期間終了
              </div>
            </div>

            <ChatBubble>
              <p className="font-medium">
                Mayumi さん、ご家族と 2 週間過ごしました 🏠
              </p>
              <p className="mt-1.5 text-[14px] text-gray-500">
                いくつかの習慣に気づいたので、
                確認させてください。
              </p>
            </ChatBubble>

            <ChatBubble delay={300}>
              <p className="font-medium" style={{ color: brand.darkTeal }}>
                📋 観察から提案する家族ルール：
              </p>
            </ChatBubble>

            <div className="space-y-3 pl-12 pr-1">
              {constitutionRules.map((rule, i) => (
                <div
                  key={i}
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 ${
                    rule.confirmed === true
                      ? "ring-2"
                      : rule.confirmed === false
                        ? "opacity-50"
                        : ""
                  }`}
                  style={{
                    ...(rule.confirmed === true
                      ? {
                          boxShadow: `0 0 0 2px ${brand.darkTeal}`,
                        }
                      : {}),
                  }}
                >
                  <div className="flex items-center gap-2.5 px-4 pb-1 pt-3.5">
                    <span className="text-xl">{rule.icon}</span>
                    <h4
                      className="text-sm font-semibold"
                      style={{ color: brand.charcoal }}
                    >
                      {rule.title}
                    </h4>
                  </div>
                  <p
                    className="px-4 text-sm leading-relaxed"
                    style={{ color: brand.charcoal }}
                  >
                    「{rule.description}」
                  </p>
                  <div
                    className="mx-4 mt-2 rounded-lg px-3 py-2 text-[12px]"
                    style={{
                      background: `${brand.sky}20`,
                      color: "#666",
                    }}
                  >
                    📊 根拠：{rule.source}
                  </div>
                  {rule.confirmed === null ? (
                    <div className="flex gap-2 px-4 py-3">
                      <button
                        onClick={() =>
                          handleConstitutionAction(i, true)
                        }
                        className="flex-1 rounded-xl py-2 text-sm font-medium text-white transition-all active:scale-95"
                        style={{ background: brand.darkTeal }}
                      >
                        ✓ このルールを確認
                      </button>
                      <button
                        onClick={() =>
                          handleConstitutionAction(i, false)
                        }
                        className="rounded-xl border px-4 py-2 text-sm font-medium transition-all active:scale-95"
                        style={{
                          borderColor: "#E0DCD7",
                          color: "#999",
                        }}
                      >
                        修正
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5">
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: rule.confirmed
                            ? brand.darkTeal
                            : "#999",
                        }}
                      >
                        {rule.confirmed ? "✓ 確認済み" : "✕ スキップ"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {constitutionRules.every((r) => r.confirmed !== null) && (
              <ChatBubble delay={200}>
                <p className="font-medium">
                  素晴らしい！
                  {constitutionRules.filter((r) => r.confirmed).length}{" "}
                  件のルールを設定しました ✨
                </p>
                <p className="mt-1.5 text-[14px] text-gray-500">
                  このルールを厳守します。「ルール管理」と言えばいつでも変更できます。
                </p>
                <p className="mt-2 text-[14px] text-gray-500">
                  新しい習慣を見つけたら、また提案しますね 😊
                </p>
              </ChatBubble>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <div
        className="absolute inset-x-0 bottom-0 border-t px-6 pb-8 pt-3"
        style={{ borderColor: "#E8E4DF", background: brand.cream }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const idx = allPhases.indexOf(phase);
              if (idx > 0) setPhase(allPhases[idx - 1]);
            }}
            className="rounded-xl px-3 py-2 text-sm font-medium transition-colors active:scale-95"
            style={{ color: brand.darkTeal }}
          >
            ← 前へ
          </button>
          <span
            className="text-[11px] font-medium"
            style={{ color: "#BBB" }}
          >
            Onboarding Mockup
          </span>
          <button
            onClick={() => {
              ensureDemoData();
              const idx = allPhases.indexOf(phase);
              if (idx < allPhases.length - 1) setPhase(allPhases[idx + 1]);
            }}
            className="rounded-xl px-3 py-2 text-sm font-medium transition-colors active:scale-95"
            style={{ color: brand.darkTeal }}
          >
            次へ →
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
