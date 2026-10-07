import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessAdmin,
  canAddChapter,
  canChangeRole,
  canChangeUserStatus,
  canCloseRequest,
  canCommentOnChapter,
  canCommentOnStory,
  canDeleteStory,
  canEditChapter,
  canEditComment,
  canEditOwnProfile,
  canEditStory,
  canHideComment,
  canLikeComment,
  canReportComment,
  canReviewReports,
  canSendAdminChatMessage,
  canManageCollection,
  canSaveCollection,
  canSubmitChapterForReview,
  canSubmitStoryForReview,
  canVerifyUser,
  canViewChapter,
  canViewCollection,
  canViewStory,
  type ChapterRecord,
  type CollectionRecord,
  type MaybeViewer,
  type RequestRecord,
  type StoryRecord,
  type Viewer,
} from "./policy.ts";

const AUTHOR: Viewer = { id: "author", role: "author", status: "active" };
const OTHER: Viewer = { id: "other", role: "reader", status: "active" };
const MODERATOR: Viewer = { id: "mod", role: "moderator", status: "active" };
const ADMIN: Viewer = { id: "admin", role: "admin", status: "active" };
const BLOCKED_READER: Viewer = { id: "blocked", role: "reader", status: "blocked" };
const STRANGER: Viewer = { id: "stranger", role: "reader", status: "active" };
const GUEST: MaybeViewer = null;

function story(overrides: Partial<StoryRecord> = {}): StoryRecord {
  return {
    id: "s1",
    author_id: "author",
    status: "published",
    visibility: "public",
    deleted_at: null,
    ...overrides,
  };
}

function chapter(overrides: Partial<ChapterRecord> = {}): ChapterRecord {
  return { id: "c1", story_id: "s1", status: "published", ...overrides };
}

describe("видимость истории", () => {
  test("гость видит опубликованную публичную историю", () => {
    assert.equal(canViewStory(GUEST, story()), true);
  });

  test("гость видит опубликованную историю по ссылке (unlisted)", () => {
    assert.equal(canViewStory(GUEST, story({ visibility: "unlisted" })), true);
  });

  test("гость не видит черновик, даже если статус не published", () => {
    // Раньше политика stories пропускала любой статус, кроме published. Закрыто.
    assert.equal(canViewStory(GUEST, story({ status: "draft" })), false);
    assert.equal(canViewStory(GUEST, story({ status: "pending_review" })), false);
  });

  test("чужой пользователь не видит черновик", () => {
    assert.equal(canViewStory(OTHER, story({ status: "draft" })), false);
  });

  test("автор видит свой черновик, модератор и админ тоже", () => {
    assert.equal(canViewStory(AUTHOR, story({ status: "draft" })), true);
    assert.equal(canViewStory(MODERATOR, story({ status: "draft" })), true);
    assert.equal(canViewStory(ADMIN, story({ status: "draft" })), true);
  });

  test("удалённая история видна только автору и staff", () => {
    const deleted = story({ deleted_at: "2026-10-01T00:00:00Z" });
    assert.equal(canViewStory(GUEST, deleted), false);
    assert.equal(canViewStory(OTHER, deleted), false);
    assert.equal(canViewStory(AUTHOR, deleted), true);
    assert.equal(canViewStory(MODERATOR, deleted), true);
  });
});

describe("видимость главы", () => {
  test("опубликованная глава опубликованной истории видна всем", () => {
    assert.equal(canViewChapter(GUEST, chapter(), story()), true);
  });

  test("черновик главы не виден гостю, даже в опубликованной истории", () => {
    assert.equal(canViewChapter(GUEST, chapter({ status: "draft" }), story()), false);
  });

  test("глава не видна, если история скрыта", () => {
    assert.equal(canViewChapter(GUEST, chapter(), story({ status: "draft" })), false);
  });

  test("глава из другой истории не проходит проверку", () => {
    assert.equal(canViewChapter(GUEST, chapter({ story_id: "other-story" }), story()), false);
  });

  test("автор и staff видят черновик главы", () => {
    assert.equal(canViewChapter(AUTHOR, chapter({ status: "draft" }), story()), true);
    assert.equal(canViewChapter(ADMIN, chapter({ status: "draft" }), story()), true);
  });
});

describe("редактирование и добавление глав", () => {
  test("автор редактирует свою главу", () => {
    assert.equal(canEditChapter(AUTHOR, chapter(), story()), true);
  });

  test("чужой пользователь не редактирует главу", () => {
    assert.equal(canEditChapter(OTHER, chapter(), story()), false);
  });

  test("модератор редактирует чужую главу (как было в RLS)", () => {
    assert.equal(canEditChapter(MODERATOR, chapter(), story()), true);
  });

  test("заблокированный автор не редактирует свою главу", () => {
    const blockedAuthor: Viewer = { ...AUTHOR, status: "blocked" };
    assert.equal(canEditChapter(blockedAuthor, chapter(), story()), false);
  });

  test("добавлять главу может только автор, staff не может", () => {
    assert.equal(canAddChapter(AUTHOR, story()), true);
    assert.equal(canAddChapter(ADMIN, story()), false);
    assert.equal(canAddChapter(OTHER, story()), false);
  });
});

