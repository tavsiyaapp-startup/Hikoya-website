"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AdminLoginForm({ next }: { next?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only ever follow an internal /admin destination — next comes from a URL
  // query param, so treat it as untrusted input rather than a safe redirect.
  const destination = next && next.startsWith("/admin") ? next : "/admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(t.admin.loginError);
      setPending(false);
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-90 flex-col gap-3">
      <Input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <Input
        type="password"
        required
        placeholder={t.admin.loginPasswordPlaceholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full justify-center">
        {pending ? t.common.loading : t.common.login}
      </Button>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </form>
  );
}
