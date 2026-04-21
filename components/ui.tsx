"use client";
// components/ui.tsx — Shared reusable components

import { useState, useEffect } from "react";
import { appConfig } from "@/lib/config/env";

// ── Alert ───────────────────────────────────────────────────────────────
type AlertVariant = "info" | "success" | "error" | "warn";

const ICONS: Record<AlertVariant, string> = {
  info:    "ℹ️",
  success: "✅",
  error:   "❌",
  warn:    "⚠️",
};

export function Alert({
  variant = "info",
  children,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
}) {
  return (
    <div className={`alert alert-${variant}`}>
      <span className="alert-icon">{ICONS[variant]}</span>
      <span>{children}</span>
    </div>
  );
}

// ── Spinner ─────────────────────────────────────────────────────────────
export function Spinner({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: `${size / 12}px solid var(--border)`,
        borderTopColor: "var(--cyan)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        margin: "0 auto",
      }}
    />
  );
}

// ── Loading State ────────────────────────────────────────────────────────
export function LoadingPage({ message = "Loading…" }: { message?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <Spinner />
      <p className="text-muted" style={{ marginTop: 16 }}>{message}</p>
    </div>
  );
}

// ── Copy Button ──────────────────────────────────────────────────────────
export function CopyBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="copy-box">
      {label && <span style={{ padding: "10px 14px", fontSize: "0.8rem", color: "var(--text-3)", borderRight: "1px solid var(--border)", whiteSpace: "nowrap" }}>{label}</span>}
      <span className="copy-text" title={value}>{value}</span>
      <button className="copy-btn" onClick={copy}>
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Transaction Link ─────────────────────────────────────────────────────
export function TxLink({ hash }: { hash: string }) {
  const url = appConfig.explorerUrl ? `${appConfig.explorerUrl}/tx/${hash}` : null;
  const short = `${hash.slice(0, 10)}…${hash.slice(-6)}`;

  if (!url) {
    return <code className="mono text-xs">{short}</code>;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-mono text-cyan">
      {short} ↗
    </a>
  );
}

// ── Explorer Address Link ────────────────────────────────────────────────
export function AddrLink({ address }: { address: string }) {
  const url = appConfig.explorerUrl ? `${appConfig.explorerUrl}/address/${address}` : null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  if (!url) return <code className="mono text-xs">{short}</code>;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-mono text-cyan">
      {short} ↗
    </a>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────
// Always trust isVotingOpen from the blockchain (block.timestamp), not Date.now().
// On Hardhat local, block.timestamp only advances when transactions are mined,
// so Date.now() can be ahead of the chain — causing "Ended" / "Upcoming" mismatch.
export function StatusBadge({
  isActive,
  isVotingOpen,
  startTime,
  endTime,
}: {
  isActive: boolean;
  isVotingOpen: boolean;
  startTime: number;
  endTime: number;
}) {
  // Use JS clock only to determine upcoming vs ended when chain says not open.
  // This is display-only — the contract enforces the real check.
  const now = Date.now() / 1000;

  if (!isActive) {
    return <span className="badge badge-inactive">Inactive</span>;
  }
  if (isVotingOpen) {
    return <span className="badge badge-open">Live</span>;
  }
  // Prefer chain-derived knowledge: if endTime has passed by JS clock it's ended
  if (now > endTime) {
    return <span className="badge badge-closed">Ended</span>;
  }
  if (now < startTime) {
    return <span className="badge badge-pending">Upcoming</span>;
  }
  // Active + within window by JS clock but chain says not open yet (block lag)
  return <span className="badge badge-pending">Starting…</span>;
}

// ── Countdown Timer ──────────────────────────────────────────────────────
export function Countdown({ targetTime, label }: { targetTime: number; label?: string }) {
  const [remaining, setRemaining] = useState(Math.max(0, targetTime - Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, targetTime - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  if (remaining === 0) return <span className="text-faint text-sm">Ended</span>;

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      {label && <p className="text-xs text-faint" style={{ marginBottom: 8 }}>{label}</p>}
      <div className="countdown">
        {d > 0 && (
          <div className="countdown-unit">
            <div className="countdown-value">{pad(d)}</div>
            <div className="countdown-label">Days</div>
          </div>
        )}
        <div className="countdown-unit">
          <div className="countdown-value">{pad(h)}</div>
          <div className="countdown-label">Hrs</div>
        </div>
        <div className="countdown-unit">
          <div className="countdown-value">{pad(m)}</div>
          <div className="countdown-label">Min</div>
        </div>
        <div className="countdown-unit">
          <div className="countdown-value">{pad(s)}</div>
          <div className="countdown-label">Sec</div>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────
export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>{icon}</div>
      <h3 style={{ marginBottom: 8, color: "var(--text)" }}>{title}</h3>
      {description && <p className="text-muted text-sm" style={{ marginBottom: action ? 20 : 0 }}>{description}</p>}
      {action}
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{
          width: `${pct}%`,
          background: color ?? "linear-gradient(90deg, var(--cyan), #0066ff)",
        }}
      />
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ marginBottom: subtitle ? 4 : 0 }}>{title}</h2>
        {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
