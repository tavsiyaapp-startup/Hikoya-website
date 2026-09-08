// Shared between the home page's feed section and the "все истории" page
// (/all) it links out to, so both list exactly the same tabs in the same
// order and can't drift apart.
export const HOME_TABS = ["new", "forYou", "popular", "following"] as const;
export type HomeTab = (typeof HOME_TABS)[number];
