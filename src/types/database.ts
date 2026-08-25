// Hand-written types mirroring supabase/migrations/0001_schema.sql.
// Regenerate against a live project later with `supabase gen types typescript`.

export type UserRole = "reader" | "author" | "moderator" | "admin";
export type UserStatus = "active" | "blocked";
export type StoryStatus = "draft" | "published" | "unlisted" | "pending_review";
export type StoryVisibility = "public" | "unlisted" | "draft";
export type AgeRating = "0+" | "12+" | "16+" | "18+";
export type ContentLanguage = "ru" | "uz";
export type ChapterStatus = "draft" | "published" | "pending_review";
export type TagCategory = "genre" | "relationship" | "warning" | "style" | "age_rating";
export type CollectionOwnerType = "user" | "author" | "moderator";
export type RequestStatus = "open" | "in_progress" | "fulfilled";
export type RequestResponseStatus = "proposed" | "accepted" | "declined";
export type ReportTargetType = "story" | "chapter" | "comment";
export type ReportStatus = "open" | "reviewed" | "resolved";
export type LikeTargetType = "story" | "chapter" | "comment";

export interface Profile {
  id: string; // references auth.users.id
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  status: UserStatus;
  locale_pref: ContentLanguage;
  interests: string[];
  telegram_id: number | null;
  onboarded_at: string | null;
  created_at: string;
}

export interface Story {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string | null;
  genre: string;
  language: ContentLanguage;
  age_rating: AgeRating;
  relationship_type: string | null;
  style: string | null;
  status: StoryStatus;
  visibility: StoryVisibility;
  announce: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  rejection_reason: string | null;
}

export interface Chapter {
  id: string;
  story_id: string;
  order_index: number;
  title: string;
  content: string;
  word_count: number;
  status: ChapterStatus;
  is_free: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  rejection_reason: string | null;
}

export interface Comment {
  id: string;
  chapter_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  like_count: number;
  created_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  target_type: LikeTargetType;
  target_id: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  story_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  author_id: string;
  created_at: string;
}

export interface ReadingProgress {
  user_id: string;
  story_id: string;
  chapter_id: string;
  percent: number;
  updated_at: string;
}

export interface Tag {
  id: string;
  category: TagCategory;
  label_ru: string;
  label_uz: string;
}

export interface StoryTag {
  story_id: string;
  tag_id: string;
}

export interface Collection {
  id: string;
  owner_id: string;
  owner_type: CollectionOwnerType;
  title: string;
  description: string | null;
  is_featured: boolean;
  is_private: boolean;
  created_at: string;
}

export interface CollectionItem {
  collection_id: string;
  story_id: string;
  position: number;
}

export interface Achievement {
  id: string;
  code: string;
  title_ru: string;
  title_uz: string;
  description_ru: string;
  description_uz: string;
  metric: "story_count" | "follower_count" | "total_likes" | "publish_streak_weeks";
  threshold: number;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  earned_at: string;
}

export interface Request {
  id: string;
  target_author_id: string | null;
  from_user_id: string;
  title: string;
  text: string;
  tags: string[];
  status: RequestStatus;
  story_id: string | null;
  created_at: string;
}

export interface RequestResponse {
  id: string;
  request_id: string;
  author_id: string;
  text: string;
  status: RequestResponseStatus;
  story_id: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface PlatformSettings {
  id: number; // singleton row, always 1
  guest_free_chapters: number;
  enabled_locales: ContentLanguage[];
  comments_require_approval: boolean;
  new_story_requires_review: boolean;
}
