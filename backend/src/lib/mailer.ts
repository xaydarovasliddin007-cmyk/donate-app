import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

function isConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

/**
 * Sends a real email via SMTP once real credentials exist (see
 * backend/README.md "Email setup") — same "wired but needs credentials"
 * pattern as Telegram/Payme/Click. Until then, this logs the content at
 * info level instead of silently no-op'ing, so the email-verification flow
 * stays fully testable in dev without a real mailbox: read the code out of
 * the backend console.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!isConfigured()) {
    logger.info(
      { to: params.to, subject: params.subject, body: params.text },
      'SMTP not configured — email logged instead of sent (see backend/README.md "Email setup")',
    );
    return;
  }

  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  } catch (err) {
    logger.warn({ err, to: params.to }, 'Failed to send email');
  }
}
