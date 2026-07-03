/**
 * Send a Supabase invite email and upsert app_users with the new auth user id.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node supabase/invite_user.ts user@example.com [role] [firstName] [lastName]
 *
 * Notes:
 * - Requires the service role key (do NOT ship this to the client).
 * - If an app_users row already exists for this email, it will be updated with the new auth_user_id.
 */
import { createClient } from '@supabase/supabase-js';

const [email, roleArg, firstNameArg, lastNameArg] = process.argv.slice(2);

if (!email) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node supabase/invite_user.ts user@example.com [role] [firstName] [lastName]');
  process.exit(1);
}

const role = roleArg || 'user';
const first_name = firstNameArg || null;
const last_name = lastNameArg || null;
const name = [first_name, last_name].filter(Boolean).join(' ') || email;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role, first_name, last_name, name },
  });
  if (inviteError) {
    console.error('Invite failed:', inviteError.message);
    process.exit(1);
  }

  const auth_user_id = inviteData.user?.id;
  if (!auth_user_id) {
    console.error('Invite succeeded but no auth user id returned.');
    process.exit(1);
  }

  const { error: upsertError } = await supabase.from('app_users').upsert(
    {
      auth_user_id,
      email,
      role,
      first_name,
      last_name,
      name,
    },
    { onConflict: 'auth_user_id' },
  );
  if (upsertError) {
    console.error('Upsert app_users failed:', upsertError.message);
    process.exit(1);
  }

  console.log(`Invite sent to ${email}. Auth user id: ${auth_user_id}`);
}

main();
