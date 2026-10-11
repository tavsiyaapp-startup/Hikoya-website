import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getStaffSession } from "@/server/auth/staff";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { sendMail, verifySmtp } from "@/server/auth/mailer";

// Staff-only mail diagnostics: open /api/admin/mail-test?to=someone@example.com
// while signed in to the admin panel. Better Auth's OTP/reset endpoints always
// answer {success:true} — even when no account has that email (then nothing
// is sent at all) or when SMTP fails — so this is the one place that shows
// what actually happens: whether the address belongs to an account, whether
// the SMTP login works, and what the mail server answered.
export async function GET(request: Request) {
  const result = await getStaffSession();
  if (result.status !== "staff") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const to = new URL(request.url).searchParams.get("to")?.trim().toLowerCase();
  if (!to) return NextResponse.json({ error: "add ?to=email@example.com" }, { status: 400 });

  const db = getDb();
  const [account] = await db
    .select({ username: profiles.username, email_verified: profiles.email_verified })
    .from(profiles)
    .where(eq(profiles.email, to))
    .limit(1);

  const report: Record<string, unknown> = {
    to,
    accountExists: Boolean(account),
    accountNote: account
      ? `аккаунт @${account.username} — коды входа/сброса на этот адрес отправляются`
      : "аккаунта с таким email нет — сайт НЕ отправляет на него коды сброса пароля",
    smtp: {
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? "465 (по умолчанию)",
      user: process.env.SMTP_USER ?? null,
      passwordSet: Boolean(process.env.SMTP_PASSWORD),
    },
  };

  try {
    await verifySmtp();
    report.smtpLogin = "ok";
  } catch (err) {
    report.smtpLogin = `ошибка: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(report, { status: 500 });
  }

  try {
    const info = await sendMail(
      to,
      "Проверка почты Hikoya",
      "Это тестовое письмо с сайта hikoya.org. Если вы его видите, отправка почты работает."
    );
    report.sent = { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response };
  } catch (err) {
    report.sent = `ошибка: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json(report, { status: 500 });
  }

  return NextResponse.json(report);
}
