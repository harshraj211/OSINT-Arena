/**
 * razorpayWebhook.js
 * HTTP endpoint — receives Razorpay payment webhooks.
 * NOT a callable — this is a raw HTTPS function that Razorpay POSTs to.
 *
 * Endpoint URL (set in Razorpay Dashboard → Webhooks):
 *   https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 *
 * Handles events:
 *   payment.captured   → activate Pro subscription
 *   subscription.charged → renew Pro (if using Razorpay Subscriptions)
 *   payment.failed     → log failure, no action needed on our side
 *
 * Security:
 *   - Verifies X-Razorpay-Signature HMAC-SHA256 header against raw body
 *   - Webhook secret stored in Firebase Secret Manager as RAZORPAY_WEBHOOK_SECRET
 *   - Idempotent: uses paymentId as Firestore doc ID to prevent double-processing
 *
 * Firestore writes on success:
 *   users/{uid}.plan = "pro"
 *   users/{uid}.proSince = serverTimestamp()
 *   users/{uid}.proExpiresAt = +30 or +365 days depending on billing period
 *   payments/{paymentId} = full payment record
 *
 * Also calls setCustomClaims to update the user's JWT so isPro is available
 * client-side immediately (via token refresh).
 *
 * File location: functions/src/payments/razorpayWebhook.js
 */

"use strict";

const { onRequest }           = require("firebase-functions/v2/https");
const { defineSecret }        = require("firebase-functions/params");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth }             = require("firebase-admin/auth");
const crypto                  = require("crypto");

const db   = getFirestore();
const auth = getAuth();

// Secret stored in Firebase Secret Manager
// Deploy with: firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");

// Subscription durations
const BILLING_DURATIONS = {
  monthly: 30,
  yearly:  365,
};

exports.razorpayWebhook = onRequest(
  {
    secrets: [RAZORPAY_WEBHOOK_SECRET],
    // Raw body needed for signature verification — do NOT use express json() middleware
  },
  async (req, res) => {
    // ── Only accept POST ──────────────────────────────────────────────────
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ── Verify Razorpay signature ─────────────────────────────────────────
    const receivedSig = req.headers["x-razorpay-signature"];
    if (!receivedSig) {
      console.warn("razorpayWebhook: missing signature header");
      res.status(400).send("Missing signature");
      return;
    }

    const secret = RAZORPAY_WEBHOOK_SECRET.value();
    const rawBody = req.rawBody || JSON.stringify(req.body); // Firebase provides rawBody

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (!crypto.timingSafeEqual(
      Buffer.from(receivedSig, "hex"),
      Buffer.from(expectedSig, "hex")
    )) {
      console.warn("razorpayWebhook: signature mismatch");
      res.status(400).send("Invalid signature");
      return;
    }

    // ── Parse event ───────────────────────────────────────────────────────
    const event = req.body;
    const eventType = event?.event;

    console.log(`razorpayWebhook: received event ${eventType}`);

    try {
      switch (eventType) {
        case "payment.captured":
          await handlePaymentCaptured(event.payload.payment.entity);
          break;

        case "subscription.charged":
          await handleSubscriptionCharged(event.payload);
          break;

        case "payment.failed":
          await handlePaymentFailed(event.payload.payment.entity);
          break;

        default:
          // Unhandled event type — acknowledge and ignore
          console.log(`razorpayWebhook: unhandled event type: ${eventType}`);
      }

      // Always return 200 so Razorpay doesn't retry
      res.status(200).json({ received: true });

    } catch (err) {
      console.error("razorpayWebhook: processing error", err);
      // Return 500 so Razorpay retries — but only for unexpected errors,
      // not for business logic failures like "user not found"
      res.status(500).json({ error: "Internal processing error" });
    }
  }
);

// ── Handle payment.captured ───────────────────────────────────────────────────
async function handlePaymentCaptured(payment) {
  const paymentId = payment.id;
  const email     = payment.email;
  const notes     = payment.notes || {};
  const billing   = notes.billing || "monthly"; // passed from frontend checkout options

  // ── Idempotency check ─────────────────────────────────────────────────
  const paymentRef = db.collection("payments").doc(paymentId);
  const existing   = await paymentRef.get();
  if (existing.exists) {
    console.log(`razorpayWebhook: payment ${paymentId} already processed — skipping`);
    return;
  }

  // ── Find user by email ────────────────────────────────────────────────
  let uid;
  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
  } catch (err) {
    console.error(`razorpayWebhook: no Firebase user for email ${email}`, err);
    // Store the payment anyway for manual reconciliation
    await paymentRef.set({
      paymentId,
      email,
      amount:    payment.amount,
      currency:  payment.currency,
      billing,
      status:    "captured_no_user",
      createdAt: Timestamp.now(),
      rawPayment: payment,
    });
    return;
  }

  // ── Compute expiry ────────────────────────────────────────────────────
  const daysToAdd   = BILLING_DURATIONS[billing] || 30;
  const proExpiresAt = new Date();
  proExpiresAt.setDate(proExpiresAt.getDate() + daysToAdd);

  // ── Atomic batch write ────────────────────────────────────────────────
  const batch = db.batch();

  // Update user profile
  const userRef = db.collection("users").doc(uid);
  batch.update(userRef, {
    plan:           "pro",
    proSince:       FieldValue.serverTimestamp(),
    proExpiresAt:   Timestamp.fromDate(proExpiresAt),
    billingPeriod:  billing,
    lastPaymentId:  paymentId,
  });

  // Also update publicProfiles so leaderboard shows PRO badge
  const pubRef = db.collection("publicProfiles").doc(uid);
  batch.update(pubRef, { plan: "pro" });

  // Record the payment
  batch.set(paymentRef, {
    paymentId,
    uid,
    email,
    amount:       payment.amount,   // in paise
    currency:     payment.currency,
    billing,
    status:       "captured",
    proExpiresAt: Timestamp.fromDate(proExpiresAt),
    createdAt:    Timestamp.now(),
    rawPayment:   payment,
  });

  await batch.commit();

  // ── Update Firebase Auth custom claims ───────────────────────────────
  // This makes isPro available in the JWT token immediately after next refresh
  await auth.setCustomUserClaims(uid, {
    plan:  "pro",
    proExpiresAt: proExpiresAt.toISOString(),
  });

  console.log(`razorpayWebhook: activated Pro for uid=${uid} (${billing}, expires ${proExpiresAt.toISOString()})`);
}

// ── Handle subscription.charged (Razorpay Subscriptions API) ─────────────────
async function handleSubscriptionCharged(payload) {
  const payment        = payload.payment?.entity;
  const subscription   = payload.subscription?.entity;
  if (!payment || !subscription) return;

  // Re-use the captured handler — it's the same flow
  await handlePaymentCaptured({
    ...payment,
    notes: { billing: subscription.plan_id?.includes("yearly") ? "yearly" : "monthly" },
  });
}

// ── Handle payment.failed ─────────────────────────────────────────────────────
async function handlePaymentFailed(payment) {
  // Log for visibility — no user action needed
  await db.collection("paymentFailures").doc(payment.id).set({
    paymentId:    payment.id,
    email:        payment.email,
    amount:       payment.amount,
    errorCode:    payment.error_code,
    errorDesc:    payment.error_description,
    errorReason:  payment.error_reason,
    createdAt:    Timestamp.now(),
  });

  console.log(`razorpayWebhook: payment failed — ${payment.id} (${payment.error_code}: ${payment.error_description})`);
}