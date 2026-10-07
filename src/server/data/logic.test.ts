import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeChapterStatus,
  computeStoryStatus,
  isValidReportReason,
  MAX_NEW_TAGS_PER_STORY,
  MAX_TAG_LABEL_LENGTH,
  nextOrderIndex,
  sanitizeNewTagLabels,
  stripHtml,
  wordCount,
} from "./logic.ts";

describe("computeStoryStatus", () => {
  test("draft stays draft even when review is required", () => {
    assert.equal(computeStoryStatus("draft", true), "draft");
    assert.equal(computeStoryStatus("draft", false), "draft");
  });

  test("public/unlisted go to review when the platform requires it", () => {
    assert.equal(computeStoryStatus("public", true), "pending_review");
    assert.equal(computeStoryStatus("unlisted", true), "pending_review");
  });

  test("public/unlisted publish directly otherwise", () => {
    assert.equal(computeStoryStatus("public", false), "published");
  });
});

describe("computeChapterStatus", () => {
  test("matches the review setting", () => {
    assert.equal(computeChapterStatus(true), "pending_review");
    assert.equal(computeChapterStatus(false), "published");
  });
});

describe("nextOrderIndex", () => {
  test("starts at 1 for an empty story", () => {
    assert.equal(nextOrderIndex(null), 1);
  });

  test("appends after the current max", () => {
    assert.equal(nextOrderIndex(4), 5);
  });
});

describe("stripHtml / wordCount", () => {
  test("strips tags and counts words", () => {
    assert.equal(stripHtml("<p>Привет <b>мир</b></p>"), " Привет  мир  ");
    assert.equal(wordCount("<p>Привет <b>мир</b></p>"), 2);
  });

  test("empty content counts as zero words", () => {
    assert.equal(wordCount("<p></p>"), 0);
  });
});

describe("sanitizeNewTagLabels", () => {
  test("drops duplicates and blanks", () => {
    assert.deepEqual(sanitizeNewTagLabels(["Юмор", " ", "Юмор", ""]), ["Юмор"]);
  });

  test("drops labels longer than the limit", () => {
    const long = "a".repeat(MAX_TAG_LABEL_LENGTH + 1);
    assert.deepEqual(sanitizeNewTagLabels([long, "ок"]), ["ок"]);
  });

  test("caps the number of new tags per story", () => {
    const labels = Array.from({ length: MAX_NEW_TAGS_PER_STORY + 3 }, (_, i) => `tag${i}`);
    assert.equal(sanitizeNewTagLabels(labels).length, MAX_NEW_TAGS_PER_STORY);
  });
});

describe("isValidReportReason", () => {
  test("accepts the four known reasons", () => {
    for (const reason of ["spam", "abuse", "spoiler", "other"]) {
      assert.equal(isValidReportReason(reason), true);
    }
  });

  test("rejects anything else", () => {
    assert.equal(isValidReportReason("rude"), false);
    assert.equal(isValidReportReason(""), false);
  });
});
