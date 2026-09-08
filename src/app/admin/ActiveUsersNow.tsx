"use client";

import { useEffect, useState } from "react";
import { fetchActiveUsersNow } from "@/lib/actions/analytics";

const POLL_MS = 30_000;

export function ActiveUsersNow({ initialValue, label }: { initialValue: number; label: string }) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveUsersNow().then((v) => {
        if (v !== null) setValue(v);
      });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[20px] border border-border bg-card px-6 py-4">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
      </span>
      <span className="text-[14px] text-muted-2">{label}</span>
      <span className="text-[20px] font-extrabold tracking-tight">{value}</span>
    </div>
  );
}
