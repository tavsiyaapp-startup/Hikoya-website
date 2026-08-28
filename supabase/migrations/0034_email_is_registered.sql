-- Lets the registration form (onboarding) tell an already-registered email
-- apart from a genuinely new one, so it can steer them to /login instead of
-- silently sending another magic link under a "you're signing up" banner.
-- This is a deliberate, narrow email-enumeration surface (existence only,
-- nothing else about the account) — an accepted tradeoff for this exact
-- "email already registered" UX, same as most sites with a signup form.
create or replace function email_is_registered(check_email text) returns boolean as $$
  select exists (select 1 from auth.users where lower(email) = lower(check_email));
$$ language sql security definer stable;

revoke all on function email_is_registered(text) from public;
grant execute on function email_is_registered(text) to anon, authenticated;
