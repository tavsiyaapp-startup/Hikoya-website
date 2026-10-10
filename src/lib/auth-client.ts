"use client";

import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// Better Auth's browser client — used by the admin login form
// (src/app/admin-login/AdminLoginForm.tsx) and admin sign-out control.
// baseURL mirrors the one in src/server/auth/config.ts; both need to agree
// on the site's real origin for cookies/CSRF to line up.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL,
  plugins: [emailOTPClient()],
});
