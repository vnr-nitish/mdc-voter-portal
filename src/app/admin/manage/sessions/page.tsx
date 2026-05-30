"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ManageSessions() {
  const [electionId, setElectionId] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!electionId) return;
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/dashboard?electionId=${encodeURIComponent(electionId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSessions(data.activeSessions || []);
    } catch (err) {
      setError(err instanceof Error?err.message:String(err));
    } finally {
      setRefreshing(false);
    }
  };

  const backHref = electionId ? `/admin/dashboard/${electionId}` : '/admin/dashboard';

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('electionId') ?? '';
    setElectionId(id);
  }, []);

  useEffect(() => { load(); }, [electionId]);

  const terminate = async (id: string) => {
    setBusy(id); setError(null);
    try {
      const res = await fetch('/api/admin/terminate-session', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId: id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terminate failed');
      await load();
    } catch (err) {
      setError(err instanceof Error?err.message:String(err));
    } finally { setBusy(null); }
  };

  return (
    <div className="page-frame px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">Admin</p>
          <h1 className="text-2xl font-semibold text-ink">Active Sessions</h1>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full border border-charcoal/15 bg-white px-4 py-2 text-sm font-semibold text-charcoal/70">
            {sessions.length} live
          </span>
          <Link href={backHref} className="rounded-full border border-charcoal/25 bg-white/80 px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5">Back</Link>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Session Monitor</h2>
            <p className="text-sm text-ink/60">Track active voter sessions and terminate them when needed.</p>
          </div>
          <button
            className="rounded-full border border-charcoal/25 bg-white px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5 disabled:opacity-60"
            onClick={load}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {sessions.length ? (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-charcoal/10 bg-white/90 p-4 shadow-[0_16px_32px_rgba(8,31,92,0.06)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-ink">{s.voter?.name ?? 'Unknown voter'}</div>
                    <div className="mt-1 text-xs text-ink/60">Reg: {s.voter?.registration_number ?? 'N/A'}</div>
                    <div className="mt-1 text-xs text-ink/60">Expires: {new Date(s.expires_at).toLocaleString()}</div>
                  </div>
                  <button
                    className="rounded-xl border border-charcoal/25 bg-white px-3 py-2 text-sm font-semibold text-charcoal disabled:opacity-60"
                    onClick={() => terminate(s.id)}
                    disabled={busy === s.id}
                  >
                    {busy === s.id ? 'Ending...' : 'Terminate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-charcoal/15 bg-white/80 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/5 text-charcoal font-semibold">
              0
            </div>
            <p className="mt-4 text-base font-semibold text-ink">No active sessions right now.</p>
            <p className="mt-2 text-sm text-ink/60">
              When a verified voter starts a session, it will appear here with an expiry time and a terminate action.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
