"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type VoterRow = {
  id: string;
  registration_number: string;
  name: string;
  email: string;
  branch: string | null;
  year_of_study: string | null;
  oat_score: string | null;
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
  reason: string;
  created_at: string;
  candidate: { name: string } | null;
  voter: { name: string; registration_number: string } | null;
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

type ImportRow = {
  registration_number: string;
  name: string;
  email: string;
  branch?: string;
  year_of_study?: string;
  oat_score?: string;
};

const parseCsvRows = (csvText: string): ImportRow[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return {
      registration_number: row.registration_number,
      name: row.name,
      email: row.email,
      branch: row.branch,
      year_of_study: row.year_of_study,
      oat_score: row.oat_score,
    };
  });
};

export default function AdminDashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<ImportRow[]>([]);
  const [managedElectionId, setManagedElectionId] = useState<string>("");
  const [electionForm, setElectionForm] = useState({
    title: "",
    description: "",
    is_active: true,
  });
  const [candidateForm, setCandidateForm] = useState({
    name: "",
    party_symbol_url: "",
    photo_url: "",
    manifesto: "",
  });

  const refreshDashboard = async (targetElectionId?: string) => {
    setError(null);
    try {
      const query = targetElectionId
        ? `?electionId=${encodeURIComponent(targetElectionId)}`
        : "";
      const response = await fetch(`/api/admin/dashboard${query}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load dashboard.");
      }
      setPayload(data);
      if (data.selectedElectionId && data.selectedElectionId !== managedElectionId) {
        setManagedElectionId(data.selectedElectionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

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
      const newElectionId = data.election?.id as string | undefined;
      if (newElectionId) {
        setManagedElectionId(newElectionId);
        await refreshDashboard(newElectionId);
      } else {
        await refreshDashboard();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsvRows(text).filter(
      (row) => row.registration_number && row.name && row.email
    );
    setCsvRows(rows);
  };

  const handleImport = async () => {
    if (!managedElectionId) {
      setError("Select an election first.");
      return;
    }
    setBusy("import");
    setError(null);
    try {
      const response = await fetch("/api/admin/import-voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvRows, electionId: managedElectionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }
      setCsvRows([]);
      await refreshDashboard(managedElectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!managedElectionId) {
      setError("Select an election first.");
      return;
    }
    setBusy(requestId);
    setError(null);
    try {
      const response = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, electionId: managedElectionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Approval failed.");
      }
      await refreshDashboard(managedElectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  const handleViewPhoto = async (photoPath: string) => {
    setBusy(photoPath);
    setError(null);
    try {
      const response = await fetch("/api/admin/photo-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: photoPath }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to fetch photo.");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    setBusy(sessionId);
    setError(null);
    try {
      const response = await fetch("/api/admin/terminate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Terminate failed.");
      }
      await refreshDashboard(managedElectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  const handleCandidateSubmit = async () => {
    if (!managedElectionId) {
      setError("Select an election first.");
      return;
    }
    setBusy("candidate");
    setError(null);
    try {
      const response = await fetch("/api/admin/create-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...candidateForm, electionId: managedElectionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Create candidate failed.");
      }
      setCandidateForm({
        name: "",
        party_symbol_url: "",
        photo_url: "",
        manifesto: "",
      });
      await refreshDashboard(managedElectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(null);
    }
  };

  const activeElection = useMemo(() => {
    if (!payload || !managedElectionId) {
      return null;
    }
    return payload.elections.find((election) => election.id === managedElectionId) ?? null;
  }, [payload, managedElectionId]);

  const stats = useMemo(() => {
    if (!payload || !managedElectionId) {
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

  if (!payload) {
    return (
      <div className="glass-panel rounded-3xl p-8">
        <p className="text-ink/70">
          {error ?? "Loading admin dashboard..."}
        </p>
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

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-ink">Election Context</h2>
          <p className="mt-2 text-sm text-ink/65">
            Select or create an election to manage.
          </p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <select
              className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink focus:border-charcoal/50 focus:outline-none"
              value={managedElectionId}
              onChange={(event) => {
                const value = event.target.value;
                setManagedElectionId(value);
                if (value) {
                  refreshDashboard(value);
                }
              }}
            >
              {!payload.elections.length ? <option value="">No elections yet</option> : null}
              {payload.elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.title}
                </option>
              ))}
            </select>
            <button
              className="rounded-full border border-charcoal/30 bg-white px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5"
              onClick={() => refreshDashboard(managedElectionId || undefined)}
            >
              Refresh
            </button>
            {managedElectionId ? (
              <div className="ml-2 flex items-center gap-2">
                <a
                  className="rounded-full border border-charcoal/30 bg-white px-3 py-1 text-sm font-semibold text-charcoal"
                  href={`/admin/manage/voters?electionId=${managedElectionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage Voters
                </a>
                <a
                  className="rounded-full border border-charcoal/30 bg-white px-3 py-1 text-sm font-semibold text-charcoal"
                  href={`/admin/manage/approvals?electionId=${managedElectionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Approval Queue
                </a>
                <a
                  className="rounded-full border border-charcoal/30 bg-white px-3 py-1 text-sm font-semibold text-charcoal"
                  href={`/admin/manage/candidates?electionId=${managedElectionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Candidates
                </a>
                <a
                  className="rounded-full border border-charcoal/30 bg-white px-3 py-1 text-sm font-semibold text-charcoal"
                  href={`/admin/manage/votes?electionId=${managedElectionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Votes
                </a>
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
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
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">Created Elections</h2>
          <p className="mt-2 text-sm text-ink/65">
            Manage each election from its own card. Clicking Manage opens the detailed voter, candidate, and vote panels for that election only.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {payload.elections.length ? (
            payload.elections.map((election) => {
              const isManaged = managedElectionId === election.id;
              const electionStats = isManaged ? stats : null;
              return (
                <div
                  key={election.id}
                  className={`glass-panel rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_54px_rgba(8,31,92,0.16)] ${
                    isManaged ? "ring-2 ring-charcoal/35" : ""
                  }`}
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
                    <button
                      className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-[#28408d]"
                      onClick={() => {
                        setManagedElectionId(election.id);
                        refreshDashboard(election.id);
                      }}
                    >
                      Manage
                    </button>
                  </div>

                  {isManaged && electionStats ? (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: "Voters", value: electionStats.voters, href: `/admin/manage/voters?electionId=${election.id}` },
                        { label: "Verified", value: electionStats.verified, href: `/admin/manage/voters?electionId=${election.id}&mode=verified` },
                        { label: "Voted", value: electionStats.voted, href: `/admin/manage/votes?electionId=${election.id}` },
                        { label: "Pending", value: electionStats.pending, href: `/admin/manage/approvals?electionId=${election.id}` },
                        { label: "Active Sessions", value: electionStats.activeSessions, href: `/admin/manage/sessions?electionId=${election.id}` },
                      ].map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="rounded-2xl border border-charcoal/10 bg-white/75 p-4 transition hover:shadow"
                        >
                          <p className="text-xs uppercase tracking-[0.25em] text-charcoal/75">{item.label}</p>
                          <p className="mt-2 text-2xl font-semibold text-ink">{item.value}</p>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="glass-panel rounded-3xl p-8 text-sm text-ink/65">
              No elections created yet. Use Create Election to add the first one.
            </div>
          )}
        </div>
      </section>

      {managedElectionId ? (
        <>
          <section className="glass-panel rounded-3xl p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Manage Election</h2>
                <p className="mt-2 text-sm text-ink/65">
                  Managing: {activeElection?.title ?? "Selected election"}
                </p>
              </div>
              <button
                className="rounded-full border border-charcoal/30 bg-white px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5"
                onClick={() => setManagedElectionId("")}
              >
                Back to elections
              </button>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-lg font-semibold text-ink">Import Eligible Voters</h2>
              <p className="mt-2 text-sm text-ink/65">
                CSV headers: registration_number, name, email, branch, year_of_study,
                oat_score. Imported voters become eligible only for the selected election.
              </p>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleCsv(file);
                    }
                  }}
                  className="block w-full text-sm text-ink/60 file:mr-4 file:rounded-full file:border-0 file:bg-charcoal file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream"
                />
                <button
                  className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-[#28408d] disabled:opacity-60"
                  onClick={handleImport}
                  disabled={!csvRows.length || busy === "import"}
                >
                  {busy === "import" ? "Importing..." : `Import ${csvRows.length} rows`}
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-lg font-semibold text-ink">Pending Verification Requests</h2>
              <div className="mt-4 space-y-4">
                {payload.pendingRequests.length ? (
                  payload.pendingRequests.map((request) => (
                    <div key={request.id} className="panel-outline rounded-2xl bg-white/70 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-ink">
                            {request.voter?.name ?? "Unknown voter"}
                          </p>
                          <p className="text-xs text-ink/60">
                            Reg: {request.voter?.registration_number ?? "N/A"}
                          </p>
                        </div>
                        <button
                          className="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-cream transition hover:bg-[#28408d] disabled:opacity-60"
                          onClick={() => handleApprove(request.id)}
                          disabled={busy === request.id}
                        >
                          {busy === request.id ? "Approving..." : "Approve"}
                        </button>
                      </div>
                      <button
                        className="mt-3 text-left text-xs font-semibold text-charcoal underline underline-offset-2 disabled:opacity-60"
                        onClick={() => handleViewPhoto(request.photo_path)}
                        disabled={busy === request.photo_path}
                      >
                        {busy === request.photo_path ? "Loading..." : "View photo"}
                      </button>
                      <a
                        className="mt-2 inline-block text-xs font-semibold text-charcoal underline underline-offset-2"
                        href={`/admin/manage/approvals?electionId=${managedElectionId}&requestId=${request.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in approval queue
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">No pending requests.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-lg font-semibold text-ink">Active Sessions</h2>
              <div className="mt-4 space-y-4">
                {payload.activeSessions.length ? (
                  payload.activeSessions.map((session) => (
                    <div key={session.id} className="panel-outline rounded-2xl bg-white/70 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-ink">
                            {session.voter?.name ?? "Unknown voter"}
                          </p>
                          <p className="text-xs text-ink/60">
                            Reg: {session.voter?.registration_number ?? "N/A"}
                          </p>
                          <p className="text-xs text-ink/60">
                            Expires: {new Date(session.expires_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          className="rounded-full border border-charcoal/30 bg-white px-3 py-1 text-xs font-semibold text-charcoal transition hover:bg-charcoal/5 disabled:opacity-60"
                          onClick={() => handleTerminateSession(session.id)}
                          disabled={busy === session.id}
                        >
                          {busy === session.id ? "Ending..." : "Terminate"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">No active sessions.</p>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-lg font-semibold text-ink">Candidates</h2>
              <div className="mt-4 space-y-3">
                {payload.candidates.length ? (
                  payload.candidates.map((candidate) => (
                    <div key={candidate.id} className="panel-outline rounded-2xl bg-white/70 p-4">
                      <p className="font-semibold text-ink">{candidate.name}</p>
                      <p className="text-xs text-ink/60">
                        {candidate.manifesto || "No manifesto"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">No candidates yet.</p>
                )}
              </div>
              <div className="mt-6 space-y-3">
                <input
                  className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
                  placeholder="Candidate name"
                  value={candidateForm.name}
                  onChange={(event) =>
                    setCandidateForm({ ...candidateForm, name: event.target.value })
                  }
                />
                <input
                  className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
                  placeholder="Party symbol URL"
                  value={candidateForm.party_symbol_url}
                  onChange={(event) =>
                    setCandidateForm({
                      ...candidateForm,
                      party_symbol_url: event.target.value,
                    })
                  }
                />
                <input
                  className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
                  placeholder="Photo URL"
                  value={candidateForm.photo_url}
                  onChange={(event) =>
                    setCandidateForm({
                      ...candidateForm,
                      photo_url: event.target.value,
                    })
                  }
                />
                <textarea
                  className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
                  placeholder="Manifesto"
                  rows={3}
                  value={candidateForm.manifesto}
                  onChange={(event) =>
                    setCandidateForm({
                      ...candidateForm,
                      manifesto: event.target.value,
                    })
                  }
                />
                <button
                  className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-[#28408d] disabled:opacity-60"
                  onClick={handleCandidateSubmit}
                  disabled={!candidateForm.name || busy === "candidate"}
                >
                  {busy === "candidate" ? "Saving..." : "Add Candidate"}
                </button>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-ink">Recent Votes (Admin Only)</h2>
            <div className="mt-4 space-y-4">
              {payload.votes.length ? (
                payload.votes.map((vote) => (
                  <div key={vote.id} className="panel-outline rounded-2xl bg-white/70 p-4">
                    <p className="text-sm font-semibold text-ink">
                      {vote.voter?.name ?? "Unknown voter"}{" → "}
                      {vote.candidate?.name ?? "Unknown candidate"}
                    </p>
                    <p className="text-xs text-ink/60">
                      Reg: {vote.voter?.registration_number ?? "N/A"}
                    </p>
                    <p className="mt-2 text-xs text-ink/65">{vote.reason}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/60">No votes yet.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
