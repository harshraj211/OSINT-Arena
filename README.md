# PwnGrid

A competitive OSINT (Open-Source Intelligence) training platform with ELO rankings, timed contests, streak tracking, and verifiable certifications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 + React Router 6 |
| Backend | Firebase Cloud Functions (Node 20, v1 + v2 SDK) |
| Database | Cloud Firestore |
| Auth | Firebase Authentication |
| Email | SendGrid |
| Payments | Razorpay |
| Hosting | Firebase Hosting |

---

## Project Structure

```
osint-arena/
├── firebase.json               # Firebase project config
├── .firebaserc                 # Project aliases (default / staging)
├── .firebaseignore             # Excludes frontend/ from functions deploy
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Composite indexes
│
├── frontend/                   # React app
│   ├── src/
│   │   ├── firebase/
│   │   │   └── config.js       # Firebase init + emulator connect
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Global auth state + syncClaims
│   │   ├── routes/
│   │   │   ├── AppRouter.jsx
│   │   │   ├── PrivateRoute.jsx
│   │   │   ├── ProRoute.jsx
│   │   │   └── AdminRoute.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Challenges.jsx
│   │   │   ├── ChallengeSolve.jsx
│   │   │   ├── Contests.jsx
│   │   │   ├── ContestSolve.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Pricing.jsx
│   │   │   ├── CertVerify.jsx
│   │   │   ├── Login.jsx / Register.jsx / ...
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.jsx
│   │   │       ├── AdminUsers.jsx
│   │   │       └── AdminFlags.jsx
│   │   ├── components/
│   │   │   └── layout/  Navbar, Footer, PageWrapper, AdminLayout
│   │   └── styles/
│   │       ├── theme.css       # CSS variables
│   │       ├── global.css      # Resets
│   │       └── scanline.css    # CRT scanline overlay
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example            # Copy → .env and fill in values
│
└── functions/
    ├── src/
    │   ├── index.js             # Entry point — exports all functions
    │   ├── auth/
    │   │   ├── onUserCreated.js     # Auth trigger — creates user profile
    │   │   └── setCustomClaims.js   # Callable — syncs plan → JWT claims
    │   ├── challenges/
    │   │   ├── openChallenge.js
    │   │   ├── submitAnswer.js
    │   │   └── rotateWeeklyFreeChallenge.js
    │   ├── contests/
    │   │   ├── registerForContest.js
    │   │   ├── submitContestAnswer.js
    │   │   └── finalizeContest.js
    │   ├── certifications/
    │   │   └── checkCertEligibility.js
    │   ├── payments/
    │   │   └── razorpayWebhook.js
    │   ├── leaderboard/
    │   │   ├── resetWeeklyElo.js
    │   │   └── resetMonthlyElo.js
    │   ├── emails/
    │   │   ├── sendContestReminder.js
    │   │   └── sendBroadcast.js
    │   ├── admin/
    │   │   ├── adjustElo.js
    │   │   ├── resolveFlag.js
    │   │   └── getAnalytics.js
    │   └── lib/
    │       ├── calculateElo.js
    │       ├── calculateStreak.js
    │       ├── normalizeAnswer.js
    │       ├── hashAnswer.js
    │       ├── antiCheat.js
    │       ├── heatmap.js
    │       └── sendgrid.js
    └── package.json
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (Blaze plan required for Cloud Functions)

### 1. Clone and install

```bash
git clone https://github.com/your-username/osint-arena.git
cd osint-arena

# Install frontend deps
cd frontend && npm install && cd ..

# Install functions deps
cd functions && npm install && cd ..
```

### 2. Configure environment variables

```bash
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and fill in your Firebase project values from  
**Firebase Console → Project Settings → General → Your apps → Web app**.

```bash
cp functions/.env.example functions/.env
```

Open `functions/.env` and add your SendGrid API key and Razorpay secret.

### 3. Connect to your Firebase project

```bash
firebase login
firebase use default   # uses project ID from .firebaserc
```

Edit `.firebaserc` and replace `your-firebase-project-id` with your actual project ID.

### 4. Set Firebase secrets (Cloud Functions)

```bash
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

### 5. Run with emulators (recommended for local dev)

```bash
# Terminal 1 — start Firebase emulators
firebase emulators:start --only auth,firestore,functions

# Terminal 2 — start frontend dev server connected to emulators
cd frontend
npm run emulate    # sets VITE_USE_EMULATOR=true automatically
```

Emulator UI available at: http://localhost:4000

### 6. Run frontend against production Firebase

```bash
cd frontend
npm run dev        # connects to production Firebase
```

---

## Deployment

### Deploy everything

```bash
cd frontend && npm run build && cd ..
firebase deploy
```

### Deploy individual services

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions:submitAnswer   # single function
```

### First deploy checklist

- [ ] `.firebaserc` updated with real project ID
- [ ] `frontend/.env` filled in with Firebase config
- [ ] Firebase secrets set (`SENDGRID_API_KEY`, `RAZORPAY_WEBHOOK_SECRET`)
- [ ] Firebase Blaze plan enabled (required for Cloud Functions)
- [ ] Cloud Scheduler API enabled in GCP console (for scheduled functions)
- [ ] Razorpay webhook URL configured in Razorpay Dashboard:
      `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/razorpayWebhook`
- [ ] SendGrid sender domain authenticated
- [ ] Firestore TTL policy created for `activeSessions` collection (24h on `expiresAt`)

---

## Monetisation Model

| Feature | Free | Pro (₹499/mo · ₹3999/yr) |
|---|---|---|
| Easy challenges | ✓ All | ✓ All |
| Medium challenges | 30% | ✓ All |
| Hard challenges | 1 free/week | ✓ All |
| Weekly contests | — | ✓ |
| Certifications | Recruit only | ✓ All tiers |
| Advanced analytics | — | ✓ |
| Streak freezes | — | 2/month |

---

## ELO Tiers

| Tier | ELO Range |
|---|---|
| Recruit | 0 – 199 |
| Analyst | 200 – 499 |
| Agent | 500 – 999 |
| Operator | 1000 – 1999 |
| Elite | 2000 – 3999 |
| Phantom | 4000+ |

New users start at **500 ELO (Agent)**.

---

## Environment Variables Reference

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics (optional) |
| `VITE_FIREBASE_REGION` | Functions region (default: `us-central1`) |
| `VITE_RAZORPAY_KEY_ID` | Razorpay publishable key |
| `VITE_USE_EMULATOR` | `true` to use local emulators |

### `functions/.env` (via Firebase Secrets)

| Secret | Description |
|---|---|
| `SENDGRID_API_KEY` | SendGrid API key |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signing secret |

---

## Firestore Collections

| Collection | Description |
|---|---|
| `users/{uid}` | Private user profiles |
| `publicProfiles/{uid}` | Public leaderboard data |
| `challenges/{id}` | Challenge docs (answerHash never sent to client) |
| `submissions/{id}` | All answer submissions |
| `activeSessions/{id}` | Open challenge sessions (TTL 24h) |
| `contests/{id}` | Contest metadata |
| `contests/{id}/participants/{uid}` | Per-contest participant state |
| `contestSubmissions/{id}` | Contest answer submissions |
| `certifications/{certId}` | Issued certificates (public read) |
| `payments/{paymentId}` | Razorpay payment records |
| `flags/{id}` | Anti-cheat + user reports |
| `heatmap/{uid}/years/{year}` | Daily solve heatmap data |
| `config/weeklyFreeChallenge` | This week's free hard challenge |
| `config/weeklyFreeHistory` | Last 4 weekly free picks |
| `adminLogs/{id}` | Admin action audit log |