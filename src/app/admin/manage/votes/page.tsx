import AdminVotesClient from "@/components/admin-votes-client";

type PageProps = {
  searchParams?: Promise<{ electionId?: string }>;
};

export default async function ManageVotes({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  return <AdminVotesClient electionId={params.electionId ?? ""} />;
}