describe("редактирование истории", () => {
  test("автор и staff редактируют историю, чужой пользователь нет", () => {
    assert.equal(canEditStory(AUTHOR, story()), true);
    assert.equal(canEditStory(MODERATOR, story()), true);
    assert.equal(canEditStory(OTHER, story()), false);
    assert.equal(canEditStory(GUEST, story()), false);
  });

  test("заблокированный автор не редактирует свою историю", () => {
    assert.equal(canEditStory({ ...AUTHOR, status: "blocked" }, story()), false);
  });
});

describe("отправка на проверку и удаление", () => {
  test("отправить историю на проверку можно только из черновика", () => {
    assert.equal(canSubmitStoryForReview(AUTHOR, story({ status: "draft" })), true);
    assert.equal(canSubmitStoryForReview(AUTHOR, story({ status: "published" })), false);
  });

  test("отправить главу на проверку можно только из черновика и только автору", () => {
    assert.equal(canSubmitChapterForReview(AUTHOR, chapter({ status: "draft" }), story()), true);
    assert.equal(canSubmitChapterForReview(AUTHOR, chapter({ status: "published" }), story()), false);
    assert.equal(canSubmitChapterForReview(OTHER, chapter({ status: "draft" }), story()), false);
  });

  test("удалить историю может только автор, staff не может", () => {
    assert.equal(canDeleteStory(AUTHOR, story()), true);
    assert.equal(canDeleteStory(MODERATOR, story()), false);
  });
});

describe("комментарии и лайки", () => {
  test("комментировать можно только видимую главу", () => {
    assert.equal(canCommentOnChapter(OTHER, chapter(), story()), true);
    assert.equal(canCommentOnChapter(OTHER, chapter({ status: "draft" }), story()), false);
  });

  test("комментировать можно только видимую историю", () => {
    assert.equal(canCommentOnStory(OTHER, story()), true);
    assert.equal(canCommentOnStory(OTHER, story({ status: "draft" })), false);
  });

  test("заблокированный пользователь не комментирует", () => {
    assert.equal(canCommentOnStory(BLOCKED_READER, story()), false);
    assert.equal(canCommentOnChapter(BLOCKED_READER, chapter(), story()), false);
  });

  test("гость не комментирует", () => {
    assert.equal(canCommentOnStory(GUEST, story()), false);
  });

  test("лайк комментария требует видимого родителя", () => {
    assert.equal(canLikeComment(OTHER, true), true);
    assert.equal(canLikeComment(OTHER, false), false);
    assert.equal(canLikeComment(BLOCKED_READER, true), false);
  });

  test("редактировать комментарий могут автор и staff", () => {
    const comment = { id: "k1", user_id: "other" };
    assert.equal(canEditComment(OTHER, comment), true);
    assert.equal(canEditComment(MODERATOR, comment), true);
    assert.equal(canEditComment(AUTHOR, comment), false);
  });
});

describe("подборки", () => {
  const publicCollection: CollectionRecord = { id: "p1", owner_id: "other", is_private: false };
  const privateCollection: CollectionRecord = { id: "p2", owner_id: "other", is_private: true };

  test("публичную подборку видят все, приватную — владелец и staff", () => {
    assert.equal(canViewCollection(GUEST, publicCollection), true);
    assert.equal(canViewCollection(GUEST, privateCollection), false);
    assert.equal(canViewCollection(STRANGER, privateCollection), false);
    assert.equal(canViewCollection(OTHER, { ...privateCollection, owner_id: OTHER.id }), true);
    assert.equal(canViewCollection(MODERATOR, privateCollection), true);
  });

  test("сохранить можно только видимую подборку", () => {
    assert.equal(canSaveCollection(AUTHOR, publicCollection), true);
    assert.equal(canSaveCollection(AUTHOR, privateCollection), false);
  });

  test("менять подборку может владелец и staff", () => {
    assert.equal(canManageCollection(OTHER, { ...privateCollection, owner_id: OTHER.id }), true);
    assert.equal(canManageCollection(STRANGER, publicCollection), false);
  });
});

describe("запросы сообщества", () => {
  const request: RequestRecord = { id: "r1", from_user_id: "other" };

  test("закрыть запрос может только создавший", () => {
    assert.equal(canCloseRequest(OTHER, request), true);
    assert.equal(canCloseRequest(AUTHOR, request), false);
  });
});

