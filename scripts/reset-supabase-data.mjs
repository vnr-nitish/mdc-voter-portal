import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const envFile = readFileSync(envPath, "utf8");

for (const line of envFile.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const equalsIndex = trimmed.indexOf("=");
  const key = trimmed.slice(0, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase credentials in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const tables = [
  "votes",
  "sessions",
  "verification_requests",
  "profile_reports",
  "election_voters",
  "candidates",
  "audit_logs",
  "elections",
  "voters",
];

const isMissingTableError = (message) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
};

const wipeTable = async (table) => {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    if (isMissingTableError(error.message)) {
      return { skipped: true, reason: error.message };
    }
    throw new Error(`Failed to wipe ${table}: ${error.message}`);
  }
  return { skipped: false };
};

const countRows = async (table) => {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) {
    if (isMissingTableError(error.message)) {
      return { count: null, skipped: true, reason: error.message };
    }
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }
  return { count: count ?? 0, skipped: false };
};

const result = { wiped: [], skipped: [] };

for (const table of tables) {
  const outcome = await wipeTable(table);
  if (outcome.skipped) {
    result.skipped.push({ table, reason: outcome.reason });
  } else {
    result.wiped.push(table);
  }
}

const summary = {};
for (const table of tables) {
  const outcome = await countRows(table);
  summary[table] = outcome.count;
  if (outcome.skipped) {
    result.skipped.push({ table, reason: outcome.reason });
  }
}

console.log(JSON.stringify({ ...result, remainingRows: summary }, null, 2));