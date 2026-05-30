"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Election = { id: string; title: string; description?: string; is_active: boolean };

type VoterRow = {
  id: string;
  registration_number: string;
  name: string;
  email: string;
  mobile_number?: string | null;
  school?: string | null;
  stream?: string | null;
  domain?: string | null;
  position?: string | null;
  stay?: string | null;
  year_of_study?: string | null;
  vote_points?: number | null;
  is_verified: boolean;
  has_voted: boolean;
};

type CsvPreviewRow = {
  rowNumber: number;
  voter: Partial<VoterRow> & { registration_number?: string; name?: string; email?: string };
  errors: string[];
};

type EditState = {
  id: string;
  registration_number: string;
  name: string;
  email: string;
  mobile_number: string;
  school: string;
  stream: string;
  domain: string;
  position: string;
  stay: string;
  year_of_study: string;
  vote_points: string;
};

const normalizeHeader = (header: string) =>
  header.toLowerCase().trim().replace(/[^a-z0-9]+/g, "");

const requiredContractHeaders = [
  "name",
  "emailid",
  "registrationnumber",
  "mobilenumber",
  "school",
  "stream",
  "yearofstudy",
  "domain",
  "postion",
  "stay",
  "points",
];

const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

const toEditState = (voter: VoterRow): EditState => ({
  id: voter.id,
  registration_number: voter.registration_number ?? "",
  name: voter.name ?? "",
  email: voter.email ?? "",
  mobile_number: voter.mobile_number ?? "",
  school: voter.school ?? "",
  stream: voter.stream ?? "",
  domain: voter.domain ?? "",
  position: voter.position ?? "",
  stay: voter.stay ?? "",
  year_of_study: voter.year_of_study ?? "",
  vote_points: voter.vote_points == null ? "" : String(voter.vote_points),
});

const parseCsvRows = (csvText: string) => {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { rows: [] as CsvPreviewRow[], missingHeaders: [] as string[] };
  }

  const delimiter = lines[0].includes("\t") ? /\t+/ : /,/;
  const headers = lines[0].split(delimiter).map((h) => normalizeHeader(h));
  const missingHeaders = requiredContractHeaders.filter((key) => !headers.includes(key));

  const seenRegs = new Set<string>();
  const seenEmails = new Set<string>();

  const rows = lines.slice(1).map((line, index) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));

    const registrationNumber = row.registrationnumber?.trim() ?? "";
    const email = (row.emailid ?? row.email ?? "").trim().toLowerCase();
    const errors: string[] = [];

    if (!registrationNumber) {
      errors.push("Missing registration number");
    }
    if (!row.name?.trim()) {
      errors.push("Missing name");
    }
    if (!email) {
      errors.push("Missing email");
    } else if (!validateEmail(email)) {
      errors.push("Invalid email format");
    }
    if (registrationNumber) {
      if (seenRegs.has(registrationNumber)) {
        errors.push("Duplicate registration number in file");
      }
      seenRegs.add(registrationNumber);
    }
    if (email) {
      if (seenEmails.has(email)) {
        errors.push("Duplicate email in file");
      }
      seenEmails.add(email);
    }

    return {
      rowNumber: index + 2,
      voter: {
        registration_number: registrationNumber,
        name: row.name?.trim(),
        email,
        mobile_number: row.mobilenumber,
        school: row.school,
        stream: row.stream,
        domain: row.domain,
        position: row.postion ?? row.position,
        stay: row.stay,
        year_of_study: row.yearofstudy,
        vote_points: row.points ? Number.parseInt(row.points, 10) : undefined,
      },
      errors,
    };
  });

  return {
    rows,
    missingHeaders,
  };
};

