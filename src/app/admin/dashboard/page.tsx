import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboardOverview from "@/components/admin-dashboard-overview";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const dedupeElections = <T extends { title: string; created_at: string }>(items: T[]) =>
  items.reduce<T[]>((accumulator, election) => {
    const normalizedTitle = election.title.trim().toLowerCase();
    const existingIndex = accumulator.findIndex(
      (item) => item.title.trim().toLowerCase() === normalizedTitle
    );

    if (existingIndex >= 0) {
      const existing = accumulator[existingIndex];
      if (new Date(election.created_at).getTime() > new Date(existing.created_at).getTime()) {
        accumulator[existingIndex] = election;
      }
      return accumulator;
    }

    accumulator.push(election);
    return accumulator;
  }, []);

export default async function AdminDashboardPage() {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);

  if (!session) {
    redirect("/admin");
  }

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("elections")
    .select("id, title, description, is_active, created_at")
    .order("created_at", { ascending: false });

  const initialPayload = {
    elections: dedupeElections(data ?? []),
  };

  return (
    <div className="page-frame min-h-screen px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">MDC Club</p>
          <h1 className="text-3xl font-semibold text-ink">Admin Dashboard</h1>
        </div>
        <form action="/api/admin/logout" method="post">
          <button className="rounded-full border border-charcoal/25 bg-white/70 px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-white">
            Sign out
          </button>
        </form>
      </header>

      <AdminDashboardOverview initialPayload={initialPayload} />
    </div>
  );
}
