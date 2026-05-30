import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminElectionDashboard from "@/components/admin-election-dashboard";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";

type PageProps = {
  params: Promise<{ electionId: string }>;
};

export default async function AdminElectionDashboardPage({ params }: PageProps) {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);

  if (!session) {
    redirect("/admin");
  }

  const { electionId } = await params;

  return (
    <div className="page-frame min-h-screen px-6 py-10 md:px-10">
      <AdminElectionDashboard electionId={electionId} />
    </div>
  );
}