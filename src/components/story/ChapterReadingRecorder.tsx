"use client";

import { useEffect, useRef } from "react";
import { recordChapterView } from "@/lib/actions/reading";

export function ChapterReadingRecorder(props: {
  chapterId: string;
  storyId: string;
  orderIndex: number;
  totalChapters: number;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    recordChapterView(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
