import { Suspense } from "react";
import ManageApprovalsClient from "./approvals-client";

export default function ManageApprovalsPage() {
  return (
    <Suspense fallback={<div className="page-frame px-6 py-8 text-sm text-ink/60">Loading approvals...</div>}>
      <ManageApprovalsClient />
    </Suspense>
  );
}

