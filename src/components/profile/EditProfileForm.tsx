"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useTheme } from "@/lib/ThemeProvider";
import { authClient } from "@/lib/auth-client";
import { resizeImageFile } from "@/lib/image-resize";
import { uploadUserImage, deleteUserImage } from "@/lib/actions/uploads";
import { updateProfile } from "@/lib/actions/profile";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { SignOutButton } from "@/components/profile/SignOutButton";
import { TelegramLoginButton } from "@/components/auth/TelegramLoginButton";
import { isTelegramPlaceholderEmail } from "@/lib/telegram-account";

export function EditProfileForm({
  userId,
  username,
  displayName,
  avatarUrl,
  email,
  bio,
  instagramHandle,
  telegramHandle,
  telegramLinked,
}: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  bio: string | null;
  instagramHandle: string | null;
  telegramHandle: string | null;
  telegramLinked: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A Telegram-only account's placeholder address is never shown — the field
  // starts empty, as an offer to link a real email.
  const telegramOnly = isTelegramPlaceholderEmail(email);
  const [newEmail, setNewEmail] = useState(telegramOnly ? "" : (email ?? ""));
  const [telegramError, setTelegramError] = useState(false);
  const [accountMessages, setAccountMessages] = useState<string[]>([]);
  const [accountErrors, setAccountErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setAccountMessages([]);
        setAccountErrors([]);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const resized = await resizeImageFile(file, { maxWidth: 512, maxHeight: 512 });
      const formData = new FormData();
      formData.set("file", resized, resized.name);
      const result = await uploadUserImage("avatars", formData);
      if ("error" in result) throw new Error(result.error);
      // Only safe to clean up immediately when replacing an upload from
      // earlier in this same editing session — the avatarUrl prop is still
      // what's persisted until handleSubmit saves the change, and clicking
      // outside this panel discards the edit without saving (see the
      // outside-click effect above), so deleting that one here would break
      // the still-live avatar.
      if (preview && preview !== avatarUrl) {
        await deleteUserImage("avatars", preview);
      }
      setPreview(result.url);
    } catch {
      setError(t.profile.avatarError);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const saved = await updateProfile(username, formData);
      if (!saved) {
        setAccountErrors([t.onboarding.saveError]);
        return;
      }
      if (avatarUrl && preview !== avatarUrl) {
        await deleteUserImage("avatars", avatarUrl);
      }

      const messages: string[] = [];
      const errors: string[] = [];

      if (newEmail && newEmail !== email) {
        // Better Auth emails a confirmation link to the new address; the
        // email only actually changes once that link is opened (see
        // emailVerification in src/server/auth/config.ts).
        if (telegramOnly) {
          // A Telegram-only account links its first real email through its
          // own endpoint (src/server/auth/telegram-plugin.ts, /telegram/link-email).
          const res = await fetch("/api/auth/telegram/link-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ email: newEmail, callbackURL: window.location.pathname }),
          }).catch(() => null);
          if (res?.ok) messages.push(t.profile.emailLinkSent);
          else errors.push(t.profile.emailChangeError);
        } else {
          const { error } = await authClient.changeEmail({ newEmail, callbackURL: window.location.pathname });
          if (error) errors.push(t.profile.emailChangeError);
          else messages.push(t.profile.emailChangeSent);
        }
      }

      setAccountMessages(messages);
      setAccountErrors(errors);
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
    <div ref={boxRef} className="mt-4 flex flex-col gap-4 rounded-[12px] border border-border bg-card p-5">
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

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">
            {t.profile.instagramLabel} <span className="font-medium text-muted-2">{t.common.optional}</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-muted-2">@</span>
            <Input name="instagramHandle" defaultValue={instagramHandle ?? ""} placeholder="username" className="pl-8" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">
            {t.profile.telegramLabel} <span className="font-medium text-muted-2">{t.common.optional}</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-muted-2">@</span>
            <Input name="telegramHandle" defaultValue={telegramHandle ?? ""} placeholder="username" className="pl-8" />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-bold">
          {telegramOnly ? t.profile.emailLinkLabel : t.profile.emailLabel}
        </label>
        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <p className="mt-1 text-[12px] text-muted-2">{telegramOnly ? t.profile.emailLinkHint : t.profile.emailHint}</p>
      </div>

      <div>
        <div className="mb-1.5 text-[13px] font-bold">{t.profile.telegramLoginTitle}</div>
        {telegramLinked ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12.5px] text-muted-2">{t.profile.telegramLinked}</p>
            {/* A Telegram-only account keeps its only way in. */}
            {!telegramOnly && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setTelegramError(false);
                    const res = await fetch("/api/auth/telegram/unlink", { method: "POST", credentials: "same-origin" });
                    if (!res.ok) setTelegramError(true);
                    else router.refresh();
                  })
                }
                className="cursor-pointer text-[12.5px] font-bold text-danger disabled:opacity-50"
              >
                {t.profile.telegramUnlink}
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2 text-[12px] text-muted-2">{t.profile.telegramLinkHint}</p>
            <div className="flex justify-start">
              <TelegramLoginButton mode="link" />
            </div>
          </>
        )}
        {telegramError && <p className="mt-1 text-[12.5px] text-danger">{t.common.error}</p>}
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
        <Link prefetch={false} href={ROUTES.resetPassword}>
          <Button type="button" variant="secondary" size="sm">
            {t.profile.changePassword}
          </Button>
        </Link>
      </div>

      <div className="border-t border-border-soft pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-bold">{t.profile.darkTheme}</div>
            <p className="mt-0.5 text-[12px] text-muted-2">{t.profile.darkThemeHint}</p>
          </div>
          <Toggle
            checked={theme === "dark"}
            onChange={(next) => setTheme(next ? "dark" : "light")}
            label={t.profile.darkTheme}
          />
        </div>
      </div>

      <div className="border-t border-border-soft pt-4">
        <SignOutButton />
      </div>
    </div>
  );
}
