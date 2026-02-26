/**
 * sendgrid.js
 * Thin SendGrid wrapper — pure, no Firebase dependencies.
 * All email functions import from here, never @sendgrid/mail directly.
 *
 * Requires env var: SENDGRID_API_KEY
 * Set via: firebase functions:config:set sendgrid.api_key="SG.xxx"
 * Or in functions/.env for local dev (Firebase Functions v2)
 *
 * File location: functions/src/lib/sendgrid.js
 */

const sgMail = require("@sendgrid/mail");

// ── Init ──────────────────────────────────────────────────────────────────────
const API_KEY = process.env.SENDGRID_API_KEY;
if (API_KEY) {
  sgMail.setApiKey(API_KEY);
} else {
  console.warn("sendgrid.js: SENDGRID_API_KEY not set — emails will not send");
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@osintarena.com";
const FROM_NAME  = "OSINT Arena";

// ── Email Templates ───────────────────────────────────────────────────────────

/**
 * Generates the contest reminder email HTML.
 * @param {Object} params
 * @param {string} params.username
 * @param {string} params.contestTitle
 * @param {string} params.contestDescription
 * @param {string} params.startTimeFormatted  - Human readable: "Monday, March 3 at 18:00 UTC"
 * @param {string} params.contestUrl
 * @returns {string} HTML string
 */
function contestReminderTemplate({ username, contestTitle, contestDescription, startTimeFormatted, contestUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contest Reminder — OSINT Arena</title>
</head>
<body style="margin:0;padding:0;background:#0D0F12;font-family:'Inter',Arial,sans-serif;color:#E6EDF3;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0F12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#161B22;border:1px solid #30363D;border-radius:12px;overflow:hidden;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px;border-bottom:1px solid #30363D;">
              <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#00FF88;letter-spacing:2px;">OSINT ARENA</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#8B949E;font-size:14px;margin:0 0 8px;">Hey ${username},</p>
              <h1 style="font-size:24px;font-weight:700;color:#E6EDF3;margin:0 0 24px;line-height:1.3;">
                Contest starting in <span style="color:#00FF88;">48 hours</span>
              </h1>

              <!-- Contest Card -->
              <div style="background:#0D0F12;border:1px solid #30363D;border-left:3px solid #00FF88;border-radius:8px;padding:24px;margin:0 0 32px;">
                <h2 style="font-size:18px;font-weight:600;color:#E6EDF3;margin:0 0 8px;">${contestTitle}</h2>
                <p style="color:#8B949E;font-size:14px;margin:0 0 16px;line-height:1.6;">${contestDescription}</p>
                <p style="color:#8B949E;font-size:13px;margin:0;">
                  <span style="color:#00BFFF;">⏰ Starts:</span> ${startTimeFormatted}
                </p>
              </div>

              <a href="${contestUrl}"
                 style="display:inline-block;background:#00FF88;color:#0D0F12;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                View Contest →
              </a>

              <p style="color:#484F58;font-size:13px;margin:32px 0 0;line-height:1.6;">
                You're receiving this because you registered for this contest.<br>
                Make sure you're ready — submissions lock at end time automatically.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #30363D;">
              <p style="color:#484F58;font-size:12px;margin:0;">
                © ${new Date().getUTCFullYear()} OSINT Arena · 
                <a href="https://osintarena.com/unsubscribe" style="color:#484F58;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates broadcast email HTML.
 * @param {Object} params
 * @param {string} params.subject
 * @param {string} params.bodyHtml  - Admin-provided HTML body content
 * @returns {string} HTML string
 */
function broadcastTemplate({ subject, bodyHtml }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0D0F12;font-family:'Inter',Arial,sans-serif;color:#E6EDF3;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0F12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#161B22;border:1px solid #30363D;border-radius:12px;overflow:hidden;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px;border-bottom:1px solid #30363D;">
              <span style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#00FF88;letter-spacing:2px;">OSINT ARENA</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;line-height:1.7;font-size:15px;color:#E6EDF3;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #30363D;">
              <p style="color:#484F58;font-size:12px;margin:0;">
                © ${new Date().getUTCFullYear()} OSINT Arena · 
                <a href="https://osintarena.com/unsubscribe" style="color:#484F58;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Send functions ─────────────────────────────────────────────────────────────

/**
 * Sends a single email.
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.html
 * @returns {Promise<void>}
 */
async function sendEmail({ to, subject, html }) {
  if (!API_KEY) {
    console.warn(`sendEmail: skipping (no API key) — would send to ${to}: ${subject}`);
    return;
  }

  await sgMail.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    html,
  });
}

/**
 * Sends emails to multiple recipients in batches.
 * SendGrid recommends max 1000 recipients per request.
 * We use individual sends to respect unsubscribes per user.
 *
 * @param {Array<{email: string, username: string}>} recipients
 * @param {string} subject
 * @param {Function} templateFn - called with each recipient to generate HTML
 * @param {number} [batchDelay=100] - ms between batches to avoid rate limits
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function sendBulkEmails(recipients, subject, templateFn, batchDelay = 100) {
  const BATCH_SIZE = 50; // Send 50 at a time
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (recipient) => {
        try {
          await sendEmail({
            to: recipient.email,
            subject,
            html: templateFn(recipient),
          });
          sent++;
        } catch (err) {
          console.error(`sendBulkEmails: failed for ${recipient.email}`, err.message);
          failed++;
        }
      })
    );

    // Small delay between batches to avoid SendGrid rate limits
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  return { sent, failed };
}

module.exports = {
  sendEmail,
  sendBulkEmails,
  contestReminderTemplate,
  broadcastTemplate,
};