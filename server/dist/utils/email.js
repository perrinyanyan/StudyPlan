import nodemailer from 'nodemailer';
const required = (name, def) => process.env[name] ?? def ?? '';
const transporter = nodemailer.createTransport({
    host: required('SMTP_HOST', 'smtp.qq.com'),
    port: Number(required('SMTP_PORT', '465')),
    secure: required('SMTP_SECURE', 'true') === 'true',
    auth: {
        user: required('SMTP_USER'),
        pass: required('SMTP_PASS'),
    },
});
export async function sendEmail({ to, subject, html }) {
    const from = required('EMAIL_FROM', 'Study Planner <no-reply@example.com>');
    return transporter.sendMail({ from, to, subject, html });
}
