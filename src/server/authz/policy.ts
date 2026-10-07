import type { ChapterStatus, StoryStatus, StoryVisibility, UserRole, UserStatus } from "@/types/database";

// Права доступа, которые раньше держала RLS в Supabase. Каждая функция чистая:
// получает уже загруженные записи и возвращает boolean, без обращения к базе.
// Правила взяты из backups/access_rules.md и backups/backend_functions.md.
//
// `null` значит гость (неавторизованный). Заблокированный пользователь (status = 'blocked')
// читает как обычный, но писать не может: см. isActive.

export interface Viewer {
  id: string;
  role: UserRole;
  status: UserStatus;
}

export type MaybeViewer = Viewer | null;

export interface StoryRecord {
  id: string;
  author_id: string;
  status: StoryStatus;
  visibility: StoryVisibility;
  // Drizzle returns a Date; callers building a plain object by hand (tests,
  // RSC props) commonly have a string. Either works: isStoryPubliclyVisible
  // only checks truthiness.
  deleted_at?: string | Date | null;
}

export interface ChapterRecord {
  id: string;
  story_id: string;
  status: ChapterStatus;
}

export interface CollectionRecord {
  id: string;
  owner_id: string;
  is_private: boolean;
}

export interface CommentRecord {
  id: string;
  user_id: string;
}

export interface RequestRecord {
  id: string;
  from_user_id: string;
}

export interface TargetUser {
  id: string;
  role: UserRole;
}

export function isStaff(viewer: MaybeViewer): boolean {
  return viewer?.role === "admin" || viewer?.role === "moderator";
}

export function isAdmin(viewer: MaybeViewer): boolean {
  return viewer?.role === "admin";
}

// Заблокированный пользователь не пишет ничего. Сейчас в коде и в RLS такой проверки нет.
export function isActive(viewer: MaybeViewer): boolean {
  return viewer !== null && viewer.status === "active";
}

function isOwner(viewer: MaybeViewer, ownerId: string): boolean {
  return viewer !== null && viewer.id === ownerId;
}

// Опубликована, не в корзине, видимость public или unlisted (по ссылке).
// В списках unlisted не показываем, это решается на уровне запроса.
export function isStoryPubliclyVisible(story: StoryRecord): boolean {
  if (story.deleted_at) return false;
  if (story.status !== "published") return false;
  return story.visibility === "public" || story.visibility === "unlisted";
}

// История: видна опубликованная, либо автору, либо staff.
export function canViewStory(viewer: MaybeViewer, story: StoryRecord): boolean {
  if (isStoryPubliclyVisible(story)) return true;
  return isOwner(viewer, story.author_id) || isStaff(viewer);
}

// Глава: опубликована и её история видна, либо автору истории, либо staff.
export function canViewChapter(viewer: MaybeViewer, chapter: ChapterRecord, story: StoryRecord): boolean {
  if (chapter.story_id !== story.id) return false;
  if (isOwner(viewer, story.author_id) || isStaff(viewer)) return true;
  return chapter.status === "published" && isStoryPubliclyVisible(story);
}

// Редактирование истории и её глав: автор или staff (как было в RLS).
export function canEditStory(viewer: MaybeViewer, story: StoryRecord): boolean {
  return isActive(viewer) && (isOwner(viewer, story.author_id) || isStaff(viewer));
}

export function canEditChapter(viewer: MaybeViewer, chapter: ChapterRecord, story: StoryRecord): boolean {
  if (chapter.story_id !== story.id) return false;
  return isActive(viewer) && (isOwner(viewer, story.author_id) || isStaff(viewer));
}

// Добавлять главы может только автор истории. Staff здесь не входит, как и в RLS.
export function canAddChapter(viewer: MaybeViewer, story: StoryRecord): boolean {
  return isActive(viewer) && isOwner(viewer, story.author_id);
}

// Удалить (мягко) историю может только автор.
export function canDeleteStory(viewer: MaybeViewer, story: StoryRecord): boolean {
  return isActive(viewer) && isOwner(viewer, story.author_id);
}

// Отправить на проверку можно только черновик.
export function canSubmitStoryForReview(viewer: MaybeViewer, story: StoryRecord): boolean {
  return isActive(viewer) && isOwner(viewer, story.author_id) && story.status === "draft";
}

export function canSubmitChapterForReview(viewer: MaybeViewer, chapter: ChapterRecord, story: StoryRecord): boolean {
  if (chapter.story_id !== story.id) return false;
  return isActive(viewer) && isOwner(viewer, story.author_id) && chapter.status === "draft";
}

