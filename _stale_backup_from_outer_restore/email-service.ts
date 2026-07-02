import nodemailer from 'nodemailer';
import { log } from './logger.js';

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass || pass === 'xxxx xxxx xxxx xxxx') {
    throw new Error('Email not configured (SMTP_USER/SMTP_PASS missing in .env)');
  }
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const base = (process.env.RESET_URL_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
  const link = `${base}/#/reset-password?token=${token}`;
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"SRIM" <${from}>`,
    to,
    subject: 'Reset your SRIM password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a1628;color:#fff;border-radius:16px">
        <h2 style="margin:0 0 8px;color:#67e8f9">Reset your password</h2>
        <p style="color:#cbd5e1;margin:0 0 24px">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#67e8f9,#3b82f6);color:#000;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:12px;margin:24px 0 0">If you didn't request this, ignore this email — your password won't change.</p>
        <p style="color:#475569;font-size:11px;margin:8px 0 0;word-break:break-all">Or copy this link: ${link}</p>
      </div>
    `,
  });

  log.info(`[Email] Password reset sent to ${to}`);
}