describe("профиль", () => {
  test("профиль меняет только сам пользователь", () => {
    assert.equal(canEditOwnProfile(OTHER, "other"), true);
    assert.equal(canEditOwnProfile(OTHER, "author"), false);
    assert.equal(canEditOwnProfile(BLOCKED_READER, "blocked"), false);
  });
});

describe("заблокированный пользователь", () => {
  test("пишет в свой тред поддержки, даже заблокированный", () => {
    assert.equal(canSendAdminChatMessage(BLOCKED_READER, BLOCKED_READER.id), true);
  });

  test("не пишет в чужой тред поддержки", () => {
    assert.equal(canSendAdminChatMessage(BLOCKED_READER, "other"), false);
  });

  test("заблокированный staff не отвечает в тред поддержки", () => {
    const blockedAdmin: Viewer = { ...ADMIN, status: "blocked" };
    assert.equal(canSendAdminChatMessage(blockedAdmin, "other"), false);
  });

  test("гость не пишет в поддержку", () => {
    assert.equal(canSendAdminChatMessage(GUEST, "other"), false);
  });

  test("может пожаловаться на видимый комментарий чужого пользователя", () => {
    const comment = { id: "k1", user_id: "other" };
    assert.equal(canReportComment(BLOCKED_READER, comment, true), true);
  });

  test("не может пожаловаться на свой комментарий и на невидимый", () => {
    const own = { id: "k1", user_id: BLOCKED_READER.id };
    assert.equal(canReportComment(BLOCKED_READER, own, true), false);
    const other = { id: "k2", user_id: "other" };
    assert.equal(canReportComment(BLOCKED_READER, other, false), false);
  });

  test("по-прежнему не комментирует и не ставит лайки", () => {
    assert.equal(canCommentOnStory(BLOCKED_READER, story()), false);
    assert.equal(canLikeComment(BLOCKED_READER, true), false);
  });
});

describe("жалобы", () => {
  test("гость не жалуется", () => {
    assert.equal(canReportComment(GUEST, { id: "k1", user_id: "other" }, true), false);
  });

  test("разбирает жалобы и скрывает комментарии staff, читатель нет", () => {
    assert.equal(canReviewReports(ADMIN), true);
    assert.equal(canReviewReports(MODERATOR), true);
    assert.equal(canReviewReports(OTHER), false);
    assert.equal(canHideComment(MODERATOR), true);
    assert.equal(canHideComment(OTHER), false);
  });
});

describe("админка", () => {
  test("доступ в админку у модератора и админа, у читателя и гостя нет", () => {
    assert.equal(canAccessAdmin(MODERATOR), true);
    assert.equal(canAccessAdmin(ADMIN), true);
    assert.equal(canAccessAdmin(OTHER), false);
    assert.equal(canAccessAdmin(GUEST), false);
  });

  test("заблокированный админ не получает доступ", () => {
    assert.equal(canAccessAdmin({ ...ADMIN, status: "blocked" }), false);
  });

  test("роли меняет только админ", () => {
    assert.equal(canChangeRole(ADMIN), true);
    assert.equal(canChangeRole(MODERATOR), false);
  });

  test("модератор не может заблокировать администратора", () => {
    // Требование владельца проекта.
    assert.equal(canChangeUserStatus(MODERATOR, { id: "admin", role: "admin" }), false);
  });

  test("модератор может заблокировать читателя и автора", () => {
    assert.equal(canChangeUserStatus(MODERATOR, { id: "reader1", role: "reader" }), true);
    assert.equal(canChangeUserStatus(MODERATOR, { id: "author1", role: "author" }), true);
  });

  test("модератор может заблокировать другого модератора (защищён только админ)", () => {
    assert.equal(canChangeUserStatus(MODERATOR, { id: "mod2", role: "moderator" }), true);
  });

  test("админ может заблокировать модератора и другого админа", () => {
    assert.equal(canChangeUserStatus(ADMIN, { id: "mod2", role: "moderator" }), true);
    assert.equal(canChangeUserStatus(ADMIN, { id: "admin2", role: "admin" }), true);
  });

  test("никто не блокирует сам себя", () => {
    assert.equal(canChangeUserStatus(ADMIN, { id: "admin", role: "admin" }), false);
    assert.equal(canChangeUserStatus(MODERATOR, { id: "mod", role: "moderator" }), false);
  });

  test("модератор не может отметить администратора проверенным", () => {
    assert.equal(canVerifyUser(MODERATOR, { id: "admin", role: "admin" }), false);
    assert.equal(canVerifyUser(MODERATOR, { id: "reader1", role: "reader" }), true);
  });

  test("обычный пользователь не может менять статус никого", () => {
    assert.equal(canChangeUserStatus(OTHER, { id: "reader1", role: "reader" }), false);
  });
});
