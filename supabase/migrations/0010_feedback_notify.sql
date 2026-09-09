-- 0010: email dev@farmkit.ca whenever a feedback / bug report is filed.
--
-- The feedback table is write-only for app users (0005), so nobody noticed
-- reports piling up. A trigger now POSTs to the Resend API through pg_net
-- (async, fire-and-forget: the insert never waits on or fails because of
-- email). The Resend key is the same Vault secret the invite function uses.
-- Delivery results land in net._http_response for debugging.

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.farmkit_feedback_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  api_key text;
  reporter_email text;
  reporter_name text;
  farm_name text;
  subject text;
  body_text text;
begin
  select decrypted_secret into api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  limit 1;

  if api_key is null then
    return new;
  end if;

  select u.email, coalesce(p.display_name, u.raw_user_meta_data ->> 'display_name')
  into reporter_email, reporter_name
  from auth.users u
  left join public.user_profiles p on p.auth_user_id = u.id
  where u.id = new.auth_user_id;

  select f.name into farm_name from public.farms f where f.id = new.farm_id;

  subject := format('[Farmkit %s] %s: %s',
    case when new.kind = 'bug' then 'bug' else 'feedback' end,
    coalesce(farm_name, 'unknown farm'),
    left(regexp_replace(new.message, '\s+', ' ', 'g'), 70));

  body_text := concat_ws(E'\n',
    new.message,
    '',
    '--',
    'Type: ' || new.kind,
    'Farm: ' || coalesce(farm_name, 'unknown') || ' (' || coalesce(new.farm_id::text, '-') || ')',
    'From: ' || coalesce(reporter_name, '?') || ' <' || coalesce(reporter_email, '?') || '>',
    'Page: ' || coalesce(new.page_title, '') || ' ' || coalesce(new.page_path, ''),
    'Version: ' || coalesce(new.app_version, '?'),
    'Browser: ' || coalesce(new.user_agent, '?'),
    'Filed: ' || to_char(new.created_at at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI') || ' MT',
    'Row: ' || new.id::text);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Farmkit <invites@send.njmit.net>',
      'to', jsonb_build_array('dev@farmkit.ca'),
      'reply_to', coalesce(reporter_email, 'dev@farmkit.ca'),
      'subject', subject,
      'text', body_text));

  return new;
end;
$$;

revoke execute on function public.farmkit_feedback_notify() from public, anon, authenticated;

drop trigger if exists farmkit_feedback_notify on public.feedback;
create trigger farmkit_feedback_notify
  after insert on public.feedback
  for each row execute function public.farmkit_feedback_notify();

commit;
