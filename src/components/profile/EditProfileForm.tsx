"use client";

import { useState, useTransition } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function EditProfileForm({
  userId,
  username,
  displayName,
  avatarUrl,
}: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t.profile.editProfile}
      </Button>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await updateProfile(username, formData);
          setOpen(false);
        })
      }
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

      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
