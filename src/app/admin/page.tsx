"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };
      if (!response.ok) {
        const fallback = typeof data.error === "string" && data.error.trim() ? data.error : "Login failed.";
        throw new Error(fallback);
      }
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-frame flex min-h-screen flex-col px-6 py-10 md:px-10">
      <header className="mb-10 flex items-center justify-between">
        <a href="/" className="text-sm font-medium text-charcoal/80 transition hover:text-charcoal">
          {"<-"} Back to portal
        </a>
        <span className="rounded-full border border-charcoal/20 bg-white/70 px-3 py-1 text-xs font-semibold text-charcoal">
          Admin Only
        </span>
      </header>

      <main className="mx-auto w-full max-w-md">
        <div className="glass-panel rounded-3xl p-8 shadow-[0_28px_64px_rgba(8,31,92,0.14)]">
          <h1 className="text-3xl font-semibold text-ink">Admin Login</h1>
          <p className="mt-2 text-sm text-ink/65">
            Use the fixed admin credentials to access approvals and monitoring.
          </p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
              placeholder="Admin username"
              value={form.username}
              onChange={(event) =>
                setForm({ ...form, username: event.target.value })
              }
              required
            />
            <input
              className="w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/45 focus:border-charcoal/50 focus:outline-none"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
            />
            <button
              className="w-full rounded-full bg-charcoal px-4 py-3 text-sm font-semibold text-cream transition hover:bg-[#28408d] disabled:opacity-60"
              type="submit"
              disabled={busy}
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
