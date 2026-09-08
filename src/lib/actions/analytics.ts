"use server";

import { getActiveUsersNow } from "@/lib/queries/analytics";

export async function fetchActiveUsersNow() {
  return getActiveUsersNow();
}
