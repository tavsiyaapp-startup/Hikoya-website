import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTelegramAuth, type TelegramAuthData } from "@/lib/telegram";

// The Telegram Login Widget POSTs the signed user payload here as JSON.
// Supabase Auth has no native Telegram provider, so we bridge it ourselves:
// verify the HMAC, find-or-create a user keyed by telegram_id, then have
// Supabase mint a magic-link and hand the browser off to /auth/confirm to
// redeem it (that's what actually sets the session cookies).
export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 501 });
  }

  const data = (await request.json()) as TelegramAuthData;
  const check = verifyTelegramAuth(data, botToken);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 401 });
  }

  const admin = createAdminClient();
  const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ");

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_id", data.id)
    .maybeSingle();

  let userId = existing?.id as string | undefined;

  if (!userId) {
    const syntheticEmail = `tg-${data.id}@telegram.hikoya.local`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { full_name: displayName, telegram_username: data.username },
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: "create_user_failed" }, { status: 500 });
    }
    userId = created.user.id;

    await admin
      .from("profiles")
      .update({
        telegram_id: data.id,
        display_name: displayName,
        avatar_url: data.photo_url ?? null,
      })
      .eq("id", userId);
  }

  const { data: userRow } = await admin.auth.admin.getUserById(userId);
  const email = userRow.user?.email;
  if (!email) {
    return NextResponse.json({ error: "no_email_on_record" }, { status: 500 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) {
    return NextResponse.json({ error: "link_failed" }, { status: 500 });
  }

  const confirmUrl = new URL("/auth/confirm", request.url);
  confirmUrl.searchParams.set("token_hash", link.properties.hashed_token);
  confirmUrl.searchParams.set("type", "magiclink");

  return NextResponse.json({ redirect: confirmUrl.toString() });
}
