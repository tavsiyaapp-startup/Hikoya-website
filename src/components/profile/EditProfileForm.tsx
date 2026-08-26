"use client";

import { useState, useTransition } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const MIN_PASSWORD_LENGTH = 6;

export function EditProfileForm({
  userId,
  username,
  displayName,
  avatarUrl,
  email,
}: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState(email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [accountMessages, setAccountMessages] = useState<string[]>([]);
  const [accountErrors, setAccountErrors] = useState<string[]>([]);
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
    if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      setAccountErrors([t.profile.passwordTooShort]);
      return;
    }

    startTransition(async () => {
      await updateProfile(username, formData);

      const messages: string[] = [];
      const errors: string[] = [];
      const supabase = createClient();

      if (newEmail && newEmail !== email) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) errors.push(t.profile.emailChangeError);
        else messages.push(t.profile.emailChangeSent);
      }

      if (newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) errors.push(t.profile.passwordChangeError);
        else messages.push(t.profile.passwordChanged);
      }

      setAccountMessages(messages);
      setAccountErrors(errors);
      setNewPassword("");
      if (messages.length === 0 && errors.length === 0) setOpen(false);
    });
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
    <form
      action={handleSubmit}
      className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
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
        <label className="mb-1.5 block text-[13px] font-bold">{t.profile.emailLabel}</label>
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <p className="mt-1 text-[12px] text-muted-2">{t.profile.emailHint}</p>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">{t.profile.passwordLabel}</label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
        />
        <p className="mt-1 text-[12px] text-muted-2">{t.profile.passwordHint}</p>
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
  );
}
