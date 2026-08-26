"use client";

import { useState, useTransition } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/actions/profile";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/profile/SignOutButton";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

export function EditProfileForm({
  userId,
  username,
  displayName,
  avatarUrl,
  email,
  bio,
}: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  bio: string | null;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState(email ?? "");
  const [accountMessages, setAccountMessages] = useState<string[]>([]);
  const [accountErrors, setAccountErrors] = useState<string[]>([]);
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setPreview(data.publicUrl);
    } catch {
      setError(t.profile.avatarError);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateProfile(username, formData);

      const messages: string[] = [];
      const errors: string[] = [];

      if (newEmail && newEmail !== email) {
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) errors.push(t.profile.emailChangeError);
        else messages.push(t.profile.emailChangeSent);
      }

      setAccountMessages(messages);
      setAccountErrors(errors);
      if (messages.length === 0 && errors.length === 0) setOpen(false);
    });
  }

  // Doesn't take a new password directly — sends a confirmation link to the
  // account's current email first ("is this really you?"). The password is
  // only ever actually set on /auth/reset-password, after that link is
  // clicked, so a hijacked open session alone can't silently take over login.
  async function handleChangePasswordClick() {
    if (!email) return;
    setResetPending(true);
    setResetMessage(null);
    setResetError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}${ROUTES.resetPassword}`,
    });
    setResetPending(false);
    if (error) setResetError(t.profile.passwordResetError);
    else setResetMessage(t.profile.passwordResetSent);
  }

  if (!open) {
    return (
      <div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {t.profile.editProfile}
        </Button>
        {accountMessages.map((msg) => (
          <p key={msg} className="mt-2 text-[12.5px] text-primary-800">
            {msg}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="avatarUrl" value={preview ?? ""} />

      <div className="flex items-center gap-4">
        <Avatar name={displayName} src={preview} size={72} />
        <label className="cursor-pointer text-[13px] font-bold text-primary-800">
          {uploading ? t.common.loading : t.profile.changeAvatar}
          <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </label>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.profile.usernameLabel}</label>
        <Input value={`@${username}`} disabled className="opacity-60" />
        <p className="mt-1 text-[12px] text-muted-2">{t.profile.usernameHint}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.profile.displayNameLabel}</label>
        <Input name="displayName" defaultValue={displayName} required />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.profile.bioLabel}</label>
        <Textarea name="bio" defaultValue={bio ?? ""} placeholder={t.profile.bioPlaceholder} rows={3} />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.profile.emailLabel}</label>
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <p className="mt-1 text-[12px] text-muted-2">{t.profile.emailHint}</p>
      </div>

      {accountMessages.map((msg) => (
        <p key={msg} className="text-[12.5px] text-primary-800">
          {msg}
        </p>
      ))}
      {accountErrors.map((msg) => (
        <p key={msg} className="text-[12.5px] text-danger">
          {msg}
        </p>
      ))}

      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setAccountMessages([]);
            setAccountErrors([]);
            setOpen(false);
          }}
        >
          {t.common.cancel}
        </Button>
      </div>
      </form>

      <div className="border-t border-border-soft pt-4">
        <div className="mb-1 text-[13px] font-bold">{t.profile.changePassword}</div>
        <p className="mb-3 text-[12px] text-muted-2">{t.profile.changePasswordHint}</p>
        <Button type="button" variant="secondary" size="sm" onClick={handleChangePasswordClick} disabled={resetPending}>
          {resetPending ? t.common.loading : t.profile.changePassword}
        </Button>
        {resetMessage && <p className="mt-2 text-[12px] text-primary-800">{resetMessage}</p>}
        {resetError && <p className="mt-2 text-[12px] text-danger">{resetError}</p>}
      </div>

      <div className="border-t border-border-soft pt-4">
        <SignOutButton />
      </div>
    </div>
  );
}
