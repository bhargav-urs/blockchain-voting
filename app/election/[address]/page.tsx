"use client";
// app/election/[address]/page.tsx — Ballot + Voting + Results

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ElectionService,
  ElectionInfo,
  CandidateResult,
  VoterStatus,
  MyVote,
} from "@/lib/services/blockchain";
import { appConfig } from "@/lib/config/env";
import { useWallet } from "@/lib/hooks/useWallet";
import {
  LoadingPage,
  Alert,
  StatusBadge,
  Countdown,
  CopyBox,
  ProgressBar,
  TxLink,
  AddrLink,
  SectionHeader,
} from "@/components/ui";

type Phase = "idle" | "loading" | "confirming" | "success" | "error";

export default function ElectionPage() {
  const { address } = useParams<{ address: string }>();
  const { account, connect, isConnecting } = useWallet();

  const [info, setInfo]                   = useState<ElectionInfo | null>(null);
  const [candidates, setCandidates]       = useState<CandidateResult[]>([]);
  const [voterStatus, setVoterStatus]     = useState<VoterStatus | null>(null);
  const [myVote, setMyVote]               = useState<MyVote | null>(null);
  const [selected, setSelected]           = useState<number | null>(null);
  const [phase, setPhase]                 = useState<Phase>("loading");
  const [txHash, setTxHash]               = useState<string | null>(null);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [shareUrl, setShareUrl]           = useState("");
  const [txLogs, setTxLogs]               = useState<{ hash: string; ts: number; block: number }[]>([]);
  const [logsLoading, setLogsLoading]     = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  const load = useCallback(async () => {
    if (!address) return;
    try {
      const [infoData, resultData] = await Promise.all([
        ElectionService.getInfo(address),
        ElectionService.getResults(address),
      ]);
      setInfo(infoData);
      setCandidates(resultData);

      if (account) {
        const status = await ElectionService.getVoterStatus(address, account);
        setVoterStatus(status);
        if (status.voted) {
          const mv = await ElectionService.getMyVote(address);
          setMyVote(mv);
        }
      }

      setPhase("idle");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to load election.");
      setPhase("error");
    }
  }, [address, account]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh results every 15s
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  // Fetch VoteCast event log (public on-chain, no voter identity revealed in UI)
  const fetchTxLogs = useCallback(async () => {
    if (!address) return;
    setLogsLoading(true);
    try {
      const { ethers } = await import("ethers");
      const { electionAbi } = await import("@/lib/abi/electionAbi");
      const provider = new ethers.JsonRpcProvider(appConfig.rpcUrl);
      const contract = new ethers.Contract(address, electionAbi, provider);
      const filter = contract.filters.VoteCast();
      const events = await contract.queryFilter(filter);
      const logs = await Promise.all(events.map(async (e: any) => {
        const block = await provider.getBlock(e.blockNumber);
        return {
          hash:  e.transactionHash,
          ts:    block ? Number(block.timestamp) : 0,
          block: e.blockNumber,
        };
      }));
      setTxLogs(logs.sort((a, b) => a.ts - b.ts));
    } catch { /* silently fail */ }
    finally { setLogsLoading(false); }
  }, [address]);

  useEffect(() => { fetchTxLogs(); }, [fetchTxLogs]);

  async function castVote() {
    if (selected === null || !address) return;
    setPhase("confirming");
    setErrorMsg(null);
    try {
      const hash = await ElectionService.vote(address, selected);
      setTxHash(hash);
      setPhase("success");
      await load();
    } catch (e: any) {
      setErrorMsg(
        e.reason ?? e.shortMessage ?? e.message ?? "Transaction failed."
      );
      setPhase("error");
    }
  }

  if (phase === "loading") return <LoadingPage message="Loading election from blockchain…" />;

  if (phase === "error" && !info) {
    return (
      <div className="page-content page-enter">
        <Alert variant="error">{errorMsg ?? "Election not found."}</Alert>
        <Link href="/elections" className="btn btn-ghost" style={{ marginTop: 16 }}>← Back to Elections</Link>
      </div>
    );
  }

  if (!info) return null;

  const now = Date.now() / 1000;

  // canSelectCard: can the user click a candidate to highlight it?
  // Does NOT require selected !== null (that would be circular)
  const canSelectCard =
    !!account &&
    !!voterStatus?.registered &&
    !voterStatus?.voted &&
    info.isVotingOpen;

  // canSubmitVote: all conditions met AND a candidate has been chosen
  const canVote = canSelectCard && selected !== null;

  const isUpcoming = info.isActive && now < info.startTime;
  const isEnded    = info.isActive && now > info.endTime;

  // Tie detection: find the highest vote count, then collect ALL candidates at that count
  const maxVotes = candidates.reduce((m, c) => Math.max(m, c.voteCount), 0);
  const leaders  = candidates.filter(c => c.voteCount === maxVotes && maxVotes > 0);
  const isTie    = !info.isVotingOpen && leaders.length > 1 && info.totalVotes > 0;
  const hasWinner = !info.isVotingOpen && leaders.length === 1 && info.totalVotes > 0;

  return (
    <div className="page-content page-enter">
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <Link href="/elections" className="text-muted text-sm" style={{ marginBottom: 12, display: "inline-block" }}>
          ← All Elections
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.2rem)" }}>{info.title}</h1>
              <StatusBadge isActive={info.isActive} isVotingOpen={info.isVotingOpen} startTime={info.startTime} endTime={info.endTime} />
            </div>
            {info.description && <p className="text-muted">{info.description}</p>}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-value">{info.totalVotes}</div>
          <div className="stat-label">Total Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{candidates.length}</div>
          <div className="stat-label">Candidates</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: "clamp(0.8rem, 2vw, 1.1rem)", lineHeight: 1.3 }}>{new Date(info.startTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          <div className="stat-value" style={{ fontSize: "0.7rem", color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{new Date(info.startTime * 1000).getFullYear()}</div>
          <div className="stat-label">Opens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: "clamp(0.8rem, 2vw, 1.1rem)", lineHeight: 1.3 }}>{new Date(info.endTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          <div className="stat-value" style={{ fontSize: "0.7rem", color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{new Date(info.endTime * 1000).getFullYear()}</div>
          <div className="stat-label">Closes</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>

        {/* ── Left Column: Ballot ── */}
        <div>
          {/* Countdown */}
          {info.isActive && (
            <div className="card" style={{ marginBottom: 20 }}>
              {info.isVotingOpen ? (
                <Countdown targetTime={info.endTime} label="Voting closes in" />
              ) : isUpcoming ? (
                <Countdown targetTime={info.startTime} label="Voting opens in" />
              ) : (
                <div>
                  <p className="text-sm text-muted">Voting closed on {new Date(info.endTime * 1000).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* Voter Status */}
          {!account ? (
            <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>🦊</div>
              <h3 style={{ marginBottom: 8 }}>Connect your wallet to vote</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                You need MetaMask connected to check your eligibility and cast a vote.
              </p>
              <button className="btn btn-primary btn-full" onClick={connect} disabled={isConnecting}>
                {isConnecting ? "Connecting…" : "Connect MetaMask"}
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title">Your Status</span>
                {voterStatus?.voted && <span className="badge badge-open">Voted ✓</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="text-muted">Wallet</span>
                  <AddrLink address={account} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="text-muted">Registered</span>
                  <span style={{ color: voterStatus?.registered ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {voterStatus?.registered ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="text-muted">Voted</span>
                  <span style={{ color: voterStatus?.voted ? "var(--cyan)" : "var(--text-3)", fontWeight: 600 }}>
                    {voterStatus?.voted ? "✓ Yes" : "Not yet"}
                  </span>
                </div>
                {myVote?.voted && (
                  <>
                    <div className="divider" style={{ margin: "4px 0" }} />
                    <div className="alert alert-info" style={{ fontSize: "0.82rem" }}>
                      You voted for <strong>{myVote.candidateName}</strong> on {new Date(myVote.timestamp * 1000).toLocaleString()}
                    </div>
                  </>
                )}
                {!voterStatus?.registered && (
                  <div className="alert alert-warn" style={{ fontSize: "0.82rem" }}>
                    Your wallet is not registered for this election. Contact the admin.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ballot Cards */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h3>Candidates</h3>
            {canSelectCard && !voterStatus?.voted && (
              <span style={{
                fontSize: "0.75rem",
                color: "var(--cyan)",
                background: "var(--cyan-dim)",
                border: "1px solid var(--border-2)",
                borderRadius: 20,
                padding: "3px 10px",
                fontWeight: 600,
              }}>
                👆 Click a candidate to select, then vote
              </span>
            )}
          </div>

          {phase === "success" && txHash && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              ✅ Vote recorded on blockchain! Tx: <TxLink hash={txHash} />
            </div>
          )}

          {phase === "error" && errorMsg && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {errorMsg}
            </div>
          )}

          <div className="candidates-grid" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
            {candidates.map((c) => {
              const isMyChoice = myVote?.voted && myVote.candidateId === c.id;
              // Cards are not selectable only if voting is fully closed or already voted
              const cardClickable = canSelectCard && !voterStatus?.voted;

              return (
                <div
                  key={c.id}
                  className={`candidate-card ${selected === c.id && !voterStatus?.voted ? "selected" : ""} ${!cardClickable ? "disabled" : ""} ${isMyChoice ? "selected" : ""}`}
                  onClick={() => {
                    if (cardClickable) setSelected(c.id);
                  }}
                  title={cardClickable ? `Click to select ${c.name}` : ""}
                  style={{ cursor: cardClickable ? "pointer" : "default" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div className="candidate-avatar">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="candidate-name">{c.name}</div>
                      <div className="candidate-id">Candidate #{c.id}</div>
                    </div>
                    {isMyChoice && (
                      <span className="badge badge-open" style={{ fontSize: "0.7rem" }}>Your Vote</span>
                    )}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.8rem" }}>
                      <span className="text-muted">{c.voteCount} vote{c.voteCount !== 1 ? "s" : ""}</span>
                      <span className="text-cyan" style={{ fontWeight: 700 }}>{c.percentage}%</span>
                    </div>
                    <ProgressBar value={c.voteCount} max={info.totalVotes || 1} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vote Button */}
          {account && !voterStatus?.voted && info.isVotingOpen && voterStatus?.registered && (
            <div style={{ marginTop: 20 }}>
              <button
                className={`btn btn-primary btn-full btn-lg ${phase === "confirming" ? "btn-loading" : ""}`}
                onClick={castVote}
                disabled={selected === null || phase === "confirming"}
              >
                {phase === "confirming"
                  ? "Confirm in MetaMask…"
                  : selected === null
                  ? "Select a Candidate"
                  : `Vote for ${candidates.find((c) => c.id === selected)?.name}`}
              </button>
              <p className="text-faint text-xs text-center" style={{ marginTop: 8 }}>
                This action is permanent and irreversible. Make sure MetaMask is on {appConfig.chainName}.
              </p>
            </div>
          )}
        </div>

        {/* ── Right Column: Results + Info ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Live Results */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📊 Live Results</span>
              {info.totalVotes > 0 && !info.isVotingOpen && (
                <span className="badge badge-closed">Final</span>
              )}
            </div>

            {info.totalVotes === 0 ? (
              <p className="text-muted text-sm">No votes have been cast yet.</p>
            ) : (
              <div>
                {/* Tie banner */}
                {isTie && (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,146,60,0.1))",
                    border: "1px solid rgba(251,191,36,0.4)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 16,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>🤝</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem", color: "var(--cyan)" }}>
                      It&apos;s a Tie!
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 4 }}>
                      {leaders.map(l => l.name).join(" and ")} are tied with {maxVotes} vote{maxVotes !== 1 ? "s" : ""} each.
                    </div>
                  </div>
                )}

                {/* Winner banner */}
                {hasWinner && (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(74,222,128,0.12), rgba(0,200,80,0.06))",
                    border: "1px solid rgba(74,222,128,0.35)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 16,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>🏆</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem", color: "var(--green)" }}>
                      {leaders[0].name} wins!
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 4 }}>
                      {leaders[0].voteCount} vote{leaders[0].voteCount !== 1 ? "s" : ""} · {leaders[0].percentage}% of total
                    </div>
                  </div>
                )}

                {candidates.map((c, i) => {
                  const isLeader = leaders.some(l => l.id === c.id) && info.totalVotes > 0 && !info.isVotingOpen;
                  const COLORS = [
                    "linear-gradient(90deg, var(--cyan), #d97706)",
                    "linear-gradient(90deg, var(--purple), #7c3aed)",
                    "linear-gradient(90deg, var(--green), #059669)",
                    "linear-gradient(90deg, #f87171, #dc2626)",
                  ];
                  return (
                    <div key={c.id} className={`result-item ${isLeader ? "result-winner" : ""}`}>
                      <div className="result-header">
                        <span className="result-name">
                          {isLeader && isTie && "🤝 "}
                          {isLeader && hasWinner && "🏆 "}
                          {c.name}
                        </span>
                        <div className="result-meta">
                          <span className="result-count">{c.voteCount}</span>
                          <span className="result-pct">{c.percentage}%</span>
                        </div>
                      </div>
                      <ProgressBar
                        value={c.voteCount}
                        max={info.totalVotes}
                        color={COLORS[i % COLORS.length]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contract Info */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔗 Contract Details</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div className="text-faint text-xs" style={{ marginBottom: 4 }}>Election Contract</div>
                <CopyBox value={address} />
              </div>
              {appConfig.explorerUrl && (
                <a
                  href={`${appConfig.explorerUrl}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: "flex-start" }}
                >
                  View on PolygonScan ↗
                </a>
              )}
              <div className="divider" style={{ margin: "4px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Created</span>
                  <span>{new Date(info.createdAt * 1000).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Opens</span>
                  <span>{new Date(info.startTime * 1000).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">Closes</span>
                  <span>{new Date(info.endTime * 1000).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Share */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔗 Share This Election</span>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
              Send this link to registered voters.
            </p>
            <CopyBox value={shareUrl} />
          </div>

          {/* On-Chain Transaction Log */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📜 On-Chain Transaction Log</span>
              <button className="btn btn-ghost btn-sm" onClick={fetchTxLogs} disabled={logsLoading}>
                {logsLoading ? "…" : "↺"}
              </button>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
              Every vote is a permanent blockchain transaction. Anyone can verify these records
              — but <strong>who voted for whom is kept private</strong> in this interface.
            </p>

            {logsLoading ? (
              <p className="text-faint text-xs">Loading transactions…</p>
            ) : txLogs.length === 0 ? (
              <p className="text-muted text-sm">No transactions yet. Votes will appear here once cast.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {txLogs.map((log, i) => (
                  <div key={log.hash} style={{
                    background: "var(--bg-3)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: "0.8rem",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--cyan-dim)", border: "1px solid var(--border-2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-display)", fontWeight: 800,
                      color: "var(--cyan)", fontSize: "0.7rem", flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Vote cast</div>
                      <div className="text-faint" style={{ fontSize: "0.72rem" }}>
                        {new Date(log.ts * 1000).toLocaleString()} · Block #{log.block}
                      </div>
                    </div>
                    {appConfig.explorerUrl ? (
                      <a
                        href={`${appConfig.explorerUrl}/tx/${log.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.72rem",
                          color: "var(--cyan)",
                          flexShrink: 0,
                        }}
                      >
                        {log.hash.slice(0, 8)}…{log.hash.slice(-4)} ↗
                      </a>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-3)" }}>
                        {log.hash.slice(0, 8)}…{log.hash.slice(-4)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {txLogs.length > 0 && (
              <div style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "var(--cyan-dim)",
                border: "1px solid var(--border-2)",
                borderRadius: 8,
                fontSize: "0.78rem",
                color: "var(--text-2)",
              }}>
                ✅ <strong>{txLogs.length} vote{txLogs.length !== 1 ? "s" : ""}</strong> permanently recorded on blockchain.
                The count matches <strong>{info.totalVotes} total votes</strong> shown above.{" "}
                {appConfig.explorerUrl && (
                  <a href={`${appConfig.explorerUrl}/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-cyan">
                    Verify independently on PolygonScan ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
