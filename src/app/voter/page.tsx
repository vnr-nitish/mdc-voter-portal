"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

type VoterProfile = {
  id: string;
  auth_user_id?: string | null;
  registration_number: string;
  name: string;
  email: string;
  mobile_number: string | null;
  school: string | null;
  stream: string | null;
  year_of_study: string | null;
  domain: string | null;
  position: string | null;
  stay: string | null;
  points?: number | null;
  vote_points?: number | null;
};

type Election = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
};

type ElectionVoterRow = {
  election_id: string;
  is_verified: boolean;
  has_voted: boolean;
  verification_status: "none" | "pending" | "approved" | "rejected";
  election: Election | null;
};

type RawElectionVoterRow = {
  election_id: string;
  is_verified: boolean;
  has_voted: boolean;
  election: Election[] | Election | null;
};

type ResolveVoterResponse = {
  status: "active" | "inactive";
  voter: VoterProfile;
  membershipRows: Array<ElectionVoterRow>;
  activeMembershipRows: Array<ElectionVoterRow>;
  inactiveMembershipRows: Array<ElectionVoterRow>;
  approvedActiveMembershipRows: Array<ElectionVoterRow>;
  pendingActiveMembershipRows: Array<ElectionVoterRow>;
  rejectionCommentByElection?: Record<string, string | null>;
};

type Candidate = {
  id: string;
  election_id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  photo_url: string | null;
  manifesto: string | null;
};

type CandidateOverride = Pick<Candidate, "id" | "email" | "phone_number" | "manifesto" | "photo_url">;

type SessionRow = {
  id: string;
  election_id: string;
  expires_at: string;
  is_active: boolean;
  started_at?: string | null;
};

type ProfileForm = {
  registration_number: string;
  name: string;
  email: string;
  mobile_number: string;
  school: string;
  stream: string;
  year_of_study: string;
  domain: string;
  position: string;
  stay: string;
};

const SESSION_DURATION_MS = 5 * 60 * 1000;

const looksLikeLink = (value: string | null) => {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value) || /\.pdf(\?|#|$)/i.test(value);
};

const readCandidateOverrides = (): Record<string, CandidateOverride> => {
  try {
    return JSON.parse(window.localStorage.getItem("mdc_candidate_overrides") || "{}");
  } catch {
    return {};
  }
};
const normalizeCandidate = (candidate: any): Candidate => ({
  ...candidate,
  email: candidate.email ?? candidate.email_address ?? candidate.contact_email ?? null,
  phone_number: candidate.phone_number ?? candidate.phone ?? candidate.mobile_number ?? candidate.contact_phone ?? null,
  manifesto: candidate.manifesto ?? null,
  photo_url: candidate.photo_url ?? null,
});

const mergeCandidateOverrides = (candidate: Candidate, override?: CandidateOverride) => {
  if (!override) {
    return candidate;
  }

  return {
    ...candidate,
    email: override.email ?? candidate.email,
    phone_number: override.phone_number ?? candidate.phone_number,
    manifesto: override.manifesto ?? candidate.manifesto,
    photo_url: override.photo_url ?? candidate.photo_url,
  };
};

