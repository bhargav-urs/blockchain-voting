"use client";
// app/page.tsx — Landing page

import Link from "next/link";

const FEATURES = [
  {
    icon: "🔒",
    title: "Immutable on Chain",
    desc: "Every vote is permanently recorded on Polygon. Once cast, it cannot be changed, deleted, or tampered with by anyone — not even the admin.",
  },
  {
    icon: "🦊",
    title: "MetaMask Identity",
    desc: "Voters authenticate with their own MetaMask wallet. No passwords, no accounts to create — your wallet IS your identity.",
  },
  {
    icon: "🗳️",
    title: "One Vote Per Wallet",
    desc: "The smart contract enforces a strict one-vote-per-registered-wallet rule. Double voting is technically impossible.",
  },
  {
    icon: "🔍",
    title: "Public Audit Trail",
    desc: "Anyone can verify results directly on PolygonScan. Aggregate vote counts are fully transparent while individual choices stay private.",
  },
  {
    icon: "🔑",
    title: "Admin-Controlled Access",
    desc: "Only the admin can create elections, register eligible voters, and control the open/close window. Results are publicly visible to all.",
  },
  {
    icon: "🆓",
    title: "Completely Free",
    desc: "Deployed on Polygon Amoy testnet using free test MATIC. No real money required — perfect for classroom and organisational use.",
  },
];

const HOW = [
  { num: "01", title: "Admin Creates Election", desc: "The admin connects their MetaMask wallet, creates an election with candidates, start/end dates, and registers eligible voter wallets." },
  { num: "02", title: "Voters Receive Link", desc: "Registered voters receive a unique election link. They click it, connect their MetaMask wallet to Polygon Amoy, and see the ballot." },
  { num: "03", title: "Cast Your Vote", desc: "If registered and within the time window, the voter selects a candidate and confirms the transaction in MetaMask. Gas is paid in free test MATIC." },
  { num: "04", title: "Verify on Blockchain", desc: "After voting, a transaction hash is shown. Anyone can look it up on PolygonScan to confirm the vote was permanently recorded on chain." },
];

export default function HomePage() {
  return (
    <div className="page-enter">
      {/* ── Hero ── */}
      <section className="hero container">
        <div className="hero-eyebrow">
          ⛓ Powered by Polygon Amoy Testnet
        </div>
        <h1 className="hero-title">
          Elections you can<br />
          <span className="highlight">actually trust</span>
        </h1>
        <p className="hero-subtitle">
          ChainVote brings transparent, tamper-proof voting to your classroom, club, or organisation — completely free, backed by blockchain technology.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/elections" className="btn btn-primary btn-lg">
            Browse Elections →
          </Link>
          <Link href="/admin" className="btn btn-outline btn-lg">
            Admin Portal
          </Link>
        </div>

        {/* Chain decoration */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          marginTop: 48,
          opacity: 0.25,
          fontSize: "0.7rem",
          fontFamily: "var(--font-mono)",
          color: "var(--cyan)",
          letterSpacing: "0.05em",
          flexWrap: "wrap",
        }}>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center" }}>
              <span style={{
                background: "var(--border)",
                border: "1px solid var(--border-2)",
                padding: "4px 10px",
                borderRadius: 4,
              }}>
                0x{(0xA0B1C2 + i * 0x1337).toString(16).toUpperCase()}
              </span>
              {i < 6 && <span style={{ margin: "0 2px" }}>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{
        background: "var(--bg-2)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "24px 0",
      }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 24, textAlign: "center" }}>
            {[
              { v: "100%", l: "On-Chain" },
              { v: "0", l: "Server Storage" },
              { v: "Free", l: "Test MATIC" },
              { v: "∞", l: "Auditability" },
            ].map((s) => (
              <div key={s.l}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 800, color: "var(--cyan)" }}>{s.v}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2>Why blockchain voting?</h2>
            <p className="text-muted" style={{ marginTop: 8, maxWidth: 480, margin: "8px auto 0" }}>
              Traditional voting systems rely on trust in a central server. ChainVote puts the trust in mathematics.
            </p>
          </div>
          <div className="grid-auto">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div style={{ fontSize: "2rem", marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ marginBottom: 8 }}>{f.title}</h3>
                <p className="text-muted text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{
        padding: "80px 0",
        background: "var(--bg-2)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2>How it works</h2>
            <p className="text-muted" style={{ marginTop: 8 }}>From election creation to verifiable result in four steps.</p>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 0,
            position: "relative",
          }}>
            {HOW.map((step, i) => (
              <div key={step.num} style={{
                padding: "24px 28px",
                borderLeft: i === 0 ? "none" : "1px solid var(--border)",
                position: "relative",
              }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  color: "var(--cyan)",
                  opacity: 0.2,
                  lineHeight: 1,
                  marginBottom: 12,
                }}>
                  {step.num}
                </div>
                <h3 style={{ marginBottom: 8, fontSize: "1rem" }}>{step.title}</h3>
                <p className="text-muted text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 0", textAlign: "center" }}>
        <div className="container">
          <h2 style={{ marginBottom: 12 }}>Ready to run your first election?</h2>
          <p className="text-muted" style={{ marginBottom: 28 }}>
            Get free test MATIC from the Polygon faucet, deploy the contract, and you're live in minutes.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/admin" className="btn btn-primary btn-lg">
              Open Admin Portal
            </Link>
            <a
              href="https://faucet.polygon.technology"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-lg"
            >
              Get Free Test MATIC ↗
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
