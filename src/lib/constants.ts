export const ROUTES = {
  home: "/",
  search: "/search",
  collections: "/collections",
  board: "/board",
  create: "/create",
  library: "/library",
  admin: "/admin",
  adminLogin: "/admin-login",
  adminStory: (id: string) => `/admin/stories/${id}`,
  adminChapter: (storyId: string, chapterId: string) => `/admin/stories/${storyId}/chapters/${chapterId}`,
  onboarding: "/onboarding",
  login: "/login",
  resetPassword: "/auth/reset-password",
  author: (username: string) => `/author/${username}`,
  story: (slug: string) => `/story/${slug}`,
  chapter: (slug: string, chapterNum: number | string) => `/story/${slug}/${chapterNum}`,
  manage: (slug: string) => `/manage/${slug}`,
  collection: (id: string) => `/collections/${id}`,
} as const;

export const GUEST_READ_COOKIE = "hikoya_guest_reads";
export const DEFAULT_GUEST_FREE_CHAPTERS = 1;
