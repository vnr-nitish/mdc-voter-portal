"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type VoterRow = {
  id: string;
  registration_number: string;
  name: string;
  email: string;
  mobile_number: string | null;
  school: string | null;
  stream: string | null;
  domain: string | null;
  position: string | null;
  stay: string | null;
  branch: string | null;
  year_of_study: string | null;
  oat_score: string | null;
  vote_points: number;
  is_verified: boolean;
  has_voted: boolean;
};

type VerificationRow = {
  id: string;
  voter_id: string;
  photo_path: string;
  status: string;
  created_at: string;
  voter: { name: string; registration_number: string } | null;
};

type SessionRow = {
  id: string;
  voter_id: string;
  expires_at: string;
  is_active: boolean;
  voter: { name: string; registration_number: string } | null;
};

type VoteRow = {
  id: string;
  candidate_id: string;
  reason: string;
  created_at: string;
  points: number;
  candidate: { id: string; name: string } | null;
  voter: { name: string; registration_number: string; vote_points: number } | null;
};

type CandidateRow = {
  id: string;
  election_id: string;
  name: string;
  party_symbol_url: string | null;
  photo_url: string | null;
  manifesto: string | null;
};

type ElectionRow = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type DashboardPayload = {
  elections: ElectionRow[];
  selectedElectionId: string | null;
  voters: VoterRow[];
  pendingRequests: VerificationRow[];
  activeSessions: SessionRow[];
  votes: VoteRow[];
  candidates: CandidateRow[];
};

