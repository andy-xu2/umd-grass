import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'UMD Grass Rankings <noreply@umd-grass.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#16a34a;padding:32px 40px;text-align:center;">
            <span style="font-size:28px;">🏐</span>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">UMD Grass Rankings</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">UMD Grass Volleyball · <a href="${APP_URL}" style="color:#16a34a;text-decoration:none;">Open App</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buttonLink(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">${label}</a>`
}

// ─── Email senders ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const html = baseTemplate(
    'Reset your password',
    `<h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Reset your password</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p style="margin:0 0 24px;text-align:center;">${buttonLink(resetLink, 'Reset Password')}</p>
    <p style="margin:0;font-size:13px;color:#9ca3af;">If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>`,
  )

  return resend.emails.send({ from: FROM, to, subject: 'Reset your UMD Grass password', html })
}

