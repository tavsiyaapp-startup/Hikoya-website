import "server-only";
import nodemailer from "nodemailer";

// mail.hikoya.org, confirmed from ISPmanager's mail client setup page.
// Port 465 (implicit TLS) rather than the plain port 25 — 25 is typically
// meant for unauthenticated server-to-server relay, and VPS hosts commonly
// block outbound 25 entirely to curb spam.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASSWORD must be set");
  }
  transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const from = process.env.SMTP_USER ?? "noreply@hikoya.org";
  await getTransporter().sendMail({ from: `Hikoya <${from}>`, to, subject, text });
}
