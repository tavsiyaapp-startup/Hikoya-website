"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";

// Styled to match the "← Home" link right above it in admin/layout.tsx's
// sidebar — that one's a plain <Link>, this one needs to be a client
// component since signing out is a Better Auth client-side call.
export function AdminSignOutLink({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    await authClient.signOut();
    router.push(ROUTES.adminLogin);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="flex h-11.5 shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-left text-[14.5px] font-semibold text-[#8B82A8] hover:bg-white/6 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
