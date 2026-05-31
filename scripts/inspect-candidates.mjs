import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local if present (no dotenv dependency)
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const keyName = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      // remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[keyName] = val;
    }
  }
} catch (e) {
  // ignore
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or service role key. Please ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function inspect() {
  try {
    console.log('Fetching up to 200 candidate rows (raw):');
    const { data: candidates, error: candErr } = await supabase
      .from('candidates')
      .select('*')
      .limit(200);
    if (candErr) {
      console.error('Candidates query error:', candErr.message || candErr);
    } else {
      console.log(JSON.stringify(candidates, null, 2));
    }

    console.log('\nFetching recent candidate-related audit_logs (last 200):');
    const { data: audits, error: auditErr } = await supabase
      .from('audit_logs')
      .select('id, action, entity, entity_id, election_id, metadata, created_at')
      .eq('entity', 'candidate')
      .order('created_at', { ascending: false })
      .limit(200);
    if (auditErr) {
      console.error('Audit logs query error:', auditErr.message || auditErr);
    } else {
      console.log(JSON.stringify(audits, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(2);
  }
}

inspect();
