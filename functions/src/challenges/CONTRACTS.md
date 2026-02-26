# Cloud Functions API Contracts

## openChallenge

**Type:** HTTPS Callable  
**Client call:** `functions.httpsCallable("openChallenge")`

### Input
```json
{
  "challengeId": "string (required)"
}
```

### Output — Success
```json
{
  "success": true,
  "sessionId": "userId_challengeId",
  "openTimestamp": 1740000000000,
  "alreadySolved": false,
  "challengeMeta": {
    "title": "Find the registrar",
    "difficulty": "medium",
    "expectedTime": 180
  }
}
```

### Errors
| Code | Reason |
|------|--------|
| `unauthenticated` | User not logged in |
| `invalid-argument` | Missing or invalid challengeId |
| `not-found` | Challenge doesn't exist |
| `failed-precondition` | Challenge is inactive |

---

## submitAnswer

**Type:** HTTPS Callable  
**Client call:** `functions.httpsCallable("submitAnswer")`

### Input
```json
{
  "challengeId": "string (required)",
  "answer":      "string (required, max 500 chars)",
  "hintUsed":    "boolean (default: false)",
  "contestId":   "string | null (optional)"
}
```

### Output — Correct Answer
```json
{
  "correct": true,
  "alreadySolved": false,
  "eloChange": 42,
  "newElo": 842,
  "breakdown": {
    "baseElo": 25,
    "timeBonus": 1.8,
    "hintPenalty": 1.0,
    "attemptPenalty": 0.9
  },
  "streak": {
    "current": 7,
    "max": 14,
    "changed": true,
    "action": "incremented"
  },
  "timeTaken": 95,
  "message": "Correct! Well done."
}
```

### Output — Wrong Answer
```json
{
  "correct": false,
  "eloChange": -2,
  "newElo": 798,
  "attemptsInWindow": 2,
  "maxAttemptsInWindow": 5,
  "message": "Incorrect answer. Try again."
}
```

### Errors
| Code | Reason |
|------|--------|
| `unauthenticated` | User not logged in |
| `invalid-argument` | Missing answer or challengeId |
| `not-found` | Challenge or user not found |
| `failed-precondition` | No active session (openChallenge not called first) |
| `resource-exhausted` | Rate limit hit — includes retryAfterSeconds |

---

## Solve Flow (Full Sequence)

```
Client                          Cloud Functions               Firestore
  │                                    │                          │
  ├─ openChallenge(challengeId) ───────►│                          │
  │                                    ├─ read challenges/id ─────►│
  │                                    ├─ write activeSessions/ ──►│
  │◄─ { sessionId, openTimestamp } ────┤                          │
  │                                    │                          │
  │  [user works on challenge]         │                          │
  │                                    │                          │
  ├─ submitAnswer(challengeId, ans) ───►│                          │
  │                                    ├─ read activeSessions/ ───►│
  │                                    ├─ read challenges/ ────────►│
  │                                    ├─ read submissions/ ───────►│  (rate limit + wrong count)
  │                                    ├─ read users/ ─────────────►│
  │                                    ├─ runAntiCheatChecks()      │
  │                                    ├─ verifyAnswer()            │
  │                                    ├─ calculateEloGain()        │
  │                                    ├─ calculateStreak()         │
  │                                    ├─ incrementHeatmapDay()     │
  │                                    ├─ batch.commit() ──────────►│  (atomic write)
  │                                    │    ├─ write submissions/   │
  │                                    │    ├─ update users/        │
  │                                    │    ├─ update challenges/   │
  │                                    │    ├─ set heatmap/         │
  │                                    │    └─ delete activeSessions/│
  │◄─ { correct, eloChange, streak } ──┤                          │
  │                                    ├─ checkAndAwardBadges() ───►│  (async, non-blocking)
```

---

## Notes for Frontend

1. Always call `openChallenge` before `submitAnswer` — no session = blocked submission.
2. On `resource-exhausted` error, read `error.details.retryAfterSeconds` to show a countdown timer.
3. `alreadySolved: true` in the response → show "Practice Mode" UI, no ELO display.
4. `breakdown` object → use this to animate the ELO gain breakdown modal.
5. Never display `timeTaken` to the user during the challenge — it would create gaming incentives.