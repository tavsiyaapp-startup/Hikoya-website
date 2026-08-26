import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeTelegramLogin } from "@/lib/telegram";

const TOKEN_TTL_MS = 10 * 60 * 1000;

// Polled by the client every couple seconds while it waits for the user to
// confirm in Telegram. Each token is single-use: once read as "confirmed"
// here, it's deleted immediately so a leaked poll response can't be replayed.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("telegram_login_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!row) return NextResponse.json({ status: "expired" });

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (row.status === "pending") {
    if (ageMs > TOKEN_TTL_MS) {
      await admin.from("telegram_login_tokens").delete().eq("token", token);
      return NextResponse.json({ status: "expired" });
    }
    return NextResponse.json({ status: "pending" });
  }

  if (row.status !== "confirmed" || !row.telegram_id) {
    await admin.from("telegram_login_tokens").delete().eq("token", token);
    return NextResponse.json({ status: "expired" });
  }

  const result = await completeTelegramLogin({
    telegramId: row.telegram_id,
    firstName: row.telegram_first_name ?? "",
    lastName: row.telegram_last_name,
    username: row.telegram_username,
    photoUrl: row.telegram_photo_url,
  });

  await admin.from("telegram_login_tokens").delete().eq("token", token);

  if ("error" in result) {
    return NextResponse.json({ status: "error" });
  }
  return NextResponse.json({ status: "confirmed", redirect: result.confirmPath });
}
