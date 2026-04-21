"use client";
// app/elections/page.tsx — Public elections list

import { useEffect, useState } from "react";
import Link from "next/link";
import { FactoryService, ElectionRecord } from "@/lib/services/blockchain";
import { ElectionService } from "@/lib/services/blockchain";
import { LoadingPage, EmptyState, StatusBadge, SectionHeader } from "@/components/ui";
import { appConfig } from "@/lib/config/env";

interface EnrichedElection extends ElectionRecord {
  isActive: boolean;
  isVotingOpen: boolean;
  totalVotes: number;
}

export default function ElectionsPage() {
  const [elections, setElections] = useState<EnrichedElection[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!appConfig.factoryAddress) {
      setError("Factory contract not configured. Deploy the contract first and set NEXT_PUBLIC_FACTORY_ADDRESS in .env.local.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const records = await FactoryService.getAllElections();
        const enriched = await Promise.all(
          records.map(async (r) => {
            try {
              const info = await ElectionService.getInfo(r.address);
              return { ...r, isActive: info.isActive, isVotingOpen: info.isVotingOpen, totalVotes: info.totalVotes };
            } catch {
              return { ...r, isActive: false, isVotingOpen: false, totalVotes: 0 };
            }
          })
        );
        // Newest first
        setElections(enriched.reverse());
      } catch (e: any) {
        setError(e.message ?? "Failed to load elections.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <LoadingPage message="Fetching elections from blockchain…" />;

  return (
    <div className="page-content page-enter">
      <SectionHeader
        title="All Elections"
        subtitle="Public list of all elections deployed by the admin. Click an election to view the ballot and results."
      />

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>
          <span className="alert-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {!error && elections.length === 0 && (
        <EmptyState
          icon="🗳️"
          title="No elections yet"
          description="The admin hasn't created any elections. Once they do, they will appear here."
          action={<Link href="/admin" className="btn btn-outline">Go to Admin Portal</Link>}
        />
      )}

      <div className="election-list">
        {elections.map((e) => (
          <Link key={e.address} href={`/election/${e.address}`} className="election-item">
            <div style={{
              width: 44, height: 44, flexShrink: 0,
              background: "var(--cyan-dim)",
              border: "1px solid var(--border-2)",
              borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.2rem",
            }}>
              🗳️
            </div>
            <div className="election-item-body">
              <div className="election-item-title">{e.title}</div>
              <div className="election-item-meta">
                <span>📅 {new Date(e.startTime * 1000).toLocaleDateString()} – {new Date(e.endTime * 1000).toLocaleDateString()}</span>
                <span>🗳 {e.totalVotes} vote{e.totalVotes !== 1 ? "s" : ""}</span>
                <span className="text-mono" style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                  {e.address.slice(0, 10)}…
                </span>
              </div>
            </div>
            <div className="election-item-end">
              <StatusBadge
                isActive={e.isActive}
                isVotingOpen={e.isVotingOpen}
                startTime={e.startTime}
                endTime={e.endTime}
              />
              <span style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