export default function AdminElectionDashboard({ electionId }: { electionId: string }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [electionForm, setElectionForm] = useState({
    title: "",
    description: "",
    is_active: true,
  });

  const refreshDashboard = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/dashboard?electionId=${encodeURIComponent(electionId)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load dashboard.");
      }
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    }
  }, [electionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshDashboard();
  }, [refreshDashboard]);

  const activeElection = useMemo(() => {
    if (!payload) {
      return null;
    }
    return payload.elections.find((election) => election.id === electionId) ?? null;
  }, [payload, electionId]);

  useEffect(() => {
    if (activeElection) {
      // The election edit form mirrors the currently selected election.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElectionForm({
        title: activeElection.title,
        description: activeElection.description ?? "",
        is_active: activeElection.is_active,
      });
    }
  }, [activeElection]);

  const stats = useMemo(() => {
    if (!payload) {
      return null;
    }
    return {
      voters: payload.voters.length,
      verified: payload.voters.filter((voter) => voter.is_verified).length,
      voted: payload.voters.filter((voter) => voter.has_voted).length,
      pending: payload.pendingRequests.length,
      activeSessions: payload.activeSessions.length,
    };
  }, [payload]);

  const pendingFirstId = useMemo(() => payload?.pendingRequests?.[0]?.id ?? null, [payload]);

  const candidateResults = useMemo(() => {
    if (!payload) {
      return [] as Array<{
        id: string;
        name: string;
        manifesto: string | null;
        votes: number;
        points: number;
      }>;
    }

    const resultMap = new Map<
      string,
      { id: string; name: string; manifesto: string | null; votes: number; points: number }
    >();

    payload.candidates.forEach((candidate) => {
      resultMap.set(candidate.id, {
        id: candidate.id,
        name: candidate.name,
        manifesto: candidate.manifesto,
        votes: 0,
        points: 0,
      });
    });

    payload.votes.forEach((vote) => {
      const entry = resultMap.get(vote.candidate_id);
      if (!entry) {
        return;
      }
      const points = vote.points ?? vote.voter?.vote_points ?? 1;
      entry.votes += 1;
      entry.points += points;
    });

    const candidateOrder = new Map(payload.candidates.map((candidate, index) => [candidate.id, index]));

    return Array.from(resultMap.values()).sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.votes !== left.votes) {
        return right.votes - left.votes;
      }
      return (candidateOrder.get(left.id) ?? 0) - (candidateOrder.get(right.id) ?? 0);
    });
  }, [payload]);

  const maxResultPoints = useMemo(() => Math.max(0, ...candidateResults.map((result) => result.points)), [candidateResults]);

  const currentWinner = candidateResults[0] ?? null;
  const secondCandidate = candidateResults[1] ?? null;
  const hasClearWinner =
    Boolean(currentWinner) &&
    (currentWinner?.points ?? 0) > 0 &&
    (!secondCandidate || (currentWinner?.points ?? 0) > secondCandidate.points);

  const handleSaveElection = async () => {
    if (!electionForm.title.trim()) {
      return;
    }
    setBusy("save-election");
    setError(null);
    try {
      const response = await fetch(`/api/admin/elections/${electionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(electionForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update election.");
      }
      await refreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  if (!payload) {
    return (
      <div className="glass-panel rounded-3xl p-8">
        <p className="text-ink/70">{error ?? "Loading election..."}</p>
      </div>
    );
  }

  if (!activeElection) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">MDC Club</p>
              <h1 className="text-3xl font-semibold text-ink">Election not found</h1>
            </div>
            <Link
              className="rounded-full border border-charcoal/30 bg-white px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5"
              href="/admin/dashboard"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-2xl border border-red-300/70 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">MDC Club</p>
            <h1 className="text-3xl font-semibold text-ink">Manage Election</h1>
            <p className="mt-2 text-sm text-ink/65">
              Full-screen management for {activeElection.title}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="rounded-full border border-charcoal/30 bg-white px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5"
              href="/admin/dashboard"
            >
              Back to dashboard
            </Link>
            <button
              className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
              onClick={async () => {
                if (!confirm("Delete this election and all associated data? This cannot be undone.")) return;
                try {
                  setBusy("delete-election");
                  const res = await fetch(`/api/admin/elections/${electionId}`, { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Delete failed");
                  // navigate back to dashboard
                  window.location.href = "/admin/dashboard";
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy === "delete-election"}
            >
              {busy === "delete-election" ? "Deleting..." : "Delete election"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-charcoal/10 bg-white/75 p-6">
            <h2 className="text-lg font-semibold text-ink">Edit Election</h2>
            <p className="mt-2 text-sm text-ink/65">
              Update the election name, description, or active status.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
                placeholder="Election title"
                value={electionForm.title}
                onChange={(event) =>
                  setElectionForm({ ...electionForm, title: event.target.value })
                }
              />
              <textarea
                className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
                placeholder="Election description"
                rows={3}
                value={electionForm.description}
                onChange={(event) =>
                  setElectionForm({ ...electionForm, description: event.target.value })
                }
              />
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={electionForm.is_active}
                  onChange={(event) =>
                    setElectionForm({ ...electionForm, is_active: event.target.checked })
                  }
                />
                Active election
              </label>
              <button
                className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-[#28408d] disabled:opacity-60"
                onClick={handleSaveElection}
                disabled={!electionForm.title.trim() || busy === "save-election"}
              >
                {busy === "save-election" ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-charcoal/10 bg-white/75 p-6">
            <h2 className="text-lg font-semibold text-ink">Election Summary</h2>
            <p className="mt-2 text-sm text-ink/65">
              {activeElection.description || "No description provided."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeElection.is_active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {activeElection.is_active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full bg-charcoal/5 px-3 py-1 text-xs font-semibold text-charcoal/80">
                Election ID: {activeElection.id}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-charcoal/10 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-charcoal/65">Points Trend</p>
              {hasClearWinner && currentWinner ? (
                <p className="mt-2 text-sm text-ink/80">
                  Election winner: <span className="font-semibold text-ink">{currentWinner.name}</span> ({currentWinner.points} pts)
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink/60">Election winner will appear once a clear majority is reached.</p>
              )}

              {candidateResults.length ? (
                <div className="mt-4 space-y-3">
                  {candidateResults.slice(0, 6).map((result) => {
                    const width = maxResultPoints > 0 ? Math.round((result.points / maxResultPoints) * 100) : 0;
                    return (
                      <div key={result.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-ink/70">
                          <span>{result.name}</span>
                          <span>{result.points} pts</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-charcoal/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3552b8] to-[#5f79cf]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {stats ? (
        <section className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Voters", value: stats.voters, href: `/admin/manage/voters?electionId=${electionId}` },
            { label: "Verified", value: stats.verified, href: `/admin/manage/voters?electionId=${electionId}&mode=verified` },
            { label: "Voted", value: stats.voted, href: `/admin/manage/votes?electionId=${electionId}` },
            { label: "Pending", value: stats.pending, href: `/admin/manage/approvals?electionId=${electionId}${pendingFirstId ? `&requestId=${pendingFirstId}` : ""}` },
            { label: "Active Sessions", value: stats.activeSessions, href: `/admin/manage/sessions?electionId=${electionId}` },
          ].map((item) => {
            const content = (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-charcoal/75">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{item.value}</p>
              </>
            );

            return (
              <Link
                key={item.label}
                href={item.href}
                className="glass-panel rounded-2xl p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgba(8,31,92,0.14)]"
              >
                {content}
              </Link>
            );
          })}
        </section>
      ) : null}

      <section className="glass-panel rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-ink">Management Actions</h2>
        <p className="mt-2 text-sm text-ink/65">Open management tools for this election in separate tabs.</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Link className="rounded-2xl border p-4 text-left hover:shadow" href={`/admin/manage/voters?electionId=${electionId}`}>
            <p className="font-semibold">Voter Management</p>
            <p className="text-xs text-ink/60">Import, view, edit, or add voters.</p>
          </Link>
          <Link className="rounded-2xl border p-4 text-left hover:shadow" href={`/admin/manage/approvals?electionId=${electionId}`}>
            <p className="font-semibold">Pending Verification Requests</p>
            <p className="text-xs text-ink/60">Review photos and approve or reject.</p>
          </Link>
          <Link className="rounded-2xl border p-4 text-left hover:shadow" href={`/admin/manage/sessions?electionId=${electionId}`}>
            <p className="font-semibold">Active Sessions</p>
            <p className="text-xs text-ink/60">View and terminate active sessions.</p>
          </Link>
          <Link className="rounded-2xl border p-4 text-left hover:shadow" href={`/admin/manage/candidates?electionId=${electionId}`}>
            <p className="font-semibold">Candidates Management</p>
            <p className="text-xs text-ink/60">Add or edit candidates.</p>
          </Link>
          <Link className="rounded-2xl border p-4 text-left hover:shadow" href={`/admin/manage/votes?electionId=${electionId}`}>
            <p className="font-semibold">Voting Information</p>
            <p className="text-xs text-ink/60">View votes and export results.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
