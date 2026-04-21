"use client";
// app/admin/page.tsx — Admin Portal

import { useEffect, useState, useCallback } from "react";
import { isAddress } from "ethers";
import Link from "next/link";
import {
  FactoryService,
  ElectionService,
  ElectionRecord,
  ElectionInfo,
  CandidateResult,
} from "@/lib/services/blockchain";
import { useWallet } from "@/lib/hooks/useWallet";
import { appConfig } from "@/lib/config/env";
import {
  Alert,
  LoadingPage,
  CopyBox,
  StatusBadge,
  SectionHeader,
  TxLink,
  AddrLink,
  Spinner,
} from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = "create" | "manage";

interface FlashMsg { type: "success" | "error" | "warn" | "info"; text: string; }

// ── Helpers ────────────────────────────────────────────────────────────────
function toDatetimeLocal(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toISOString().slice(0, 16);
}

function fromDatetimeLocal(val: string): number {
  return Math.floor(new Date(val).getTime() / 1000);
}

function nowPlusHours(h: number): string {
  return toDatetimeLocal(Math.floor(Date.now() / 1000) + h * 3600);
}

// ── Sub-components ─────────────────────────────────────────────────────────
function VoterList({ voters, onRemove }: { voters: string[]; onRemove: (v: string) => void }) {
  if (!voters.length) return <p className="text-muted text-sm">No voters added yet.</p>;
  return (
    <div className="voter-tags">
      {voters.map((v) => (
        <div key={v} className="voter-tag">
          {v.slice(0, 8)}…{v.slice(-4)}
          <button className="remove-btn" onClick={() => onRemove(v)} title="Remove">✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { account, connect, isConnecting } = useWallet();

  const [factoryOwner, setFactoryOwner] = useState<string | null>(null);
  const [elections, setElections]       = useState<ElectionRecord[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [flash, setFlash]               = useState<FlashMsg | null>(null);
  const [tab, setTab]                   = useState<Tab>("create");

  // Create form
  const [title, setTitle]             = useState("");
  const [description, setDesc]        = useState("");
  const [candidatesRaw, setCands]     = useState("Alice\nBob\nCharlie");
  const [startVal, setStart]          = useState(nowPlusHours(1));
  const [endVal, setEnd]              = useState(nowPlusHours(25));
  const [pendingVoters, setPending]   = useState<string[]>([]);
  const [voterInput, setVoterInput]   = useState("");
  const [creating, setCreating]       = useState(false);

  // Manage section
  const [selectedAddr, setSelected]   = useState<string | null>(null);
  const [selInfo, setSelInfo]         = useState<ElectionInfo | null>(null);
  const [selResults, setSelResults]   = useState<CandidateResult[]>([]);
  const [manageVoterIn, setManageVoterIn] = useState("");
  const [actionBusy, setActionBusy]   = useState(false);
  const [loadingElection, setLoadingElection] = useState(false);

  function showFlash(type: FlashMsg["type"], text: string) {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 7000);
  }

  // Load factory data
  const loadAdmin = useCallback(async () => {
    if (!appConfig.factoryAddress) return;
    try {
      const [owner, records] = await Promise.all([
        FactoryService.getOwner(),
        FactoryService.getAllElections(),
      ]);
      setFactoryOwner(owner);
      setElections([...records].reverse());
    } catch (e: any) {
      showFlash("error", e.message ?? "Failed to load admin data.");
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  // Check if connected wallet is the admin
  const isAdmin = !!(account && factoryOwner && account.toLowerCase() === factoryOwner.toLowerCase());
  const showAdminWarning = !!(account && factoryOwner && !isAdmin);

  // Load selected election details
  const loadElection = useCallback(async (addr: string) => {
    setLoadingElection(true);
    try {
      const [info, results] = await Promise.all([
        ElectionService.getInfo(addr),
        ElectionService.getResults(addr),
      ]);
      setSelInfo(info);
      setSelResults(results);
    } catch (e: any) {
      showFlash("error", e.message);
    } finally {
      setLoadingElection(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAddr) loadElection(selectedAddr);
  }, [selectedAddr, loadElection]);

  // ── Create election ──────────────────────────────────────────────────────
  function addPendingVoter() {
    const trimmed = voterInput.trim();
    if (!isAddress(trimmed)) { showFlash("error", "Invalid Ethereum address: " + trimmed); return; }
    if (pendingVoters.includes(trimmed.toLowerCase())) { showFlash("warn", "Already in list."); return; }
    setPending((p) => [...p, trimmed.toLowerCase()]);
    setVoterInput("");
  }

  function parseVoterInput() {
    const parts = voterInput.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const p of parts) {
      if (isAddress(p)) valid.push(p.toLowerCase());
      else invalid.push(p);
    }
    if (invalid.length) showFlash("warn", `Skipped invalid: ${invalid.join(", ")}`);
    const newOnes = valid.filter((v) => !pendingVoters.includes(v));
    setPending((p) => [...p, ...newOnes]);
    setVoterInput("");
    if (newOnes.length) showFlash("info", `Added ${newOnes.length} voter(s).`);
  }

  async function createElection() {
    const cands = candidatesRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) { showFlash("error", "Title is required."); return; }
    if (cands.length < 2) { showFlash("error", "At least 2 candidates required."); return; }
    const start = fromDatetimeLocal(startVal);
    const end   = fromDatetimeLocal(endVal);
    if (start >= end) { showFlash("error", "End time must be after start time."); return; }

    setCreating(true);
    try {
      showFlash("info", "Creating election… confirm in MetaMask.");
      const { hash, address } = await FactoryService.createElection(
        title.trim(), description.trim(), cands, start, end
      );

      if (pendingVoters.length > 0) {
        showFlash("info", `Registering ${pendingVoters.length} voter(s)… confirm in MetaMask.`);
        await ElectionService.registerVoters(address, pendingVoters);
      }

      showFlash("success", `Election created! Address: ${address}`);
      setTitle(""); setDesc(""); setCands("Alice\nBob\nCharlie"); setPending([]);
      setStart(nowPlusHours(1)); setEnd(nowPlusHours(25));
      await loadAdmin();
      setSelected(address);
      setTab("manage");
    } catch (e: any) {
      showFlash("error", e.reason ?? e.shortMessage ?? e.message ?? "Failed to create election.");
    } finally {
      setCreating(false);
    }
  }

  // ── Manage actions ───────────────────────────────────────────────────────
  async function doActivate() {
    if (!selectedAddr) return;
    setActionBusy(true);
    try {
      showFlash("info", "Activating… confirm in MetaMask.");
      await ElectionService.activate(selectedAddr);
      showFlash("success", "Election activated.");
      await loadElection(selectedAddr);
    } catch (e: any) {
      showFlash("error", e.reason ?? e.message);
    } finally { setActionBusy(false); }
  }

  async function doDeactivate() {
    if (!selectedAddr) return;
    setActionBusy(true);
    try {
      showFlash("info", "Deactivating… confirm in MetaMask.");
      await ElectionService.deactivate(selectedAddr);
      showFlash("success", "Election deactivated.");
      await loadElection(selectedAddr);
    } catch (e: any) {
      showFlash("error", e.reason ?? e.message);
    } finally { setActionBusy(false); }
  }

  async function doRegisterVoters() {
    if (!selectedAddr) return;
    const parts = manageVoterIn.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    const valid = parts.filter((p) => isAddress(p));
    if (!valid.length) { showFlash("error", "No valid addresses found."); return; }

    setActionBusy(true);
    try {
      showFlash("info", `Registering ${valid.length} voter(s)… confirm in MetaMask.`);
      await ElectionService.registerVoters(selectedAddr, valid);
      showFlash("success", `${valid.length} voter(s) registered.`);
      setManageVoterIn("");
      await loadElection(selectedAddr);
    } catch (e: any) {
      showFlash("error", e.reason ?? e.message);
    } finally { setActionBusy(false); }
  }

  // ── Pre-auth guard ───────────────────────────────────────────────────────
  if (!appConfig.factoryAddress) {
    return (
      <div className="page-content page-enter">
        <Alert variant="error">
          <strong>Contract not configured.</strong> Deploy the ElectionFactory first and set{" "}
          <code>NEXT_PUBLIC_FACTORY_ADDRESS</code> in your <code>.env.local</code> file.
        </Alert>
        <div style={{ marginTop: 20 }} className="card">
          <h3 style={{ marginBottom: 12 }}>Quick Setup</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>Run these commands to deploy:</p>
          <pre style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, fontSize: "0.82rem", color: "var(--cyan)", overflow: "auto" }}>{
`# 1. Start a local blockchain node
npm run node

# 2. In a new terminal, deploy:
npm run deploy:local

# Or for Polygon Amoy testnet:
npm run deploy:amoy`
          }</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content page-enter">
      <SectionHeader
        title="Admin Portal"
        subtitle="Create and manage elections. Only the factory owner can perform admin actions."
      />

      {/* Flash message */}
      {flash && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant={flash.type}>{flash.text}</Alert>
        </div>
      )}

      {/* Not connected */}
      {!account && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🦊</div>
          <h3 style={{ marginBottom: 8 }}>Connect Admin Wallet</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
            Connect the wallet that deployed the factory contract to access admin features.
          </p>
          <button className="btn btn-primary" onClick={connect} disabled={isConnecting}>
            {isConnecting ? "Connecting…" : "Connect MetaMask"}
          </button>
        </div>
      )}

      {showAdminWarning && (
        <Alert variant="warn">
          Connected wallet <code>{account}</code> is not the factory owner (<code>{factoryOwner}</code>).
          Admin actions will fail. Switch to the deployer wallet.
        </Alert>
      )}

      {account && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isAdmin ? "var(--green)" : "var(--red)", display: "inline-block" }} />
            <span className="text-muted">Connected:</span>
            <span className="text-mono">{account.slice(0,8)}…{account.slice(-4)}</span>
            {isAdmin && <span className="badge badge-open" style={{ fontSize: "0.65rem", padding: "2px 8px" }}>Admin</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem" }}>
            <span className="text-muted">Factory:</span>
            <AddrLink address={appConfig.factoryAddress} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-3)", padding: 4, borderRadius: 10, marginBottom: 28, width: "fit-content", border: "1px solid var(--border)" }}>
        {(["create", "manage"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}
            style={{ minWidth: 100 }}
            onClick={() => setTab(t)}
          >
            {t === "create" ? "✚ Create" : "⚙ Manage"}
          </button>
        ))}
      </div>

      {/* ── CREATE TAB ─────────────────────────────────────────────────────── */}
      {tab === "create" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 Election Details</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Student Council Election 2025"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Provide context for voters (optional)"
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Opens *</label>
                    <input type="datetime-local" className="form-input" value={startVal} onChange={(e) => setStart(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Closes *</label>
                    <input type="datetime-local" className="form-input" value={endVal} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Candidates (one per line, min 2) *</label>
                  <textarea
                    className="form-textarea"
                    value={candidatesRaw}
                    onChange={(e) => setCands(e.target.value)}
                    rows={5}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}
                  />
                  <span className="form-hint">
                    {candidatesRaw.split(/\r?\n/).filter(Boolean).length} candidate(s)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">👥 Pre-register Voters</span>
              </div>
              <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
                Add eligible wallet addresses. You can also add more after the election is created.
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  className="form-input"
                  placeholder="0x... (paste one or multiple)"
                  value={voterInput}
                  onChange={(e) => setVoterInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); parseVoterInput(); } }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button className="btn btn-outline btn-sm" onClick={parseVoterInput} disabled={!voterInput.trim()}>
                  Add Address(es)
                </button>
                {pendingVoters.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setPending([])}>
                    Clear All
                  </button>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span className="text-faint text-xs">{pendingVoters.length} voter(s) queued</span>
              </div>
              <VoterList voters={pendingVoters} onRemove={(v) => setPending((p) => p.filter((x) => x !== v))} />
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">✅ Review & Deploy</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Title</span>
                  <span style={{ fontWeight: 600, maxWidth: 200, textAlign: "right" }}>{title || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Candidates</span>
                  <span>{candidatesRaw.split(/\r?\n/).filter(Boolean).length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Pre-registered voters</span>
                  <span>{pendingVoters.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Opens</span>
                  <span>{startVal ? new Date(startVal).toLocaleString() : "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Closes</span>
                  <span>{endVal ? new Date(endVal).toLocaleString() : "—"}</span>
                </div>
              </div>
              <button
                className={`btn btn-primary btn-full ${creating ? "btn-loading" : ""}`}
                onClick={createElection}
                disabled={creating || !isAdmin}
              >
                {creating ? "Creating Election…" : "Deploy Election to Blockchain"}
              </button>
              {!isAdmin && account && (
                <p className="text-xs text-faint text-center" style={{ marginTop: 8 }}>
                  Only the factory owner can create elections.
                </p>
              )}
              {!account && (
                <p className="text-xs text-faint text-center" style={{ marginTop: 8 }}>
                  Connect your admin wallet first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE TAB ─────────────────────────────────────────────────────── */}
      {tab === "manage" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>
          {/* Election selector */}
          <div className="card" style={{ position: "sticky", top: "calc(var(--nav-h) + 16px)" }}>
            <div className="card-header">
              <span className="card-title">All Elections</span>
              <span className="badge badge-inactive">{elections.length}</span>
            </div>
            {loadingAdmin ? (
              <div style={{ textAlign: "center", padding: 20 }}><Spinner size={28} /></div>
            ) : elections.length === 0 ? (
              <p className="text-muted text-sm">No elections yet. Create one first.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {elections.map((e) => (
                  <button
                    key={e.address}
                    onClick={() => setSelected(e.address)}
                    style={{
                      background: selectedAddr === e.address ? "var(--cyan-dim)" : "var(--bg-3)",
                      border: `1px solid ${selectedAddr === e.address ? "var(--cyan)" : "var(--border)"}`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--text)",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 2 }}>{e.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                      {e.address.slice(0, 10)}…
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manage panel */}
          {!selectedAddr ? (
            <div style={{ textAlign: "center", padding: "60px 24px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>←</div>
              <p className="text-muted">Select an election to manage it.</p>
            </div>
          ) : loadingElection ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}><Spinner /></div>
          ) : selInfo ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>{selInfo.title}</h2>
                  {selInfo.description && <p className="text-muted text-sm">{selInfo.description}</p>}
                </div>
                <StatusBadge
                  isActive={selInfo.isActive}
                  isVotingOpen={selInfo.isVotingOpen}
                  startTime={selInfo.startTime}
                  endTime={selInfo.endTime}
                />
              </div>

              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{selInfo.totalVotes}</div>
                  <div className="stat-label">Votes Cast</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{selInfo.candidateCount}</div>
                  <div className="stat-label">Candidates</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{selInfo.isVotingOpen ? "LIVE" : selInfo.isActive ? "Scheduled" : "OFF"}</div>
                  <div className="stat-label">Status</div>
                </div>
              </div>

              {/* Controls */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">⚡ Election Controls</span>
                </div>
                <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                  Activate to allow voting within the scheduled window. Deactivate to pause voting at any time.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className={`btn btn-success ${actionBusy ? "btn-loading" : ""}`}
                    onClick={doActivate}
                    disabled={selInfo.isActive || actionBusy || !isAdmin}
                  >
                    ▶ Activate Election
                  </button>
                  <button
                    className={`btn btn-danger ${actionBusy ? "btn-loading" : ""}`}
                    onClick={doDeactivate}
                    disabled={!selInfo.isActive || actionBusy || !isAdmin}
                  >
                    ⏸ Deactivate
                  </button>
                  <Link
                    href={`/election/${selectedAddr}`}
                    className="btn btn-outline"
                    target="_blank"
                  >
                    View Ballot ↗
                  </Link>
                </div>
                <div style={{ marginTop: 16, fontSize: "0.82rem", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span className="text-muted">Opens: <strong>{new Date(selInfo.startTime * 1000).toLocaleString()}</strong></span>
                  <span className="text-muted">Closes: <strong>{new Date(selInfo.endTime * 1000).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Voter Registration */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">👥 Register Voters</span>
                </div>
                <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
                  Paste wallet addresses (one per line, or comma/space separated). Only valid <code>0x...</code> addresses will be accepted.
                </p>
                <textarea
                  className="form-textarea"
                  placeholder={"0x70997970C51812dc3A010C7d01b50e0d17dc79C8\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"}
                  value={manageVoterIn}
                  onChange={(e) => setManageVoterIn(e.target.value)}
                  rows={4}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    borderColor: (() => {
                      if (!manageVoterIn.trim()) return undefined;
                      const parts = manageVoterIn.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
                      const invalid = parts.filter(p => !isAddress(p));
                      return invalid.length > 0 ? "var(--red)" : "var(--green)";
                    })(),
                  }}
                />

                {/* Real-time validation feedback */}
                {manageVoterIn.trim() && (() => {
                  const parts = manageVoterIn.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
                  const valid   = parts.filter(p => isAddress(p));
                  const invalid = parts.filter(p => !isAddress(p));
                  return (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {valid.length > 0 && (
                        <div className="alert alert-success" style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
                          ✓ {valid.length} valid address{valid.length !== 1 ? "es" : ""} ready to register
                        </div>
                      )}
                      {invalid.length > 0 && (
                        <div className="alert alert-error" style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            ✗ {invalid.length} invalid entr{invalid.length !== 1 ? "ies" : "y"} — these will be skipped:
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                            {invalid.map((addr: string, i: number) => (
                              <code key={i} style={{
                                background: "rgba(248,113,113,0.15)",
                                border: "1px solid rgba(248,113,113,0.3)",
                                borderRadius: 4,
                                padding: "2px 6px",
                                fontSize: "0.75rem",
                                color: "var(--red)",
                              }}>
                                {addr.length > 20 ? addr.slice(0, 10) + "…" + addr.slice(-6) : addr}
                              </code>
                            ))}
                          </div>
                          <div style={{ marginTop: 6, fontSize: "0.75rem", opacity: 0.8 }}>
                            Ethereum addresses must start with <strong>0x</strong> and be 42 characters long.
                          </div>
                        </div>
                      )}
                      {parts.length > 0 && invalid.length === 0 && valid.length === 0 && (
                        <div className="alert alert-warn" style={{ fontSize: "0.8rem" }}>
                          No recognisable addresses found yet.
                        </div>
                      )}
                    </div>
                  );
                })()}

                <button
                  className={`btn btn-primary btn-sm ${actionBusy ? "btn-loading" : ""}`}
                  style={{ marginTop: 12 }}
                  onClick={doRegisterVoters}
                  disabled={actionBusy || !manageVoterIn.trim() || !isAdmin || (() => {
                    const parts = manageVoterIn.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
                    return parts.filter(p => isAddress(p)).length === 0;
                  })()}
                >
                  {(() => {
                    const parts = manageVoterIn.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
                    const valid = parts.filter(p => isAddress(p));
                    return valid.length > 0
                      ? `Register ${valid.length} Voter${valid.length !== 1 ? "s" : ""}`
                      : "Register Voters";
                  })()}
                </button>
              </div>

              {/* Share Link */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🔗 Voter Link</span>
                </div>
                <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
                  Share this link with registered voters:
                </p>
                <CopyBox
                  value={typeof window !== "undefined"
                    ? `${window.location.origin}/election/${selectedAddr}`
                    : `/election/${selectedAddr}`}
                />
              </div>

              {/* Results */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📊 Current Results</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => loadElection(selectedAddr!)}
                    disabled={loadingElection}
                  >
                    ↺ Refresh
                  </button>
                </div>
                {selResults.map((c) => (
                  <div key={c.id} className="result-item">
                    <div className="result-header">
                      <span className="result-name">{c.name}</span>
                      <div className="result-meta">
                        <span className="result-count">{c.voteCount} votes</span>
                        <span className="result-pct">{c.percentage}%</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${c.percentage}%` }} />
                    </div>
                  </div>
                ))}
                {selInfo.totalVotes === 0 && (
                  <p className="text-muted text-sm" style={{ marginTop: 8 }}>No votes yet.</p>
                )}
              </div>

              {/* Contract info */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🔗 Contract</span>
                </div>
                <CopyBox value={selectedAddr} label="Address" />
                {appConfig.explorerUrl && (
                  <a
                    href={`${appConfig.explorerUrl}/address/${selectedAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                  >
                    View on PolygonScan ↗
                  </a>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
