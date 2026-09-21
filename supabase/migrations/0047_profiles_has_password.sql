-- Whether the account has a password set. Supabase's identities array can't
-- answer this reliably — a magic-link (email OTP) sign-in also creates an
-- 'email' identity with no password, same as a real email+password signup —
-- so this is tracked explicitly, flipped to true whenever a password is
-- actually set (onboarding, /auth/set-password, or the profile settings
-- reset-email flow). Existing accounts backfill to false: worst case a user
-- who already had a password gets prompted once more to set it again, which
-- is harmless — there's no reliable way to tell them apart retroactively.
alter table profiles add column has_password boolean not null default false;