export default function AdminVoterManagement() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>("");
  const [electionProvided, setElectionProvided] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"manage" | "verified">("manage");
  const [tab, setTab] = useState<"import" | "view">("import");
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const [manualForm, setManualForm] = useState({
    registration_number: "",
    name: "",
    email: "",
    mobile_number: "",
    school: "",
    stream: "",
    domain: "",
    position: "",
    stay: "",
    year_of_study: "",
    vote_points: "1",
  });

  const [editVoter, setEditVoter] = useState<EditState | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [stayFilter, setStayFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const fetchElections = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load elections");
      setElections(data.elections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshVoters = async (electionId: string) => {
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/dashboard?electionId=${encodeURIComponent(electionId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load election data");
      setVoters(data.voters || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    fetchElections();
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("electionId") ?? "";
    const mode = new URLSearchParams(window.location.search).get("mode") ?? "manage";
    if (id) {
      setSelectedElection(id);
      setElectionProvided(true);
    }
    setViewMode(mode === "verified" ? "verified" : "manage");
  }, []);

  useEffect(() => {
    setTab(viewMode === "verified" ? "view" : "import");
  }, [viewMode]);

  useEffect(() => {
    if (!selectedElection) return;
    refreshVoters(selectedElection);
  }, [selectedElection]);

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsvRows(text);
    setCsvPreviewRows(parsed.rows);
    setMissingHeaders(parsed.missingHeaders);
  };

  const validRows = useMemo(
    () =>
      csvPreviewRows
        .filter((row) => row.errors.length === 0)
        .map((row) => ({
          registration_number: row.voter.registration_number,
          name: row.voter.name,
          email: row.voter.email,
          mobile_number: row.voter.mobile_number,
          school: row.voter.school,
          stream: row.voter.stream,
          domain: row.voter.domain,
          position: row.voter.position,
          stay: row.voter.stay,
          year_of_study: row.voter.year_of_study,
          vote_points: row.voter.vote_points,
          points: row.voter.vote_points,
        })),
    [csvPreviewRows]
  );

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
      years: unique(voters.map((voter) => voter.year_of_study)),
      domains: unique(voters.map((voter) => voter.domain)),
      stays: unique(voters.map((voter) => voter.stay)),
      schools: unique(voters.map((voter) => voter.school)),
    };
  }, [voters]);

  const visibleVoters = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matchesQuery = (voter: VoterRow) => {
      if (!query) return true;
      return [voter.name, voter.email, voter.registration_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    };

    const filtered = voters.filter((voter) => {
      if (viewMode === "verified" && !voter.is_verified) {
        return false;
      }

      const voterYear = String(voter.year_of_study ?? "").trim();
      const voterDomain = String(voter.domain ?? "").trim();
      const voterStay = String(voter.stay ?? "").trim();
      const voterSchool = String(voter.school ?? "").trim();

      return (
        matchesQuery(voter) &&
        (yearFilter === "all" || voterYear === yearFilter) &&
        (domainFilter === "all" || voterDomain === domainFilter) &&
        (stayFilter === "all" || voterStay === stayFilter) &&
        (schoolFilter === "all" || voterSchool === schoolFilter)
      );
    });

    const sortValue = (voter: VoterRow) => {
      switch (sortBy) {
        case "year-asc":
        case "year-desc":
          return Number.parseFloat(String(voter.year_of_study ?? "")) || 0;
        case "domain-asc":
        case "domain-desc":
          return String(voter.domain ?? "").toLowerCase();
        default:
          return String(voter.name ?? "").toLowerCase();
      }
    };

    return filtered.sort((left, right) => {
      const leftValue = sortValue(left);
      const rightValue = sortValue(right);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sortBy.endsWith("desc") ? rightValue - leftValue : leftValue - rightValue;
      }

      const comparison = String(leftValue).localeCompare(String(rightValue));
      return sortBy.endsWith("desc") ? -comparison : comparison;
    });
  }, [voters, searchTerm, yearFilter, domainFilter, stayFilter, schoolFilter, sortBy, viewMode]);

  const resetViewFilters = () => {
    setSearchTerm("");
    setYearFilter("all");
    setDomainFilter("all");
    setStayFilter("all");
    setSchoolFilter("all");
    setSortBy("name-asc");
  };

  const handleImport = async () => {
    if (!selectedElection) return setError("Select an election to import into.");
    if (missingHeaders.length > 0) {
      return setError(
        `CSV header mismatch. Missing required headers: ${missingHeaders.join(", ")}`
      );
    }
    setBusy("import");
    setError(null);
    try {
      const res = await fetch("/api/admin/import-voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows, electionId: selectedElection }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setCsvPreviewRows([]);
      setMissingHeaders([]);
      await refreshVoters(selectedElection);
      setTab("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleManualAdd = async () => {
    if (!selectedElection) return setError("Select an election first.");
    if (!manualForm.registration_number.trim() || !manualForm.name.trim() || !manualForm.email.trim()) {
      return setError("Registration number, name and email are required.");
    }

    setBusy("manual-add");
    setError(null);
    try {
      const pointsValue = Number.parseInt(manualForm.vote_points || "1", 10) || 1;
      const payload = {
        registration_number: manualForm.registration_number.trim(),
        name: manualForm.name.trim(),
        email: manualForm.email.trim().toLowerCase(),
        mobile_number: manualForm.mobile_number.trim() || null,
        school: manualForm.school.trim() || null,
        stream: manualForm.stream.trim() || null,
        domain: manualForm.domain.trim() || null,
        position: manualForm.position.trim() || null,
        stay: manualForm.stay.trim() || null,
        year_of_study: manualForm.year_of_study.trim() || null,
        vote_points: pointsValue,
        points: pointsValue,
      };

      const res = await fetch("/api/admin/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter: payload, electionId: selectedElection }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add voter");

      setManualForm({
        registration_number: "",
        name: "",
        email: "",
        mobile_number: "",
        school: "",
        stream: "",
        domain: "",
        position: "",
        stay: "",
        year_of_study: "",
        vote_points: "1",
      });
      setShowAddModal(false);
      await refreshVoters(selectedElection);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedElection) {
      return setError("Select an election first.");
    }
    if (!voters.length) {
      return;
    }

    const confirmed = confirm(
      `Delete all ${voters.length} voters in this election? This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy("delete-all");
    setError(null);
    try {
      for (const voter of voters) {
        const res = await fetch(`/api/admin/voters/${voter.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to delete all voters");
        }
      }
      await refreshVoters(selectedElection);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editVoter) return;
    setBusy("edit-save");
    setError(null);
    try {
      const pointsValue = Number.parseInt(editVoter.vote_points || "1", 10) || 1;
      const res = await fetch(`/api/admin/voters/${editVoter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_number: editVoter.registration_number.trim(),
          name: editVoter.name.trim(),
          email: editVoter.email.trim().toLowerCase(),
          mobile_number: editVoter.mobile_number.trim() || null,
          school: editVoter.school.trim() || null,
          stream: editVoter.stream.trim() || null,
          domain: editVoter.domain.trim() || null,
          position: editVoter.position.trim() || null,
          stay: editVoter.stay.trim() || null,
          year_of_study: editVoter.year_of_study.trim() || null,
          vote_points: pointsValue,
          points: pointsValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditVoter(null);
      await refreshVoters(selectedElection);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const backHref = selectedElection ? `/admin/dashboard/${selectedElection}` : "/admin/dashboard";
  const isVerifiedOnly = viewMode === "verified";
  const showImportTab = !isVerifiedOnly;
  const showManagementActions = !isVerifiedOnly;

  return (
    <div className="page-frame px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">Admin</p>
          <h1 className="text-2xl font-semibold text-ink">
            {isVerifiedOnly ? "Verified Voters" : "Voter Management"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={backHref} className="rounded-full border border-charcoal/25 bg-white/80 px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5">Back</Link>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="glass-panel mb-5 rounded-3xl p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            {!electionProvided ? (
              <select
                value={selectedElection}
                onChange={(e) => setSelectedElection(e.target.value)}
                className="min-w-[260px] rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">Select election...</option>
                {elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="min-w-[260px] rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm font-medium text-ink">
                Election: {selectedElection}
              </div>
            )}
            <div className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm font-medium text-ink">
              Voters: {voters.length}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-charcoal/20 bg-white px-3 py-2 text-sm font-semibold text-charcoal hover:bg-charcoal/5"
              onClick={resetViewFilters}
            >
              Reset filters
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {showImportTab ? (
          <button
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "import" ? "bg-charcoal text-cream" : "border border-charcoal/20 bg-white text-charcoal hover:bg-charcoal/5"}`}
            onClick={() => setTab("import")}
          >
            Import
          </button>
        ) : null}
        <button
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "view" ? "bg-charcoal text-cream" : "border border-charcoal/20 bg-white text-charcoal hover:bg-charcoal/5"}`}
          onClick={() => setTab("view")}
        >
          View
        </button>
      </div>

      {showImportTab && tab === "import" ? (
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-ink/65">
            Upload CSV/TSV with headers: Name, Email ID, Registration Number, Mobile Number,
            School, Stream, Year of Study, Domain, Postion, Stay, Points.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-charcoal/25 bg-white px-4 py-2 text-sm font-semibold text-charcoal hover:bg-charcoal/5">
              Choose file
              <input
                type="file"
                accept=".csv,.tsv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedFileName(f.name);
                    handleCsv(f);
                  } else {
                    setSelectedFileName("");
                  }
                }}
              />
            </label>
            <span className="rounded-xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink/70">
              {selectedFileName || "No file selected"}
            </span>
            <button
              className="rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
              onClick={handleImport}
              disabled={!validRows.length || busy === "import" || missingHeaders.length > 0}
            >
              {busy === "import" ? "Importing..." : `Import ${validRows.length} valid rows`}
            </button>
          </div>

          {missingHeaders.length > 0 ? (
            <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Missing required headers: {missingHeaders.join(", ")}
            </div>
          ) : null}

          {csvPreviewRows.length ? (
            <div className="mt-4">
              <p className="text-sm text-ink/70">
                Preview: {validRows.length} valid / {csvPreviewRows.length - validRows.length} invalid
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink/70">
                      <th className="py-2 pr-4">Row</th>
                      <th className="py-2 pr-4">Registration</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.slice(0, 12).map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="py-2 pr-4">{row.rowNumber}</td>
                        <td className="py-2 pr-4">{row.voter.registration_number}</td>
                        <td className="py-2 pr-4">{row.voter.name}</td>
                        <td className="py-2 pr-4">{row.voter.email}</td>
                        <td className={`py-2 pr-4 ${row.errors.length ? "text-red-700" : "text-emerald-700"}`}>
                          {row.errors.length ? row.errors.join("; ") : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : tab === "view" ? (
        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                Search
                <input
                  className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
                  placeholder="Name, email, registration"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                Year of study
                <select
                  className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                >
                  <option value="all">All years</option>
                  {filterChoices.years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                Domain
                <select
                  className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                >
                  <option value="all">All domains</option>
                  {filterChoices.domains.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                School
                <select
                  className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                >
                  <option value="all">All schools</option>
                  {filterChoices.schools.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                Stay
                <select
                  className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
                  value={stayFilter}
                  onChange={(e) => setStayFilter(e.target.value)}
                >
                  <option value="all">All stays</option>
                  {filterChoices.stays.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
                Sort
                <select
                  className="rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm text-ink"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="year-asc">Year ascending</option>
                  <option value="year-desc">Year descending</option>
                  <option value="domain-asc">Domain A-Z</option>
                  <option value="domain-desc">Domain Z-A</option>
                </select>
              </label>
              {showManagementActions ? (
                <>
                  <button
                    className="rounded-xl bg-charcoal px-3 py-2 text-sm font-semibold text-cream"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add voter
                  </button>
                  <button
                    className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                    onClick={handleDeleteAll}
                    disabled={!voters.length || busy === "delete-all"}
                  >
                    {busy === "delete-all" ? "Deleting..." : "Delete all"}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {visibleVoters.length ? (
            visibleVoters.map((voter) => (
              <div key={voter.id} className="panel-outline mb-3 rounded-2xl bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{voter.name}</div>
                    <div className="text-xs text-ink/60">
                      {voter.registration_number} • {voter.email}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-ink/55">
                      <span className="rounded-full border border-charcoal/15 bg-white px-2 py-1">
                        Year: {voter.year_of_study ?? "N/A"}
                      </span>
                      <span className="rounded-full border border-charcoal/15 bg-white px-2 py-1">
                        Domain: {voter.domain ?? "N/A"}
                      </span>
                      <span className="rounded-full border border-charcoal/15 bg-white px-2 py-1">
                        School: {voter.school ?? "N/A"}
                      </span>
                      <span className="rounded-full border border-charcoal/15 bg-white px-2 py-1">
                        Stay: {voter.stay ?? "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {showManagementActions ? (
                      <>
                        <button
                          className="rounded-xl border border-charcoal/20 bg-white px-3 py-1.5 text-sm font-semibold text-charcoal"
                          onClick={() => setEditVoter(toEditState(voter))}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-charcoal/20 bg-white px-3 py-1.5 text-sm font-semibold text-charcoal"
                          onClick={async () => {
                            if (!confirm("Delete voter? This cannot be undone.")) return;
                            const res = await fetch(`/api/admin/voters/${voter.id}`, { method: "DELETE" });
                            const data = await res.json();
                            if (!res.ok) return alert(data.error || "Delete failed");
                            await refreshVoters(selectedElection);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-5 text-sm text-ink/60">
              No voters match the current search or filters.
            </div>
          )}
        </div>
      ) : null}

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Voter</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded border px-3 py-2" placeholder="Registration Number" value={manualForm.registration_number} onChange={(e) => setManualForm({ ...manualForm, registration_number: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Name" value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Email" value={manualForm.email} onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Mobile Number" value={manualForm.mobile_number} onChange={(e) => setManualForm({ ...manualForm, mobile_number: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="School" value={manualForm.school} onChange={(e) => setManualForm({ ...manualForm, school: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Stream" value={manualForm.stream} onChange={(e) => setManualForm({ ...manualForm, stream: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Domain" value={manualForm.domain} onChange={(e) => setManualForm({ ...manualForm, domain: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Postion / Position" value={manualForm.position} onChange={(e) => setManualForm({ ...manualForm, position: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Stay" value={manualForm.stay} onChange={(e) => setManualForm({ ...manualForm, stay: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Year of Study" value={manualForm.year_of_study} onChange={(e) => setManualForm({ ...manualForm, year_of_study: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Points" value={manualForm.vote_points} onChange={(e) => setManualForm({ ...manualForm, vote_points: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-4 py-2" onClick={() => setShowAddModal(false)}>Close</button>
              <button className="rounded bg-charcoal px-4 py-2 text-cream disabled:opacity-60" onClick={handleManualAdd} disabled={busy === "manual-add"}>
                {busy === "manual-add" ? "Saving..." : "Add Voter"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editVoter ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Voter</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded border px-3 py-2" placeholder="Registration Number" value={editVoter.registration_number} onChange={(e) => setEditVoter({ ...editVoter, registration_number: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Name" value={editVoter.name} onChange={(e) => setEditVoter({ ...editVoter, name: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Email" value={editVoter.email} onChange={(e) => setEditVoter({ ...editVoter, email: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Mobile Number" value={editVoter.mobile_number} onChange={(e) => setEditVoter({ ...editVoter, mobile_number: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="School" value={editVoter.school} onChange={(e) => setEditVoter({ ...editVoter, school: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Stream" value={editVoter.stream} onChange={(e) => setEditVoter({ ...editVoter, stream: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Domain" value={editVoter.domain} onChange={(e) => setEditVoter({ ...editVoter, domain: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Postion / Position" value={editVoter.position} onChange={(e) => setEditVoter({ ...editVoter, position: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Stay" value={editVoter.stay} onChange={(e) => setEditVoter({ ...editVoter, stay: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Year of Study" value={editVoter.year_of_study} onChange={(e) => setEditVoter({ ...editVoter, year_of_study: e.target.value })} />
              <input className="rounded border px-3 py-2" placeholder="Points" value={editVoter.vote_points} onChange={(e) => setEditVoter({ ...editVoter, vote_points: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-4 py-2" onClick={() => setEditVoter(null)}>Close</button>
              <button className="rounded bg-charcoal px-4 py-2 text-cream disabled:opacity-60" onClick={handleSaveEdit} disabled={busy === "edit-save"}>
                {busy === "edit-save" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
