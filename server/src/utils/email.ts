import nodemailer from 'nodemailer';

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

const required = (name: string, def?: string) => process.env[name] ?? def ?? '';

const transporter = nodemailer.createTransport({
  host: required('SMTP_HOST', 'smtp.qq.com'),
  port: Number(required('SMTP_PORT', '465')),
  secure: required('SMTP_SECURE', 'true') === 'true',
  auth: {
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
  },
});

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const from = required('EMAIL_FROM', 'Study Planner <no-reply@example.com>');
  return transporter.sendMail({ from, to, subject, html });
}
