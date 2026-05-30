"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

type Candidate = {
  id: string;
  election_id?: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  manifesto?: string | null;
  photo_url?: string | null;
};

type CandidateOverride = Pick<Candidate, "id" | "email" | "phone_number" | "manifesto" | "photo_url">;

type CandidateForm = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  photo_url: string;
  manifesto: string;
};

const emptyForm: CandidateForm = {
  name: "",
  email: "",
  phone: "",
  photo_url: "",
  manifesto: "",
};

const candidateOverrideKey = "mdc_candidate_overrides";

const readCandidateOverrides = (): Record<string, CandidateOverride> => {
  try {
    return JSON.parse(window.localStorage.getItem(candidateOverrideKey) || "{}") as Record<string, CandidateOverride>;
  } catch {
    return {};
  }
};

const writeCandidateOverrides = (overrides: Record<string, CandidateOverride>) => {
  try {
    window.localStorage.setItem(candidateOverrideKey, JSON.stringify(overrides));
  } catch {
    // ignore storage failures
  }
};

export default function ManageCandidates() {
  const [electionId, setElectionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [photoSrcByCandidate, setPhotoSrcByCandidate] = useState<Record<string, string>>({});
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
  const isValidPhone = (value: string) => /[0-9]{6,}/.test(value.replace(/\s+/g, ""));

  const resolvePhotoUrl = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    if (!trimmed.startsWith("http")) {
      try {
        const response = await fetch("/api/admin/photo-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: trimmed }),
        });
        const data = await response.json();
        if (response.ok && data.signedUrl) {
          return data.signedUrl as string;
        }
      } catch {
        return trimmed;
      }
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      const marker = "/storage/v1/object/public/voter-photos/";
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        const relativePath = parsed.pathname.slice(markerIndex + marker.length);
        const response = await fetch("/api/admin/photo-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: relativePath }),
        });
        const data = await response.json();
        if (response.ok && data.signedUrl) {
          return data.signedUrl as string;
        }
      }
    } catch {
      return trimmed;
    }

    return trimmed;
  };

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("electionId") ?? "";
    setElectionId(id);
  }, []);

  const load = async () => {
    if (!electionId) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?electionId=${encodeURIComponent(electionId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const overrides = readCandidateOverrides();
      setCandidates(
        (data.candidates || []).map((candidate: Candidate) => {
          const override = overrides[candidate.id];
          return override ? { ...candidate, ...override } : candidate;
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("schema cache") || message.toLowerCase().includes("does not exist")) {
        return;
      }
      setError(message);
    }
  };

  useEffect(() => {
    load();
  }, [electionId]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const pairs = await Promise.all(
        candidates.map(async (candidate) => [candidate.id, await resolvePhotoUrl(candidate.photo_url ?? "")] as const)
      );

      if (!cancelled) {
        setPhotoSrcByCandidate(Object.fromEntries(pairs.filter(([, value]) => Boolean(value))));
      }
    };

    if (candidates.length) {
      resolve();
    } else {
      setPhotoSrcByCandidate({});
    }

    return () => {
      cancelled = true;
    };
  }, [candidates]);

  useEffect(() => {
    if (showModal) {
      // focus the name input when modal opens
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [showModal]);

  const openAddModal = () => {
    setModalMode("add");
    setForm(emptyForm);
    setSelectedPhotoName("");
    setShowModal(true);
    setFormErrors({});
    setShowSuccess(false);
  };

  const openEditModal = (candidate: Candidate) => {
    setModalMode("edit");
    setForm({
      id: candidate.id,
      name: candidate.name ?? "",
      email: candidate.email ?? "",
      phone: candidate.phone_number ?? "",
      photo_url: candidate.photo_url ?? "",
      manifesto: candidate.manifesto ?? "",
    });
    setSelectedPhotoName("");
    setShowModal(true);
    setFormErrors({});
    setShowSuccess(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
    setSelectedPhotoName("");
    setShowSuccess(false);
  };

  const handleSubmit = async () => {
    // Client-side validation
    const errors: Record<string, string> = {};
    if (!electionId) errors.election = "Missing election";
    if (!form.name || !form.name.trim()) errors.name = "Candidate name is required.";
    if (!form.email || !form.email.trim()) errors.email = "Candidate email is required.";
    if (form.email && !isValidEmail(form.email)) errors.email = "Enter a valid email address.";
    if (!form.phone || !form.phone.trim()) errors.phone = "Candidate phone number is required.";
    if (form.phone && !isValidPhone(form.phone)) errors.phone = "Enter a valid phone number.";
    if (!form.photo_url || !form.photo_url.trim()) errors.photo_url = "Candidate photo is required.";
    if (!form.manifesto || !form.manifesto.trim()) errors.manifesto = "Candidate manifesto is required.";

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setError(Object.values(errors)[0]);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const isEdit = modalMode === "edit" && !!form.id;
      const endpoint = isEdit ? `/api/admin/candidates/${form.id}` : "/api/admin/create-candidate";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          photo_url: form.photo_url.trim(),
          manifesto: form.manifesto.trim(),
          electionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const candidateFromServer = data.candidate as Candidate | undefined;
      const candidateToStore = candidateFromServer
        ? {
            ...candidateFromServer,
            email: candidateFromServer.email ?? form.email.trim().toLowerCase(),
            phone_number: candidateFromServer.phone_number ?? form.phone.trim(),
            manifesto: candidateFromServer.manifesto ?? form.manifesto.trim(),
            photo_url: candidateFromServer.photo_url ?? form.photo_url.trim(),
          }
        : {
            id: form.id || crypto.randomUUID(),
            election_id: electionId,
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone_number: form.phone.trim(),
            manifesto: form.manifesto.trim(),
            photo_url: form.photo_url.trim(),
          };

      const overrides = readCandidateOverrides();
      overrides[candidateToStore.id] = {
        id: candidateToStore.id,
        email: candidateToStore.email ?? null,
        phone_number: candidateToStore.phone_number ?? null,
        manifesto: candidateToStore.manifesto ?? null,
        photo_url: candidateToStore.photo_url ?? null,
      };
      writeCandidateOverrides(overrides);

      setCandidates((current) => {
        const existingIndex = current.findIndex((candidate) => candidate.id === candidateToStore.id);
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = { ...next[existingIndex], ...candidateToStore };
          return next;
        }
        return [...current, candidateToStore];
      });
      // show success toast, refresh list, then close modal
      setShowSuccess(true);
      await load();
      setTimeout(() => {
        setShowSuccess(false);
        closeModal();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-candidate-photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      setForm((current) => ({ ...current, photo_url: data.path || data.photoUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const backHref = electionId ? `/admin/dashboard/${electionId}` : "/admin/dashboard";

  return (
    <div className="page-frame px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">Admin</p>
          <h1 className="text-2xl font-semibold text-ink">Candidate Management</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream"
            onClick={openAddModal}
          >
            Add candidate
          </button>
          <Link
            href={backHref}
            className="rounded-full border border-charcoal/25 bg-white/80 px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-charcoal/5"
          >
            Back
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="mb-3 font-semibold">Candidates</h3>
        {candidates.length ? (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="panel-outline rounded-2xl bg-white/85 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="shrink-0">
                    {(photoSrcByCandidate[candidate.id] || candidate.photo_url) ? (
                      <img
                        src={photoSrcByCandidate[candidate.id] || candidate.photo_url || ""}
                        alt={candidate.name}
                        className="h-20 w-20 rounded-xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border bg-white text-xs text-ink/50">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 break-words text-lg font-semibold text-ink">{candidate.name}</div>
                      <div className="flex gap-2 sm:ml-auto">
                        <button
                          className="rounded-xl border border-charcoal/25 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal"
                          onClick={() => openEditModal(candidate)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                          onClick={async () => {
                            if (!confirm('Delete this candidate? This cannot be undone.')) return;
                            setError(null);
                            setBusy(true);
                            try {
                              const res = await fetch(`/api/admin/candidates/${candidate.id}`, { method: 'DELETE' });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Delete failed');
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            } finally { setBusy(false); }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 grid gap-1 text-xs text-ink/65 sm:grid-cols-2">
                      <div>Email: {candidate.email ?? "N/A"}</div>
                      <div>Phone: {candidate.phone_number ?? "N/A"}</div>
                    </div>
                    <div className="mt-1 max-h-16 overflow-hidden break-words whitespace-pre-wrap text-xs leading-5 text-ink/60">
                      {candidate.manifesto ?? "No manifesto"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-5 text-sm text-ink/60">
            No candidates yet.
          </div>
        )}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[1.4rem] bg-white p-5 shadow-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">
                {modalMode === "edit" ? "Edit candidate" : "Add candidate"}
              </h3>
              <button className="rounded-xl border border-charcoal/25 bg-white px-3 py-1.5 text-sm font-semibold text-charcoal" onClick={closeModal}>
                Close
              </button>
            </div>

            {showSuccess ? (
              <div className="mb-3 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {modalMode === "edit" ? "Saved changes" : "Candidate added"}
              </div>
            ) : null}

            <div className="grid gap-4">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium text-ink">
                    <span>Name</span>
                    <input
                      ref={nameInputRef}
                      className="w-full rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm"
                      placeholder="Candidate name"
                      value={form.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((current) => ({ ...current, name: v }));
                        setFormErrors((s) => {
                          const copy = { ...s };
                          delete copy.name;
                          return copy;
                        });
                      }}
                    />
                    {formErrors.name ? <div className="text-xs text-red-600">{formErrors.name}</div> : null}
                  </label>

                  <label className="space-y-1 text-sm font-medium text-ink">
                    <span>Email</span>
                    <input
                      className="w-full rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm"
                      placeholder="Candidate email"
                      value={form.email}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((current) => ({ ...current, email: v }));
                        setFormErrors((s) => {
                          const copy = { ...s };
                          delete copy.email;
                          return copy;
                        });
                      }}
                    />
                    {formErrors.email ? <div className="text-xs text-red-600">{formErrors.email}</div> : null}
                  </label>

                  <label className="space-y-1 text-sm font-medium text-ink">
                    <span>Phone number</span>
                    <input
                      className="w-full rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm"
                      placeholder="Candidate phone number"
                      value={form.phone}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((current) => ({ ...current, phone: v }));
                        setFormErrors((s) => {
                          const copy = { ...s };
                          delete copy.phone;
                          return copy;
                        });
                      }}
                    />
                    {formErrors.phone ? <div className="text-xs text-red-600">{formErrors.phone}</div> : null}
                  </label>

                  <label className="space-y-1 text-sm font-medium text-ink md:col-span-2">
                    <span>Manifesto</span>
                    <textarea
                      className="min-h-[132px] w-full rounded-2xl border border-charcoal/20 bg-white px-3 py-2 text-sm"
                      placeholder="Candidate manifesto"
                      value={form.manifesto}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((current) => ({ ...current, manifesto: v }));
                        setFormErrors((s) => {
                          const copy = { ...s };
                          delete copy.manifesto;
                          return copy;
                        });
                      }}
                    />
                    {formErrors.manifesto ? <div className="text-xs text-red-600">{formErrors.manifesto}</div> : null}
                  </label>
                </div>

                <div className="rounded-2xl border border-charcoal/15 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">Candidate Photo</p>
                  <p className="text-xs text-ink/60">
                    Upload image to Supabase Storage. The URL is saved in the candidate record.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-charcoal/25 bg-white px-3 py-2 text-sm font-semibold text-charcoal hover:bg-charcoal/5">
                      Choose image
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedPhotoName(file.name);
                            handlePhotoUpload(file);
                          } else {
                            setSelectedPhotoName("");
                          }
                        }}
                        disabled={uploading}
                      />
                    </label>
                    <span className="rounded-xl border border-charcoal/20 bg-white px-3 py-2 text-xs text-ink/70">
                      {selectedPhotoName || "No image selected"}
                    </span>
                  </div>
                  {formErrors.photo_url ? <div className="mt-2 text-xs text-red-600">{formErrors.photo_url}</div> : null}
                  {uploading ? <p className="mt-2 text-xs text-ink/60">Uploading...</p> : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
                onClick={handleSubmit}
                disabled={busy || uploading || !form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.photo_url.trim() || !form.manifesto.trim() || Object.keys(formErrors).length > 0}
              >
                {busy ? "Saving..." : modalMode === "edit" ? "Save changes" : "Add candidate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
