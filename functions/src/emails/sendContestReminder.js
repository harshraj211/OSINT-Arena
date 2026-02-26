/**
 * sendContestReminder.js
 * Cloud Function — Scheduled (Cron)
 * Schedule: every 1 hour (checks for contests starting in ~48h)
 *
 * Logic:
 *  1. Find contests where startTime is between now+47h and now+49h
 *     AND reminderSent == false
 *  2. For each contest, fetch all registered participants' emails
 *  3. Send reminder email to each participant via SendGrid
 *  4. Mark contest.reminderSent = true so it never double-sends
 *
 * Note: We use reminderSent (boolean) not emailSentAt (null check)
 * because Firestore composite indexes don't handle null equality well.
 *
 * File location: functions/src/emails/sendContestReminder.js
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { sendBulkEmails, contestReminderTemplate } = require("../lib/sendgrid");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Check window: contests starting between 47h and 49h from now
const WINDOW_MIN_MS = 47 * 60 * 60 * 1000;
const WINDOW_MAX_MS = 49 * 60 * 60 * 1000;

module.exports = functions.pubsub
  .schedule("every 1 hours")
  .timeZone("UTC")
  .onRun(async (context) => {
    const nowMs = Date.now();
    const windowStart = nowMs + WINDOW_MIN_MS;
    const windowEnd   = nowMs + WINDOW_MAX_MS;

    console.log(`sendContestReminder: checking window ${new Date(windowStart).toISOString()} → ${new Date(windowEnd).toISOString()}`);

    // ── 1. Find eligible contests ─────────────────────────────────────────────
    const contestsSnap = await db
      .collection("contests")
      .where("reminderSent", "==", false)
      .where("startTime", ">=", windowStart)
      .where("startTime", "<=", windowEnd)
      .get();

    if (contestsSnap.empty) {
      console.log("sendContestReminder: no contests in window");
      return null;
    }

    console.log(`sendContestReminder: found ${contestsSnap.size} contest(s) to remind`);

    // ── 2. Process each contest ───────────────────────────────────────────────
    for (const contestDoc of contestsSnap.docs) {
      const contest = contestDoc.data();
      const contestId = contestDoc.id;

      // Guard: mark as sent FIRST (before sending) to prevent double-send
      // if the function crashes mid-way
      await contestDoc.ref.update({
        reminderSent: true,
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`sendContestReminder: processing "${contest.title}" (${contestId}), ${contest.participants?.length || 0} participants`);

      if (!contest.participants || contest.participants.length === 0) {
        console.log(`sendContestReminder: no participants for ${contestId}, skipping`);
        continue;
      }

      // ── 3. Fetch participant emails in batches (Firestore in[] max 30) ──────
      const participants = contest.participants; // array of userIds
      const recipients = [];

      // Firestore whereIn limit is 30 — chunk it
      const CHUNK_SIZE = 30;
      for (let i = 0; i < participants.length; i += CHUNK_SIZE) {
        const chunk = participants.slice(i, i + CHUNK_SIZE);
        const usersSnap = await db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get();

        usersSnap.docs.forEach((userDoc) => {
          const user = userDoc.data();
          if (user.email) {
            recipients.push({
              email: user.email,
              username: user.username || "Analyst",
            });
          }
        });
      }

      console.log(`sendContestReminder: sending to ${recipients.length} recipients`);

      // ── 4. Format start time for email ────────────────────────────────────
      const startDate = new Date(contest.startTime);
      const startTimeFormatted = startDate.toUTCString().replace(" GMT", " UTC");
      const contestUrl = `https://osintarena.com/contests/${contestId}`;

      // ── 5. Send emails ────────────────────────────────────────────────────
      const { sent, failed } = await sendBulkEmails(
        recipients,
        `⚡ Contest starts in 48 hours: ${contest.title}`,
        (recipient) => contestReminderTemplate({
          username: recipient.username,
          contestTitle: contest.title,
          contestDescription: contest.description || "",
          startTimeFormatted,
          contestUrl,
        })
      );

      console.log(`sendContestReminder: "${contest.title}" — sent: ${sent}, failed: ${failed}`);

      // ── 6. Log to adminLogs ───────────────────────────────────────────────
      await db.collection("adminLogs").add({
        type: "contest_reminder_sent",
        contestId,
        contestTitle: contest.title,
        recipientCount: recipients.length,
        sent,
        failed,
        executedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  });