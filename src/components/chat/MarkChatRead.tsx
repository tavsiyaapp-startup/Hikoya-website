"use client";

import { useEffect } from "react";
import { markAdminChatReadByUser, markAdminChatReadByAdmin } from "@/lib/actions/admin-chat";

// Fires once when a thread is opened — mirrors "open the conversation ->
// it's read" chat UX, unlike notifications which need an explicit click.
export function MarkChatRead({ as, targetUserId }: { as: "user" | "admin"; targetUserId?: string }) {
  useEffect(() => {
    if (as === "user") markAdminChatReadByUser();
    else if (targetUserId) markAdminChatReadByAdmin(targetUserId);
  }, [as, targetUserId]);

  return null;
}
