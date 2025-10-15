import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 2525),
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
});

export async function notifyError(subject: string, message: string) {
  const from = process.env.EMAIL_FROM || 'noreply@example.com';
  const to = process.env.EMAIL_TO;
  if (!to) {
    console.error('[ALERT]', subject, message);
    return;
  }
  await transporter.sendMail({ from, to, subject, text: message });
}
