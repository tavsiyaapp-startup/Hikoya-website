"use server";

import { getActiveUsersNow } from "@/lib/queries/analytics";
import { getStaffSession } from "@/server/auth/staff";

// Polled by the admin dashboard widget only; for anyone else it says nothing.
export async function fetchActiveUsersNow(): Promise<number | null> {
  const staff = await getStaffSession();
  if (staff.status !== "staff") return null;
  return getActiveUsersNow();
}
