"use client";

import { useEffect, useRef } from "react";

export function ChatScrollArea({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [children]);

  return (
    <div ref={ref} className="mb-5 max-h-[55vh] overflow-y-auto pr-1">
      {children}
    </div>
  );
}
