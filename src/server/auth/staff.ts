import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth/config";

export type StaffSession = {
  id: string;
  email: string;
  role: "admin" | "moderator";
  isAdmin: boolean;
};

// Every existing call site this replaces (proxy.ts, admin/layout.tsx,
// requireStaff()/requireAdmin()) sends a signed-out visitor to a different
// place than a signed-in-but-not-staff one (the login page vs. just home)
// — a plain `| null` return would collapse that distinction, so this
// stays a discriminated result instead.
export type StaffSessionResult =
  | { status: "staff"; staff: StaffSession }
  | { status: "not-staff" }
  | { status: "signed-out" };

// Better-Auth-backed counterpart to src/lib/current-user.ts's
// getCurrentUser() — used by every /admin gate (proxy.ts, admin/layout.tsx,
// requireStaff()/requireAdmin() in src/lib/actions/admin.ts and
// admin-chat.ts, and the two standalone API routes under
// src/app/api/admin/) instead of each reading a Supabase session +
// profiles.role lookup separately. Admin's actual writes already go
// through the service-role Supabase client (createAdminClient(), bypasses
// RLS) — this only answers "who is this and are they staff", the same
// question those call sites asked of Supabase before.
export async function getStaffSession(): Promise<StaffSessionResult> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { status: "signed-out" };

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "moderator") return { status: "not-staff" };

  return {
    status: "staff",
    staff: { id: session.user.id, email: session.user.email, role, isAdmin: role === "admin" },
  };
}
