"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ElectionRow = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type DashboardPayload = {
  elections: ElectionRow[];
};

type Props = {
  initialPayload: DashboardPayload;
};

export default function AdminDashboardOverview({ initialPayload }: Props) {
  const [payload, setPayload] = useState<DashboardPayload | null>(initialPayload);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [electionForm, setElectionForm] = useState({
    title: "",
    description: "",
    is_active: true,
  });

  const refreshElections = async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load elections.");
      }
      setPayload({ elections: data.elections ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    }
  };

  const handleCreateElection = async () => {
    if (!electionForm.title.trim()) {
      return;
    }
    setBusy("create-election");
    setError(null);
    try {
      const response = await fetch("/api/admin/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(electionForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create election.");
      }

      setElectionForm({ title: "", description: "", is_active: true });
      await refreshElections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  if (!payload) {
    return (
      <div className="glass-panel rounded-3xl p-8">
        <p className="text-ink/70">{error ?? "Loading elections..."}</p>
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-[1.75rem] p-6">
          <h2 className="text-lg font-semibold text-ink">Create Election</h2>
          <p className="mt-2 text-sm text-ink/65">
            Example: President Election, Vice President Election.
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
              placeholder="Election description (optional)"
              rows={2}
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
              Mark as active election
            </label>
            <button
              className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-[#28408d] disabled:opacity-60"
              onClick={handleCreateElection}
              disabled={!electionForm.title.trim() || busy === "create-election"}
            >
              {busy === "create-election" ? "Creating..." : "Create Election"}
            </button>
          </div>
        </div>
        <div className="glass-panel rounded-[1.75rem] p-6">
          <h2 className="text-lg font-semibold text-ink">Quick Guide</h2>
          <p className="mt-2 text-sm text-ink/65">
            Keep one election active for live voting, then open Manage to handle voters, approvals,
            sessions, candidates, and votes.
          </p>
          <div className="mt-4 space-y-2 text-sm text-ink/70">
            <p>1. Create an election card.</p>
            <p>2. Open Manage.</p>
            <p>3. Import voter list and approve live photos.</p>
            <p>4. Track results from the election dashboard.</p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Created Elections</h2>
          <p className="mt-2 text-sm text-ink/65">
            Click Manage to open the election in its own full-screen dashboard.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {payload.elections.length ? (
            payload.elections.map((election) => (
              <div
                key={election.id}
                className="glass-panel rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_54px_rgba(8,31,92,0.16)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-ink">{election.title}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${election.is_active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {election.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink/65">
                      {election.description || "No description provided."}
                    </p>
                  </div>
                  <Link
                    className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-[#28408d]"
                    href={`/admin/dashboard/${election.id}`}
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-panel rounded-3xl p-8 text-sm text-ink/65">
              No elections created yet. Use Create Election to add the first one.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}