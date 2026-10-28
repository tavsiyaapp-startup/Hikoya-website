export const ROUTES = {
  home: "/",
  search: "/search",
  allStories: (tab: string) => `/all?tab=${tab}`,
  collections: "/collections",
  forum: "/muhokamalar",
  forumNew: "/muhokamalar/yangi",
  forumPost: (id: string) => `/muhokamalar/${id}`,
  create: "/create",
  library: "/library",
  chat: "/chat",
  admin: "/admin",
  adminLogin: "/admin-login",
  adminChats: (userId?: string) => (userId ? `/admin/chats?selected=${userId}` : "/admin/chats"),
  adminComments: "/admin/comments",
  adminReports: "/admin/reports",
  adminForum: "/admin/muhokamalar",
  adminUser: (id: string) => `/admin/users/${id}`,
  adminStory: (id: string) => `/admin/stories/${id}`,
  adminStoryDownload: (id: string) => `/api/admin/stories/${id}/download`,
  adminChapter: (storyId: string, chapterId: string) => `/admin/stories/${storyId}/chapters/${chapterId}`,
  onboarding: "/onboarding",
  login: "/login",
  resetPassword: "/auth/reset-password",
  setPassword: "/auth/set-password",
  author: (username: string) => `/author/${username}`,
  story: (slug: string) => `/story/${slug}`,
  chapter: (slug: string, chapterNum: number | string) => `/story/${slug}/${chapterNum}`,
  manage: (slug: string) => `/manage/${slug}`,
  collection: (id: string) => `/collections/${id}`,
  rules: "/rules",
  mission: "/mission",
  news: "/news",
  privacy: "/privacy",
  cookies: "/cookies",
  offer: "/offer",
} as const;

export const GUEST_READ_COOKIE = "hikoya_guest_reads";
export const DEFAULT_GUEST_FREE_CHAPTERS = 1;

// Upper bound on a single chapter, in words. A new or edited chapter over
// this isn't saved — the author is asked to move part of it to another
// chapter. Chapters already longer than this (saved before the limit) are
// left alone (see src/server/data/chapters.ts).
export const MAX_CHAPTER_WORDS = 6000;