// Комментарий и лайк: только к видимому контенту. Раньше RLS проверял только user_id.
export function canCommentOnChapter(viewer: MaybeViewer, chapter: ChapterRecord, story: StoryRecord): boolean {
  return isActive(viewer) && canViewChapter(viewer, chapter, story);
}

export function canCommentOnStory(viewer: MaybeViewer, story: StoryRecord): boolean {
  return isActive(viewer) && canViewStory(viewer, story);
}

// Лайк комментария: комментарий должен быть виден (его глава или история).
export function canLikeComment(viewer: MaybeViewer, parentVisible: boolean): boolean {
  return isActive(viewer) && parentVisible;
}

export function canEditComment(viewer: MaybeViewer, comment: CommentRecord): boolean {
  return isActive(viewer) && (isOwner(viewer, comment.user_id) || isStaff(viewer));
}

// Подборки: приватная видна владельцу и staff, публичная — всем.
export function canViewCollection(viewer: MaybeViewer, collection: CollectionRecord): boolean {
  if (!collection.is_private) return true;
  return isOwner(viewer, collection.owner_id) || isStaff(viewer);
}

export function canManageCollection(viewer: MaybeViewer, collection: CollectionRecord): boolean {
  return isActive(viewer) && (isOwner(viewer, collection.owner_id) || isStaff(viewer));
}

// Сохранить чужую подборку можно только если она видна.
export function canSaveCollection(viewer: MaybeViewer, collection: CollectionRecord): boolean {
  return isActive(viewer) && canViewCollection(viewer, collection);
}

export function canCreateCollection(viewer: MaybeViewer): boolean {
  return isActive(viewer);
}

// Запрос сообщества: закрыть может только тот, кто его создал.
export function canCloseRequest(viewer: MaybeViewer, request: RequestRecord): boolean {
  return isActive(viewer) && isOwner(viewer, request.from_user_id);
}

// Ответ на запрос можно привязать только к своей истории.
export function canLinkStoryToRequest(viewer: MaybeViewer, story: StoryRecord): boolean {
  return isActive(viewer) && isOwner(viewer, story.author_id);
}

// Профиль меняет только сам пользователь. Роль и статус меняются только через админские проверки ниже.
export function canEditOwnProfile(viewer: MaybeViewer, profileId: string): boolean {
  return isActive(viewer) && isOwner(viewer, profileId);
}

// Обращение к администрации (чат поддержки). Заблокированный пользователь может писать
// в свой тред, чтобы объяснить блокировку. Staff отвечает в любой тред, но только будучи активным.
export function canSendAdminChatMessage(viewer: MaybeViewer, threadUserId: string): boolean {
  if (viewer === null) return false;
  if (isStaff(viewer)) return isActive(viewer);
  return viewer.id === threadUserId;
}

// Жалоба на комментарий. Может любой вошедший, в том числе заблокированный.
// Своё жаловаться нельзя. Комментарий должен быть виден (parentVisible считает вызывающий код).
export function canReportComment(viewer: MaybeViewer, comment: CommentRecord, parentVisible: boolean): boolean {
  if (viewer === null) return false;
  if (viewer.id === comment.user_id) return false;
  return parentVisible;
}

// --- Админка ---

// Разбирать жалобы и скрывать комментарии: staff. Решение принимает администратор.
export function canReviewReports(viewer: MaybeViewer): boolean {
  return canAccessAdmin(viewer);
}

export function canHideComment(viewer: MaybeViewer): boolean {
  return canAccessAdmin(viewer);
}

export function canAccessAdmin(viewer: MaybeViewer): boolean {
  return isActive(viewer) && isStaff(viewer);
}

// Роли (включая создание модераторов) меняет только admin.
export function canChangeRole(viewer: MaybeViewer): boolean {
  return isActive(viewer) && isAdmin(viewer);
}

// Модератор не может менять администратора. Это решение владельца проекта.
function canActOnTarget(actor: MaybeViewer, target: TargetUser): boolean {
  if (target.role === "admin" && !isAdmin(actor)) return false;
  return true;
}

// Статус (блокировка) пользователя: staff, не себе, и не администратора без прав администратора.
export function canChangeUserStatus(actor: MaybeViewer, target: TargetUser): boolean {
  if (!canAccessAdmin(actor)) return false;
  if (actor?.id === target.id) return false;
  return canActOnTarget(actor, target);
}

// Отметка «проверенный» — то же ограничение, что и у статуса.
export function canVerifyUser(actor: MaybeViewer, target: TargetUser): boolean {
  if (!canAccessAdmin(actor)) return false;
  return canActOnTarget(actor, target);
}
