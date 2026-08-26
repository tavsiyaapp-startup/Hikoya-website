"use client";

import { useEffect, useRef } from "react";
import { markAllNotificationsRead } from "@/lib/actions/notifications";

export function NotificationsReadMarker({ userId }: { userId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    markAllNotificationsRead(userId);
  }, [userId]);

  return null;
}
