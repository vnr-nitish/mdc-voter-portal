"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type PendingRequestRow = {
  id: string;
  voter_id: string;
  photo_path: string;
  status: string;
  created_at: string;
  voter: { name: string; registration_number: string } | null;
};

type HistoryRow = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  election_id: string | null;
  actor: string | null;
  metadata: {
    admin_username?: string | null;
    admin_comment?: string | null;
    source?: string | null;
    voter_id?: string | null;
    voter_name?: string | null;
    registration_number?: string | null;
  } | null;
  photo_path?: string | null;
  created_at: string;
};

export default function ManageApprovalsClient() {
  const searchParams = useSearchParams();
  const electionId = searchParams?.get("electionId") ?? "";
  const requestIdInUrl = searchParams?.get("requestId") ?? null;
  const [pending, setPending] = useState<PendingRequestRow[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [openMeta, setOpenMeta] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUrlByRequest, setPhotoUrlByRequest] = useState<Record<string, string>>({});
  const [historyPhotoUrlByRequest, setHistoryPhotoUrlByRequest] = useState<Record<string, string>>({});
  const [adminComment, setAdminComment] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!electionId) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?electionId=${encodeURIComponent(electionId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const nextPending = data.pendingRequests || [];
      setPending(nextPending);

      const photoPairs = await Promise.all(
        (nextPending as PendingRequestRow[]).map(async (request: PendingRequestRow) => {
          try {
            const response = await fetch("/api/admin/photo-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: request.photo_path }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Failed");
            return [request.id, payload.signedUrl] as const;
          } catch {
            return [request.id, ""] as const;
          }
        })
      );
      setPhotoUrlByRequest(Object.fromEntries(photoPairs));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [electionId]);

  const loadHistory = useCallback(async () => {
    if (!electionId) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/audit-logs?electionId=${encodeURIComponent(electionId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      setHistory(data.auditLogs || []);
      setHistoryUnavailable(Boolean(data.unavailable));

      const signedPairs = await Promise.all(
        (data.auditLogs || [])
          .filter((record: HistoryRow) => Boolean(record.photo_path))
          .map(async (record: HistoryRow) => {
            try {
              const response = await fetch("/api/admin/photo-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: record.photo_path }),
              });
              const payload = await response.json();
              if (!response.ok) throw new Error(payload.error || "Failed");
              return [record.id, payload.signedUrl] as const;
            } catch {
              return [record.id, ""] as const;
            }
          })
      );
      setHistoryPhotoUrlByRequest(Object.fromEntries(signedPairs));
    } catch {
      setHistory([]);
      setHistoryUnavailable(true);
    }
  }, [electionId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load, electionId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === "history") void loadHistory(); }, [tab, loadHistory]);

  useEffect(() => {
    if (!requestIdInUrl) return;
    if (!pending || !pending.length) return;
    const el = document.getElementById(`pending-${requestIdInUrl}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pending, requestIdInUrl]);

  const handleDecision = async (requestId: string, action: "approved" | "rejected") => {
    if (!electionId) return setError("Select election");
    setBusy(requestId);
    setError(null);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          electionId,
          action,
          adminComment: adminComment[requestId] ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request update failed");
      // Refresh pending list only so the UI remains on the Pending tab.
      // Do not auto-switch to History — keep the moderator workflow on Pending.
      await load();
      // optimistically remove the processed request from the list if still present
      setPending((prev) => prev.filter((p) => p.id !== requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const backHref = electionId ? `/admin/dashboard/${electionId}` : "/admin/dashboard";

  return (
    <div className="page-frame px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">Admin</p>
          <h1 className="text-2xl font-semibold text-ink">{tab === "pending" ? "Pending verification requests" : "Approval history"}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={backHref} className="rounded-full border border-charcoal/25 bg-white/80 px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5">Back</Link>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="glass-panel rounded-2xl p-4 md:p-6">
        <div className="mb-4 flex gap-2">
          <button
            className={`rounded-full px-3 py-1 text-sm ${tab === "pending" ? "bg-charcoal text-cream" : "bg-white/80 text-charcoal border border-charcoal/10"}`}
            onClick={() => setTab("pending")}
          >
            Pending
          </button>
          <button
            className={`rounded-full px-3 py-1 text-sm ${tab === "history" ? "bg-charcoal text-cream" : "bg-white/80 text-charcoal border border-charcoal/10"}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>

        {tab === "pending" ? (
          pending.length ? (
            <div className="space-y-4">
              {pending.map((p: PendingRequestRow) => (
                <div id={`pending-${p.id}`} key={p.id} className="rounded-3xl border border-charcoal/10 bg-white/85 p-4 shadow-[0_18px_30px_rgba(8,31,92,0.08)]">
                  <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
                    <div className="rounded-2xl border border-charcoal/15 bg-[#0f172a] p-3">
                      <div className="overflow-hidden rounded-xl bg-black">
                        {photoUrlByRequest[p.id] ? (
                          <Image
                            src={photoUrlByRequest[p.id]}
                            alt="Verification"
                            width={260}
                            height={240}
                            unoptimized
                            className="h-[240px] w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-[240px] items-center justify-center px-4 text-sm text-white/70">
                            Loading photo preview...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-ink">{p.voter?.name ?? "Unknown"}</div>
                          <div className="text-xs text-ink/60">Reg: {p.voter?.registration_number}</div>
                          <div className="text-xs text-ink/60">Request ID: {p.id}</div>
                        </div>
                        <div className="mt-2 rounded-full bg-charcoal/5 px-3 py-1 text-xs font-semibold text-charcoal md:mt-0">
                          Pending review
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <textarea
                          className="w-full rounded-2xl border border-charcoal/15 bg-white px-3 py-3 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/40 focus:outline-none"
                          placeholder="Optional admin comment"
                          rows={3}
                          value={adminComment[p.id] ?? ""}
                          onChange={(event) => setAdminComment((prev) => ({ ...prev, [p.id]: event.target.value }))}
                        />

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <button
                            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            onClick={() => handleDecision(p.id, "approved")}
                            disabled={busy === p.id || !photoUrlByRequest[p.id]}
                          >
                            {busy === p.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            onClick={() => handleDecision(p.id, "rejected")}
                            disabled={busy === p.id}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-5 text-sm text-ink/60">No pending approvals</div>
          )
        ) : (
          <div>
            {history.length ? (
              <div className="space-y-4">
                {history.map((h: HistoryRow) => (
                  <div key={h.id} className="rounded-3xl border border-charcoal/10 bg-white/85 p-4 shadow-[0_18px_30px_rgba(8,31,92,0.08)]">
                    <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
                      <div className="rounded-2xl border border-charcoal/15 bg-[#0f172a] p-3">
                        <div className="overflow-hidden rounded-xl bg-black">
                          {historyPhotoUrlByRequest[h.id] ? (
                            <Image
                              src={historyPhotoUrlByRequest[h.id]}
                              alt="Verification"
                              width={260}
                              height={240}
                              unoptimized
                              className="h-[240px] w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-[240px] items-center justify-center px-4 text-sm text-white/70">
                              No photo preview available
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-ink">{h.action}</div>
                            <div className="text-xs text-ink/60">{h.entity} — ID: {h.entity_id}</div>
                            <div className="text-xs text-ink/60">Actor: {h.metadata?.admin_username ?? h.actor ?? "unknown"}</div>
                          </div>
                          <div className="mt-2 rounded-full bg-charcoal/5 px-3 py-1 text-xs font-semibold text-charcoal md:mt-0">
                            {new Date(h.created_at).toLocaleString()}
                          </div>
                        </div>

                        {h.metadata?.admin_comment ? (
                          <div className="mt-4 rounded-2xl border border-charcoal/10 bg-white/80 p-3 text-sm text-ink/70">
                            Admin comment: {h.metadata.admin_comment}
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            className="rounded-full border border-charcoal/20 bg-white px-3 py-1 text-xs text-charcoal underline"
                            onClick={() => setOpenMeta((s) => ({ ...s, [h.id]: !s[h.id] }))}
                          >
                            {openMeta[h.id] ? "Hide details" : "Show details"}
                          </button>
                        </div>
                        {openMeta[h.id] ? (
                          <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs text-ink/70">
                            {JSON.stringify(h.metadata ?? {}, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-5 text-sm text-ink/60">
                {historyUnavailable ? "History is unavailable in this environment." : "No history available"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
