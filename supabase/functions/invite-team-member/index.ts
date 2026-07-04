import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type InviteRequest = {
  farmId?: string;
  email?: string;
  roleId?: string;
  accountMode?: 'personal' | 'shared';
  displayName?: string;
};

type JsonBody = Record<string, unknown>;

function json(status: number, body: JsonBody) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: 'Invite service is not configured.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { error: 'Missing authorization header.' });
  }

  let body: InviteRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const farmId = body.farmId?.trim();
  const email = body.email ? cleanEmail(body.email) : '';
  const roleId = body.roleId?.trim();
  const accountMode = body.accountMode ?? 'personal';
  const displayName = body.displayName?.trim() || null;

  if (!farmId || !email || !roleId) {
    return json(400, { error: 'Farm, email, and role are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Enter a valid email address.' });
  }

  if (accountMode !== 'personal' && accountMode !== 'shared') {
    return json(400, { error: 'Invalid account mode.' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json(401, { error: 'Invalid session.' });
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc(
    'farmkit_has_farm_role',
    {
      target_farm_id: farmId,
      role_keys: ['admin'],
    },
  );

  if (adminError) {
    return json(500, { error: adminError.message });
  }

  if (!isAdmin) {
    return json(403, { error: 'Only farm admins can invite team members.' });
  }

  const { data: role, error: roleError } = await serviceClient
    .from('roles')
    .select('id')
    .eq('id', roleId)
    .maybeSingle();

  if (roleError) {
    return json(500, { error: roleError.message });
  }

  if (!role) {
    return json(400, { error: 'Selected role no longer exists.' });
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  const [{ count: inviterCount }, { data: recentInvite }] = await Promise.all([
    serviceClient
      .from('farm_team_invites')
      .select('id', { count: 'exact', head: true })
      .eq('created_by_auth_user_id', user.id)
      .gte('created_at', oneHourAgo),
    serviceClient
      .from('farm_team_invites')
      .select('id, last_sent_at')
      .eq('farm_id', farmId)
      .eq('email', email)
      .gte('last_sent_at', tenMinutesAgo)
      .order('last_sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if ((inviterCount ?? 0) >= 20) {
    return json(429, { error: 'Invite limit reached. Try again later.' });
  }

  if (recentInvite) {
    return json(429, { error: 'That email was invited recently. Try again in a few minutes.' });
  }

  const { data: existingAuthUserId, error: lookupError } = await serviceClient.rpc(
    'farmkit_auth_user_id_by_email',
    { target_email: email },
  );

  if (lookupError) {
    return json(500, { error: lookupError.message });
  }

  let authUserId = existingAuthUserId as string | null;
  let inviteSent = false;

  if (!authUserId) {
    const origin = req.headers.get('Origin');
    const redirectTo =
      Deno.env.get('FARMKIT_INVITE_REDIRECT_URL') ??
      (origin ? `${origin}/welcome` : undefined);

    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: displayName ? { display_name: displayName } : undefined,
      });

    if (inviteError) {
      await serviceClient.from('farm_team_invites').insert({
        farm_id: farmId,
        email,
        role_id: roleId,
        account_mode: accountMode,
        display_name: displayName,
        status: 'failed',
        created_by_auth_user_id: user.id,
        error_message: inviteError.message,
      });
      return json(400, { error: inviteError.message });
    }

    authUserId = inviteData.user?.id ?? null;
    inviteSent = true;
  }

  if (!authUserId) {
    return json(500, { error: 'Invite did not return a user id.' });
  }

  const profilePayload: Record<string, string> = {
    auth_user_id: authUserId,
    email,
    default_farm_id: farmId,
    updated_at: now.toISOString(),
  };
  if (displayName) {
    profilePayload.display_name = displayName;
  }

  const membershipPayload: Record<string, string> = {
    farm_id: farmId,
    auth_user_id: authUserId,
    role_id: roleId,
    status: inviteSent ? 'invited' : 'active',
    account_mode: accountMode,
    invited_email: email,
    created_by_auth_user_id: user.id,
  };
  if (displayName) {
    membershipPayload.display_name_override = displayName;
  }

  const [{ error: profileError }, { error: membershipError }] = await Promise.all([
    serviceClient
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'auth_user_id' }),
    serviceClient
      .from('farm_memberships')
      .upsert(membershipPayload, { onConflict: 'farm_id,auth_user_id' }),
  ]);

  if (profileError) {
    return json(500, { error: profileError.message });
  }

  if (membershipError) {
    return json(500, { error: membershipError.message });
  }

  const { error: auditError } = await serviceClient.from('farm_team_invites').insert({
    farm_id: farmId,
    email,
    auth_user_id: authUserId,
    role_id: roleId,
    account_mode: accountMode,
    display_name: displayName,
    status: inviteSent ? 'sent' : 'accepted',
    created_by_auth_user_id: user.id,
    last_sent_at: inviteSent ? now.toISOString() : null,
    accepted_at: inviteSent ? null : now.toISOString(),
  });

  if (auditError) {
    return json(500, { error: auditError.message });
  }

  return json(200, {
    ok: true,
    inviteSent,
    authUserId,
    message: inviteSent
      ? 'Invite sent.'
      : 'Access granted to an existing Farmkit user.',
  });
});