export default function VoterPortal() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<VoterProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);
  const [electionRows, setElectionRows] = useState<ElectionVoterRow[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionRow, setSessionRow] = useState<SessionRow | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [reportMessage, setReportMessage] = useState("");
  const [voteReason, setVoteReason] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<"loading" | "active" | "inactive" | "unregistered">(
    "loading"
  );
  const [currentStep, setCurrentStep] = useState<"details" | "portal">("details");
  const [verificationStatus, setVerificationStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [rejectionComment, setRejectionComment] = useState<string | null>(null);
  const [portalView, setPortalView] = useState<"elections" | "photo" | "waiting" | "ballot">("elections");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedElection = useMemo(
    () => electionRows.find((row) => row.election_id === selectedElectionId) ?? null,
    [electionRows, selectedElectionId]
  );

  const syncProfileForm = (voter: VoterProfile) => {
    setProfileForm({
      registration_number: voter.registration_number ?? "",
      name: voter.name ?? "",
      email: voter.email ?? "",
      mobile_number: voter.mobile_number ?? "",
      school: voter.school ?? "",
      stream: voter.stream ?? "",
      year_of_study: voter.year_of_study ?? "",
      domain: voter.domain ?? "",
      position: voter.position ?? "",
      stay: voter.stay ?? "",
    });
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const resetPhotoCapture = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
  };

  const applySession = (session: SessionRow) => {
    localStorage.setItem("mdc_session_id", session.id);
    setSessionRow(session);
    const expiresAt = new Date(session.expires_at).getTime();
    setTimeLeft(Math.max(0, expiresAt - Date.now()));
  };

  useEffect(() => {
    const init = async () => {
      const session = await supabaseClient.auth.getSession();
      const email = session.data.session?.user.email?.trim().toLowerCase() ?? null;
      setUserEmail(email);
      setLoading(false);
    };

    init();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setUserEmail(session?.user.email?.trim().toLowerCase() ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setProfile(null);
      setProfileForm(null);
      setElectionRows([]);
      setSelectedElectionId("");
      setSessionRow(null);
      setAccessStatus("loading");
      setCurrentStep("details");
      setVerificationStatus("none");
      setPortalView("elections");
      setPhotoPreview(null);
      setPhotoBlob(null);
      stopCamera();
      return;
    }

    const loadProfile = async () => {
      setError(null);
      setLoading(true);

      const authUser = (await supabaseClient.auth.getUser()).data.user;
      const response = await fetch("/api/voter/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, authUserId: authUser?.id }),
      });

      if (response.status === 404) {
        setError("Your email is not registered in the voter list. Contact the admin.");
        setProfile(null);
        setProfileForm(null);
        await supabaseClient.auth.signOut();
        setAccessStatus("unregistered");
        setCurrentStep("details");
        setVerificationStatus("none");
        setPortalView("elections");
        setPhotoPreview(null);
        setPhotoBlob(null);
        stopCamera();
        setLoading(false);
        return;
      }

      const data = (await response.json()) as ResolveVoterResponse;
      const errorData = data as unknown as { error?: string };

      if (!response.ok) {
        setError(errorData.error || "Unable to load voter profile.");
        setProfile(null);
        setProfileForm(null);
        setLoading(false);
        return;
      }

      const voter = data.voter;

      setProfile(voter as VoterProfile);
      syncProfileForm(voter as VoterProfile);

      const membershipRows = data.membershipRows.map((row) => ({
        election_id: row.election_id,
        is_verified: row.is_verified,
        has_voted: row.has_voted,
        verification_status: row.verification_status,
        election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
      }));

      const activeMembershipRows = data.activeMembershipRows.map((row) => ({
        election_id: row.election_id,
        is_verified: row.is_verified,
        has_voted: row.has_voted,
        verification_status: row.verification_status,
        election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
      }));

      const inactiveMembershipRows = data.inactiveMembershipRows.map((row) => ({
        election_id: row.election_id,
        is_verified: row.is_verified,
        has_voted: row.has_voted,
        verification_status: row.verification_status,
        election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
      }));

      const approvedActiveMembershipRows = data.approvedActiveMembershipRows.map((row) => ({
        election_id: row.election_id,
        is_verified: row.is_verified,
        has_voted: row.has_voted,
        verification_status: row.verification_status,
        election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
      }));

      const pendingActiveMembershipRows = data.pendingActiveMembershipRows.map((row) => ({
        election_id: row.election_id,
        is_verified: row.is_verified,
        has_voted: row.has_voted,
        verification_status: row.verification_status,
        election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
      }));

      if (data.status === "inactive") {
        setAccessStatus("inactive");
        setCurrentStep("details");
        setElectionRows(inactiveMembershipRows);
        setSelectedElectionId("");
        setSessionRow(null);
        setPortalView("elections");
        setProfileForm(null);
        setPhotoPreview(null);
        setPhotoBlob(null);
        stopCamera();
        setError(
          data.inactiveMembershipRows.length
            ? "You are registered for this election, but it is currently inactive. Contact the admin."
            : "You are registered, but no active election is available yet. Contact the admin."
        );
        setLoading(false);
        return;
      }

      setAccessStatus("active");

      if (!activeMembershipRows.length) {
        setElectionRows([]);
        setError("You are registered, but no active election is available yet. Contact the admin.");
        setProfileForm(null);
        setLoading(false);
        return;
      }

      if (pendingActiveMembershipRows.length && !approvedActiveMembershipRows.length) {
        setVerificationStatus("pending");
        setElectionRows(activeMembershipRows);
        setSelectedElectionId(activeMembershipRows[0].election_id);
        setSessionRow(null);
        setPortalView("elections");
        setCurrentStep("details");
        setLoading(false);
        return;
      }

      if (!approvedActiveMembershipRows.length) {
        setVerificationStatus("none");
        setElectionRows(activeMembershipRows);
        setSelectedElectionId(activeMembershipRows[0].election_id);
        setSessionRow(null);
        setPortalView("elections");
        setCurrentStep("details");
        setLoading(false);
        return;
      }

      setVerificationStatus("approved");
      setElectionRows(approvedActiveMembershipRows);
      setPortalView("elections");
      const initialElectionId = approvedActiveMembershipRows[0].election_id;
      setSelectedElectionId(initialElectionId);
      setCurrentStep("details");
      setLoading(false);
    };

    loadProfile();
  }, [userEmail]);

  useEffect(() => {
    if (!profile || !selectedElectionId || currentStep !== "portal") {
      setCandidates([]);
      setSessionRow(null);
      return;
    }

    const loadElectionContext = async () => {
      if (portalView !== "ballot") {
        setCandidates([]);
        return;
      }

      setError(null);
      setSelectedCandidate(null);
      setVoteReason("");

      try {
        const session = (await supabaseClient.auth.getSession()).data.session;
        const response = await fetch(
          `/api/voter/candidates?electionId=${encodeURIComponent(selectedElectionId)}`,
          {
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : undefined,
            cache: "no-store",
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load candidates.");
        }

        const overrides = readCandidateOverrides();
        const nextCandidates = ((data.candidates as Candidate[]) ?? []).map((candidate) => {
          const normalizedCandidate = normalizeCandidate(candidate);
          const override = overrides[normalizedCandidate.id];
          return mergeCandidateOverrides(normalizedCandidate, override);
        });

        setCandidates(nextCandidates);
      } catch (err) {
        setCandidates([]);
        setError(err instanceof Error ? err.message : "Unable to load candidates.");
      }
    };

    loadElectionContext();
  }, [profile, selectedElectionId, currentStep, portalView]);

  useEffect(() => {
    if (!userEmail || currentStep === "portal") {
      return;
    }

    const interval = setInterval(() => {
      void (async () => {
        const session = await supabaseClient.auth.getSession();
        const email = session.data.session?.user.email?.trim().toLowerCase() ?? null;
        if (email) {
          setUserEmail(email);
        }
      })();
    }, 7000);

    return () => clearInterval(interval);
  }, [userEmail, currentStep]);

  useEffect(() => {
    if (!userEmail || currentStep !== "portal" || portalView !== "waiting") return;

    let mounted = true;
    const poll = async () => {
      try {
        const authUser = (await supabaseClient.auth.getUser()).data.user;
        const res = await fetch("/api/voter/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail, authUserId: authUser?.id }),
        });
        if (!mounted || !res.ok) return;
        const data = (await res.json()) as ResolveVoterResponse;

        const mapRow = (row: any): ElectionVoterRow => ({
          election_id: row.election_id,
          is_verified: row.is_verified,
          has_voted: row.has_voted,
          verification_status: row.verification_status,
          election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
        });

        const approved = (data.approvedActiveMembershipRows || []).map(mapRow);
        const pending = (data.pendingActiveMembershipRows || []).map(mapRow);
        const active = (data.activeMembershipRows || []).map(mapRow);

        // Update the election rows so the picker shows fresh state.
        if (mounted) {
          setElectionRows(active);
          // If the selected election was approved, move to portal.
          if (selectedElectionId) {
            const nowApproved = approved.find((r) => r.election_id === selectedElectionId);
            if (nowApproved) {
              setVerificationStatus("approved");
              setElectionRows(approved);
              setPortalView("ballot");
              return;
            }
            const nowPending = pending.find((r) => r.election_id === selectedElectionId);
            if (nowPending) {
              setVerificationStatus("pending");
            }
          } else if (approved.length) {
            // If no selection but approval arrived for any election, choose the first approved.
            setSelectedElectionId(approved[0].election_id);
            setVerificationStatus("approved");
            setElectionRows(approved);
            setPortalView("ballot");
            return;
          }
        }
      } catch (err) {
        // ignore transient errors
      }
    };

    // start immediately and then every 5s
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [userEmail, currentStep, portalView, selectedElectionId]);

  useEffect(() => {
    if (!sessionRow) {
      setTimeLeft(null);
      return;
    }

    const updateClock = () => {
      const expiresAt = new Date(sessionRow.expires_at).getTime();
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) {
        endSession();
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [sessionRow]);

  // Realtime subscription: if admin terminates this session (is_active -> false), end it immediately.
  useEffect(() => {
    if (!sessionRow?.id) return;
    const channelName = `public:sessions:id=eq.${sessionRow.id}`;
    const channel = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionRow.id}` },
        (payload: any) => {
          const newRow = payload?.new as SessionRow | null;
          if (newRow && newRow.is_active === false) {
            void endSession();
          }
        }
      )
      .subscribe();

    return () => {
      try {
        // unsubscribe/remove the channel
        channel.unsubscribe();
        // also remove from client just in case
        try { supabaseClient.removeChannel(channel); } catch {}
      } catch {}
    };
  }, [sessionRow?.id]);

  useEffect(() => {
    if (!showVoteModal) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowVoteModal(false);
      setPortalView("elections");
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [showVoteModal]);

  const ensureSession = async (voterId: string, electionId: string) => {
    const { data: activeSession, error: activeSessionError } = await supabaseClient
      .from("sessions")
      .select("id, election_id, expires_at, is_active, started_at")
      .eq("voter_id", voterId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSessionError) {
      setError(activeSessionError.message || "Unable to verify your active session.");
      return false;
    }

    if (activeSession) {
      const localSession = localStorage.getItem("mdc_session_id");
      if (activeSession.election_id === electionId && localSession === activeSession.id) {
        applySession(activeSession as SessionRow);
        return true;
      }

      if (activeSession.election_id === electionId) {
        applySession(activeSession as SessionRow);
        return true;
      }

      if (activeSession.election_id !== electionId) {
        setError(
          "Another election is already in progress for your account. Complete or terminate that session first."
        );
        return false;
      }

      setError("This election session is active on another device.");
      await supabaseClient.auth.signOut();
      return false;
    }

    const { data: existingSession, error: existingSessionError } = await supabaseClient
      .from("sessions")
      .select("id, election_id, expires_at, is_active, started_at")
      .eq("voter_id", voterId)
      .eq("election_id", electionId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSessionError) {
      setError(existingSessionError.message || "Unable to load your previous session.");
      return false;
    }

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

    if (existingSession) {
      const { data: revivedSession, error: reviveError } = await supabaseClient
        .from("sessions")
        .update({ expires_at: expiresAt, is_active: true })
        .eq("id", existingSession.id)
        .select("id, election_id, expires_at, is_active, started_at")
        .single();

      if (!reviveError && revivedSession) {
        applySession(revivedSession as SessionRow);
        return true;
      }
    }

    const { data: newSession, error: sessionError } = await supabaseClient
      .from("sessions")
      .insert({ voter_id: voterId, election_id: electionId, expires_at: expiresAt, is_active: true })
      .select("id, election_id, expires_at, is_active, started_at")
      .single();

    if (!sessionError && newSession) {
      applySession(newSession as SessionRow);
      return true;
    }

    // Fallback: if insert/update failed due a transient race or stale policy state,
    // try to re-read the newest active session and continue when available.
    const { data: fallbackSession } = await supabaseClient
      .from("sessions")
      .select("id, election_id, expires_at, is_active, started_at")
      .eq("voter_id", voterId)
      .eq("election_id", electionId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackSession) {
      applySession(fallbackSession as SessionRow);
      return true;
    }

    const session = (await supabaseClient.auth.getSession()).data.session;
    if (session?.access_token) {
      const fallback = await fetch("/api/voter/start-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ voterId, electionId }),
      });

      const fallbackData = await fallback.json();
      if (fallback.ok && fallbackData?.session) {
        applySession(fallbackData.session as SessionRow);
        return true;
      }

      if (!fallback.ok && typeof fallbackData?.error === "string") {
        setError(fallbackData.error);
        return false;
      }
    }

    if (sessionError) {
      setError(sessionError.message || "Unable to start a secure session. Please try again.");
      return false;
    }

    setError("Unable to start a secure session. Please try again.");
    return false;
  };

  useEffect(() => {
    if (!profile || currentStep !== "portal" || !selectedElectionId) {
      return;
    }

    if (sessionRow?.election_id === selectedElectionId && sessionRow.is_active) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const started = await ensureSession(profile.id, selectedElectionId);
      if (cancelled || !started) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, selectedElectionId, currentStep, sessionRow?.id]);

  const endSession = async () => {
    if (sessionRow) {
      await supabaseClient
        .from("sessions")
        .update({ is_active: false })
        .eq("id", sessionRow.id);
    }
    localStorage.removeItem("mdc_session_id");
    stopCamera();
    resetPhotoCapture();
    setSessionRow(null);
    setTimeLeft(null);
    setCandidates([]);
    setSelectedCandidate(null);
    setVoteReason("");
    setProfileForm(null);
    setPortalView("elections");
    setCurrentStep("details");
    await supabaseClient.auth.signOut();
  };

  const handleSignIn = async () => {
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/voter`,
      },
    });
  };

  const handleReport = async () => {
    if (!profile || !selectedElectionId || !reportMessage.trim()) {
      return;
    }
    setBusyAction("report");
    await supabaseClient.from("profile_reports").insert({
      voter_id: profile.id,
      election_id: selectedElectionId,
      message: reportMessage.trim(),
    });
    setReportMessage("");
    setBusyAction(null);
  };

  const handleProfileContinue = async () => {
    if (!profile || !selectedElectionId || !profileForm) {
      return;
    }

    setBusyAction("profile");
    setError(null);

    const { error: updateError } = await supabaseClient
      .from("voters")
      .update({
        registration_number: profileForm.registration_number.trim(),
        name: profileForm.name.trim(),
        email: profileForm.email.trim().toLowerCase(),
        mobile_number: profileForm.mobile_number.trim() || null,
        school: profileForm.school.trim() || null,
        stream: profileForm.stream.trim() || null,
        year_of_study: profileForm.year_of_study.trim() || null,
        domain: profileForm.domain.trim() || null,
        position: profileForm.position.trim() || null,
        stay: profileForm.stay.trim() || null,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message || "Unable to save your details.");
      setBusyAction(null);
      return;
    }

    setProfile({
      ...profile,
      registration_number: profileForm.registration_number.trim(),
      name: profileForm.name.trim(),
      email: profileForm.email.trim().toLowerCase(),
      mobile_number: profileForm.mobile_number.trim() || null,
      school: profileForm.school.trim() || null,
      stream: profileForm.stream.trim() || null,
      year_of_study: profileForm.year_of_study.trim() || null,
      domain: profileForm.domain.trim() || null,
      position: profileForm.position.trim() || null,
      stay: profileForm.stay.trim() || null,
    });
    setBusyAction(null);
    setCurrentStep("portal");
    setPortalView("elections");
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOn(true);
      }
    } catch {
      setError("Camera permission is required to capture a live photo.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
    }, "image/jpeg");

    stopCamera();
  };

  const uploadPhoto = async () => {
    if (!profile || !selectedElectionId || !photoBlob) {
      return;
    }
    setBusyAction("photo");
    const path = `${selectedElectionId}/${profile.registration_number}/${Date.now()}.jpg`;
    const { data, error: uploadError } = await supabaseClient.storage
      .from("voter-photos")
      .upload(path, photoBlob, { contentType: "image/jpeg" });

    if (uploadError) {
      setError("Photo upload failed.");
      setBusyAction(null);
      return;
    }

    await supabaseClient.from("verification_requests").insert({
      voter_id: profile.id,
      election_id: selectedElectionId,
      photo_path: data.path,
    });

    setVerificationStatus("pending");
    setRejectionComment(null);
    setPortalView("waiting");
    resetPhotoCapture();
    setBusyAction(null);
  };

  const handleVoteSubmit = async () => {
    const trimmedReason = voteReason.trim();
    if (!profile || !selectedElectionId || !selectedCandidate || trimmedReason.length < 10) {
      return;
    }

    if (!sessionRow || timeLeft === null || timeLeft <= 0) {
      setError("Your session has expired. Please sign in again.");
      await endSession();
      return;
    }

    setBusyAction("vote");
    try {
      const session = await supabaseClient.auth.getSession();
      const response = await fetch("/api/voter/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session.data.session?.access_token
            ? { Authorization: `Bearer ${session.data.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          voterId: profile.id,
          electionId: selectedElectionId,
          candidateId: selectedCandidate,
          reason: trimmedReason,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Vote submission failed. Please try again.");
      }

      await supabaseClient
        .from("election_voters")
        .update({ has_voted: true })
        .eq("voter_id", profile.id)
        .eq("election_id", selectedElectionId);

      setElectionRows((prev) =>
        prev.map((row) =>
          row.election_id === selectedElectionId ? { ...row, has_voted: true } : row
        )
      );

      setBusyAction(null);
      setVoteReason("");
      setSelectedCandidate(null);
      setShowVoteModal(true);
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote submission failed. Please try again.");
      setBusyAction(null);
      return;
    }
  };

  const displayTime = useMemo(() => {
    if (timeLeft === null) {
      return currentStep === "portal" ? "5:00" : "--:--";
    }
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [currentStep, timeLeft]);

  if (loading) {
    return (
      <div className="page-frame flex min-h-screen items-center justify-center">
        <p className="text-ink/70">Loading voter portal...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-frame min-h-screen px-6 py-10">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-charcoal/70">MDC Club</p>
          <h1 className="text-2xl font-semibold text-ink">Voter Verification & Voting</h1>
          <p className="mt-1 text-sm text-ink/60">
            {selectedElection?.election?.title ?? "Select your election"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentStep === "portal" ? (
            <>
              <span className="rounded-full border border-charcoal/25 bg-white/70 px-4 py-2 text-sm text-charcoal">
                Session Timer: {displayTime}
              </span>
              {userEmail ? (
                <button
                  className="rounded-full border border-charcoal/25 bg-white/70 px-4 py-2 text-sm text-charcoal"
                  onClick={endSession}
                >
                  Sign out
                </button>
              ) : null}
            </>
          ) : (
            <button
              className="rounded-full border border-charcoal/25 bg-white/70 px-4 py-2 text-sm text-charcoal"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Back to home
            </button>
          )}
        </div>
      </header>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-300/70 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!userEmail ? (
        <div className="glass-panel rounded-3xl p-8">
          <h2 className="text-lg font-semibold text-ink">Sign in with your institutional email</h2>
          <p className="mt-2 text-sm text-ink/65">
            Only registered voters are allowed. Use your official email account.
          </p>
          <button
            className="mt-4 rounded-full bg-charcoal px-6 py-3 text-sm font-semibold text-cream"
            onClick={handleSignIn}
          >
            Continue with Google
          </button>
        </div>
      ) : null}

      {accessStatus === "inactive" ? (
        <div className="glass-panel rounded-3xl p-8">
          <h2 className="text-lg font-semibold text-ink">Registered, but election inactive</h2>
          <p className="mt-2 text-sm text-ink/65">
            Your email is registered for this election, but it is currently inactive. Contact the admin.
          </p>
        </div>
      ) : null}

      {userEmail && profile && accessStatus === "active" && currentStep === "details" ? (
        <div className="glass-panel rounded-3xl p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Step 1: Confirm and edit your details</h2>
              <p className="mt-2 text-sm text-ink/65">
                Review the information pulled from Google, edit anything that needs correction, then continue to voting.
              </p>
            </div>
            <button
              className="rounded-full bg-charcoal px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
              onClick={handleProfileContinue}
              disabled={busyAction === "profile"}
            >
              {busyAction === "profile" ? "Saving..." : "Save and continue"}
            </button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Name</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.name ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, name: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Email ID</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.email ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, email: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Registration Number</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.registration_number ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, registration_number: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Mobile Number</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.mobile_number ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, mobile_number: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">School</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.school ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, school: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Stream</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.stream ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, stream: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Year of Study</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.year_of_study ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, year_of_study: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Domain</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.domain ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, domain: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Postion</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.position ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, position: event.target.value } : current)}
              />
            </label>
            <label className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <span className="text-xs text-ink/60">Stay</span>
              <input
                className="mt-1 w-full bg-transparent text-ink outline-none"
                value={profileForm?.stay ?? ""}
                onChange={(event) => setProfileForm((current) => current ? { ...current, stay: event.target.value } : current)}
              />
            </label>
            <div className="panel-outline rounded-2xl bg-white/70 px-4 py-3">
              <p className="text-xs text-ink/60">Points</p>
              <p className="mt-1 text-ink">{profile.points ?? profile.vote_points ?? 1}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink/60">
            You can edit every field except points. After saving, you will enter your dashboard.
          </p>
        </div>
      ) : null}

      {userEmail && profile && accessStatus === "active" && currentStep === "portal" ? (
        portalView === "elections" ? (
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Active elections</h2>
                <p className="mt-2 text-sm text-ink/65">
                  Choose an active election and click Vote to open the candidate list.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {electionRows.map((row) => (
                <div
                  key={row.election_id}
                  className="rounded-3xl border border-charcoal/10 bg-white/85 p-5 shadow-[0_16px_28px_rgba(8,31,92,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">
                        {row.election?.title ?? "Untitled election"}
                      </h3>
                      <p className="mt-2 text-sm text-ink/65">
                        {row.election?.description || "No description provided."}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-charcoal/5 px-3 py-2 text-xs text-charcoal">
                    <span>{row.has_voted ? "Vote already submitted" : row.is_verified ? "Ready to vote" : "Verification pending"}</span>
                    {row.has_voted ? (
                      <span className="rounded-full bg-white px-3 py-1 font-semibold text-charcoal">Voted</span>
                    ) : (
                      <button
                        className="rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream disabled:opacity-60"
                        onClick={() => {
                          setSelectedElectionId(row.election_id);
                          setPortalView("photo");
                        }}
                        disabled={row.has_voted}
                      >
                        Vote
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : portalView === "photo" ? (
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Live photo verification</h2>
                <p className="mt-2 text-sm text-ink/65">
                  Capture a live photo for this election. Candidate information unlocks after admin approval.
                </p>
              </div>
              <button
                className="rounded-full border border-charcoal/25 bg-white px-4 py-2 text-sm font-semibold text-charcoal"
                onClick={() => {
                  stopCamera();
                  resetPhotoCapture();
                  setPortalView("elections");
                }}
              >
                Back to dashboard
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl border border-charcoal/10 bg-white/80 p-5 text-sm text-ink/65">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-charcoal/60">Selected election</p>
                <p className="text-base font-semibold text-ink">{selectedElection?.election?.title ?? "Untitled election"}</p>
              </div>
              <div className="rounded-full bg-charcoal/5 px-3 py-1 font-semibold text-charcoal">
                Photo required before ballot access
              </div>
            </div>

            <div className="mt-6 flex justify-start">
              <div className="w-full max-w-[720px] rounded-3xl border border-charcoal/15 bg-[#0f172a] p-4 shadow-inner">
                <canvas ref={canvasRef} className="hidden" />
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  {!photoPreview ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-[420px] w-full object-cover"
                      />
                      {!isCameraOn ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-semibold text-white">
                          Start the camera to capture your live photo
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <img src={photoPreview} alt="Captured voter" className="h-[420px] w-full object-cover" />
                  )}

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-72 w-56 rounded-3xl border-2 border-white/70" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!photoPreview ? (
                    <>
                      <button
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-60"
                        onClick={startCamera}
                        disabled={isCameraOn}
                      >
                        Start camera
                      </button>
                      <button
                        className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        onClick={capturePhoto}
                        disabled={!isCameraOn}
                      >
                        Capture
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => {
                          // Recapture flow: clear preview and restart camera
                          resetPhotoCapture();
                          void startCamera();
                        }}
                      >
                        Recapture
                      </button>
                      <button
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-charcoal disabled:opacity-60"
                        onClick={uploadPhoto}
                        disabled={!photoBlob || busyAction === "photo" || !selectedElectionId}
                      >
                        {busyAction === "photo" ? "Uploading..." : "Submit for approval"}
                      </button>
                    </>
                  )}

                  {/* Back button removed per UX request (do not show in photo capture card) */}
                </div>
              </div>
            </div>
          </div>
        ) : portalView === "waiting" ? (
          <div className="glass-panel rounded-3xl p-8">
            <h2 className="text-lg font-semibold text-ink">Live photo submitted</h2>
            <p className="mt-2 text-sm text-ink/65">
              The admin must approve this election photo before candidate information and voting open.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-charcoal/15 bg-white px-4 py-2 text-sm text-ink">
                Election: {selectedElection?.election?.title ?? "Untitled election"}
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-charcoal/25 bg-white px-4 py-2 text-sm font-semibold text-charcoal"
                onClick={async () => {
                  const authUser = (await supabaseClient.auth.getUser()).data.user;
                  const res = await fetch("/api/voter/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: userEmail, authUserId: authUser?.id }),
                  });
                  if (!res.ok) return;
                  const data = (await res.json()) as ResolveVoterResponse;
                  const mapRow = (row: any): ElectionVoterRow => ({
                    election_id: row.election_id,
                    is_verified: row.is_verified,
                    has_voted: row.has_voted,
                    verification_status: row.verification_status,
                    election: Array.isArray(row.election) ? row.election[0] ?? null : row.election,
                  });
                  const approved = (data.approvedActiveMembershipRows || []).map(mapRow);
                  const pending = (data.pendingActiveMembershipRows || []).map(mapRow);
                  const active = (data.activeMembershipRows || []).map(mapRow);
                  const rejection = data.rejectionCommentByElection?.[selectedElectionId] ?? null;
                  setElectionRows(active);
                  if (selectedElectionId) {
                    if (approved.find((r) => r.election_id === selectedElectionId)) {
                      setVerificationStatus("approved");
                      setRejectionComment(null);
                      setElectionRows(approved);
                      setPortalView("ballot");
                    } else if (pending.find((r) => r.election_id === selectedElectionId)) {
                      setVerificationStatus("pending");
                    } else if (rejection || active.find((r) => r.election_id === selectedElectionId && r.verification_status === "rejected")) {
                      setVerificationStatus("rejected");
                      setRejectionComment(rejection);
                    }
                  }
                }}
              >
                Refresh
              </button>
            </div>
            <p className="mt-4 text-sm text-ink/60">
              Current status: {verificationStatus === "pending" ? "Pending admin approval" : verificationStatus === "rejected" ? "Rejected by admin" : "Awaiting approval"}
            </p>
            {verificationStatus === "rejected" ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Your photo was rejected.</p>
                <p className="mt-1">{rejectionComment || "No rejection comment was provided by the admin."}</p>
                <button
                  className="mt-3 rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream"
                  onClick={() => {
                    setPortalView("photo");
                    setVerificationStatus("none");
                    setRejectionComment(null);
                  }}
                >
                  Retake photo
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Cast vote</h2>
                <p className="mt-2 text-sm text-ink/65">
                  Review the candidate profiles below, choose one from the dropdown, write your reason, then submit.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-charcoal/10 bg-white/80 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-charcoal/60">Selected election</p>
                  <h3 className="text-xl font-semibold text-ink">
                    {selectedElection?.election?.title ?? "Untitled election"}
                  </h3>
                </div>
                <div className="rounded-full bg-charcoal/5 px-3 py-1 text-xs font-semibold text-charcoal">
                  {selectedElection?.has_voted ? "Vote submitted" : selectedElection?.is_verified ? "Ready" : "Locked"}
                </div>
              </div>
              <p className="mt-2 text-sm text-ink/65">
                {selectedElection?.election?.description || "No description provided."}
              </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-charcoal/60">Candidate information</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {candidates.length ? (
                    candidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        className={`rounded-3xl border p-4 text-left transition ${
                          selectedCandidate === candidate.id
                            ? "border-charcoal bg-charcoal/10"
                            : "border-charcoal/10 bg-white hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(8,31,92,0.08)]"
                        }`}
                        onClick={() => setSelectedCandidate(candidate.id)}
                        disabled={!selectedElection?.is_verified || selectedElection?.has_voted}
                      >
                        <div className="overflow-hidden rounded-2xl bg-[#0f172a]">
                          {candidate.photo_url ? (
                            <img
                              src={candidate.photo_url}
                              alt={candidate.name}
                              className="h-44 w-full bg-white/70 object-contain p-2"
                            />
                          ) : (
                            <div className="flex h-44 items-center justify-center text-sm text-white/70">
                              No photo available
                            </div>
                          )}
                        </div>
                        <div className="mt-4">
                          <h4 className="text-lg font-semibold text-ink">{candidate.name}</h4>
                          <div className="mt-3 space-y-1 text-sm text-ink/65">
                            <p>Email: {candidate.email ?? "N/A"}</p>
                            <p>Phone: {candidate.phone_number ?? "N/A"}</p>
                            <p>
                              Manifesto / document:{" "}
                              {looksLikeLink(candidate.manifesto) ? (
                                <a
                                  href={candidate.manifesto ?? "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-charcoal underline underline-offset-4"
                                >
                                  Open document
                                </a>
                              ) : (
                                candidate.manifesto ?? "No manifesto provided."
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-ink/60">No candidates have been added for this election yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-charcoal/10 bg-white/80 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-charcoal/60">Cast your vote</h3>
                <label className="mt-4 block text-sm font-semibold text-ink">Choose candidate</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-sm text-ink focus:border-charcoal/50 focus:outline-none"
                  value={selectedCandidate ?? ""}
                  onChange={(event) => setSelectedCandidate(event.target.value)}
                  disabled={!selectedElection?.is_verified || selectedElection?.has_voted}
                >
                  <option value="">Select a candidate</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>

                <label className="mt-5 block text-sm font-semibold text-ink">Reason</label>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/45"
                  placeholder="Write at least 10 characters..."
                  rows={5}
                  value={voteReason}
                  onChange={(event) => setVoteReason(event.target.value)}
                  disabled={!selectedElection?.is_verified || selectedElection?.has_voted}
                />

                <button
                  className="mt-4 rounded-full bg-charcoal px-6 py-3 text-sm font-semibold text-cream disabled:opacity-60"
                  onClick={handleVoteSubmit}
                  disabled={
                    !selectedElection?.is_verified ||
                    selectedElection?.has_voted ||
                    !selectedCandidate ||
                    voteReason.trim().length < 10 ||
                    busyAction === "vote"
                  }
                >
                  {selectedElection?.has_voted
                    ? "Vote submitted"
                    : busyAction === "vote"
                      ? "Submitting..."
                      : "Submit your vote"}
                </button>

              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
      {showVoteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowVoteModal(false)} />
          <div className="z-10 w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
            <h3 className="text-lg font-semibold text-ink">Vote submitted</h3>
            <p className="mt-3 text-sm text-ink/65">Your vote has been recorded successfully. Thank you for voting.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                className="rounded-full bg-charcoal px-5 py-2 text-sm font-semibold text-cream"
                onClick={() => {
                  setShowVoteModal(false);
                  setPortalView("elections");
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
