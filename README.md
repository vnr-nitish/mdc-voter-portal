# MDC Voting Website

Secure voting portal for MDC club elections. Voters sign in with institutional
emails, confirm and edit their profile details, then submit a single vote with
a reason. Admins approve verifications, manage sessions, and review votes
without being able to modify them.

The portal supports multiple elections (for example President and Vice
President), each with its own eligible voter set, candidates, verification
queue, and vote records.

## Current Flow

1. Voter signs in with Google.
2. Voter reviews and edits their details if needed.
3. Admin approval is required before voting.
4. Voter opens an election, reviews candidate information, and casts a vote.
5. The session expires after 5 minutes and signing out returns the user to step 1.

## Setup

1) Install dependencies:

```bash
npm install
```

2) Create a `.env.local` file using `.env.example` as a guide.

3) Apply the Supabase schema in `supabase/schema.sql`.

	If you already set up the project earlier, re-run the schema now to apply
	the multi-election tables and election-scoped columns.

4) Supabase setup checklist:

- Enable Google provider in Supabase Auth.
- Add your institutional domain to the Google OAuth allowed domains.
- Create a storage bucket named `voter-photos` and keep it private.

5) Start the development server:

```bash
npm run dev
```

## Environment Variables

See `.env.example` for required values. You will need:

- Supabase project URL and keys.
- Admin username/password for the admin login.
- Admin session secret for signing the admin cookie.

## Core Security Expectations

- Voters must exist in the `voters` table to proceed.
- Single active session per voter with a 5-minute expiry.
- One vote per voter per election enforced by database constraints.
- If a voter has an active session for one election, they cannot start another
	election session at the same time.
- Admin can approve and terminate sessions, but cannot edit votes.
