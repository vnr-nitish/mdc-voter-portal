"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type VoteRow = {
  id: string;
  voter_id?: string | null;
  candidate_id?: string | null;
  points?: number | null;
  reason?: string | null;
  created_at?: string | null;
  voter?: {
    registration_number?: string | null;
    name?: string | null;
    email?: string | null;
    mobile_number?: string | null;
    school?: string | null;
    stream?: string | null;
    domain?: string | null;
    position?: string | null;
    stay?: string | null;
    year_of_study?: string | null;
    vote_points?: number | null;
  } | null;
  candidate?: {
    name?: string | null;
  } | null;
};

type Props = {
  electionId: string;
};

export default function AdminVotesClient({ electionId }: Props) {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [candidateFilter, setCandidateFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [stayFilter, setStayFilter] = useState("all");

  useEffect(() => {
    if (!electionId) return;
    let mounted = true;

    const load = async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/dashboard?electionId=${encodeURIComponent(electionId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        if (mounted) {
          setVotes((data.votes || []) as VoteRow[]);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [electionId]);

  const filterChoices = useMemo(() => {
    const unique = (values: Array<string | null | undefined>) =>
      Array.from(
        new Set(
          values
            .map((value) => String(value ?? "").trim())
            .filter((value) => value.length > 0)
        )
      ).sort((left, right) => left.localeCompare(right));

    return {
      candidates: unique(votes.map((vote) => vote.candidate?.name)),
      years: unique(votes.map((vote) => vote.voter?.year_of_study)),
      domains: unique(votes.map((vote) => vote.voter?.domain)),
      schools: unique(votes.map((vote) => vote.voter?.school)),
      stays: unique(votes.map((vote) => vote.voter?.stay)),
    };
  }, [votes]);

  const visibleVotes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const matchesQuery = (vote: VoteRow) => {
      if (!query) return true;
      return [
        vote.voter?.name,
        vote.voter?.registration_number,
        vote.voter?.email,
        vote.voter?.mobile_number,
        vote.candidate?.name,
        vote.reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    };

    const filtered = votes.filter((vote) => {
      const voterYear = String(vote.voter?.year_of_study ?? "").trim();
      const voterDomain = String(vote.voter?.domain ?? "").trim();
      const voterSchool = String(vote.voter?.school ?? "").trim();
      const voterStay = String(vote.voter?.stay ?? "").trim();
      const candidateName = String(vote.candidate?.name ?? "").trim();

      return (
        matchesQuery(vote) &&
        (candidateFilter === "all" || candidateName === candidateFilter) &&
        (yearFilter === "all" || voterYear === yearFilter) &&
        (domainFilter === "all" || voterDomain === domainFilter) &&
        (schoolFilter === "all" || voterSchool === schoolFilter) &&
        (stayFilter === "all" || voterStay === stayFilter)
      );
    });

    return filtered.sort(
      (left, right) => new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()
    );
  }, [votes, searchTerm, candidateFilter, yearFilter, domainFilter, schoolFilter, stayFilter]);

  const stats = useMemo(() => {
    const totalPoints = visibleVotes.reduce((sum, vote) => sum + (vote.points ?? vote.voter?.vote_points ?? 0), 0);
    const uniqueVoters = new Set(visibleVotes.map((vote) => vote.voter?.registration_number).filter(Boolean)).size;
    const uniqueCandidates = new Set(visibleVotes.map((vote) => vote.candidate?.name).filter(Boolean)).size;
    return { totalPoints, uniqueVoters, uniqueCandidates };
  }, [visibleVotes]);

  const exportCsv = () => {
    const header = [
      "voter_registration",
      "voter_name",
      "voter_email",
      "voter_mobile",
      "school",
      "stream",
      "domain",
      "position",
      "stay",
      "year_of_study",
      "candidate",
      "points",
      "reason",
      "created_at",
    ];
    const rows = visibleVotes.map((vote) => [
      vote.voter?.registration_number || "",
      vote.voter?.name || "",
      vote.voter?.email || "",
      vote.voter?.mobile_number || "",
      vote.voter?.school || "",
      vote.voter?.stream || "",
      vote.voter?.domain || "",
      vote.voter?.position || "",
      vote.voter?.stay || "",
      vote.voter?.year_of_study || "",
      vote.candidate?.name || "",
      String(vote.points ?? vote.voter?.vote_points ?? ""),
      (vote.reason || "").replace(/\n/g, " "),
      vote.created_at || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `votes_${electionId || "export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const backHref = electionId ? `/admin/dashboard/${electionId}` : "/admin/dashboard";

  return (
    <div className="page-frame px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">Admin</p>
          <h1 className="text-2xl font-semibold text-ink">Votes</h1>
        </div>
        <div className="flex gap-2">
          <Link href={backHref} className="rounded-full border border-charcoal/25 bg-white/80 px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5">Back</Link>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="glass-panel mb-4 rounded-2xl p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Votes</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{votes.length}</p>
          </div>
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Voters</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{stats.uniqueVoters}</p>
          </div>
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Candidates</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{stats.uniqueCandidates}</p>
          </div>
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/55">Total Points</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{stats.totalPoints}</p>
          </div>
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-4 md:col-span-2 xl:col-span-2">
            <button className="rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-cream" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 md:p-6">
        <div className="mb-4 grid gap-3 xl:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
            Search
            <input
              className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
              placeholder="Name, registration, email, candidate, reason"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              Candidate
              <select className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink" value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value)}>
                <option value="all">All candidates</option>
                {filterChoices.candidates.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              Year
              <select className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="all">All years</option>
                {filterChoices.years.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              Domain
              <select className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
                <option value="all">All domains</option>
                {filterChoices.domains.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              School
              <select className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink" value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
                <option value="all">All schools</option>
                {filterChoices.schools.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              Stay
              <select className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink" value={stayFilter} onChange={(event) => setStayFilter(event.target.value)}>
                <option value="all">All stays</option>
                {filterChoices.stays.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                className="rounded-xl border border-charcoal/20 bg-white px-4 py-2 text-sm font-semibold text-charcoal hover:bg-charcoal/5"
                onClick={() => {
                  setSearchTerm("");
                  setCandidateFilter("all");
                  setYearFilter("all");
                  setDomainFilter("all");
                  setSchoolFilter("all");
                  setStayFilter("all");
                }}
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>

        {visibleVotes.length ? (
          <div className="overflow-x-auto rounded-2xl border border-charcoal/10 bg-white/80">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-charcoal/5 text-xs uppercase tracking-[0.16em] text-ink/55">
                <tr>
                  <th className="px-4 py-3">Voter</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Stream</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {visibleVotes.map((vote) => (
                  <tr key={vote.id} className="border-t border-charcoal/10 align-top">
                    <td className="px-4 py-3 font-semibold text-ink">{vote.voter?.name ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.registration_number ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.email ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.mobile_number ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.school ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.stream ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.domain ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.voter?.year_of_study ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.candidate?.name ?? "Unknown"}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{vote.points ?? vote.voter?.vote_points ?? "N/A"}</td>
                    <td className="px-4 py-3 text-ink/70">{vote.reason || "-"}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {vote.created_at ? new Date(vote.created_at).toLocaleString() : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-5 text-sm text-ink/60">
            No votes match the current search or filters.
          </div>
        )}
      </div>
    </div>
  );
}
