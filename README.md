# OSINT Arena

A competitive Open Source Intelligence (OSINT) challenge platform built with React, Firebase, and Cloud Functions.

## Project Structure

```
osint-arena/
├── frontend/          # React web application
├── functions/         # Firebase Cloud Functions
├── firestore.rules    # Firestore security rules
├── storage.rules      # Cloud Storage security rules
└── firebase.json      # Firebase configuration
```

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Functions
```bash
cd functions
npm install
npm run deploy
```

## Environment Setup

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=http://localhost:5000
```

### Functions (.env)
```
SENDGRID_API_KEY=
FIREBASE_PROJECT_ID=
```

## Features

- **Challenge System**: Solve OSINT challenges and earn ELO points
- **Leaderboard**: Global, weekly, and monthly rankings
- **Contests**: Time-limited competitive events
- **User Profiles**: Track stats, badges, and certifications
- **Admin Panel**: Manage challenges, users, and contests
- **Anti-Cheat**: Detect suspicious activity patterns

## Tech Stack

- Frontend: React 18, Vite, React Router
- Backend: Firebase Cloud Functions, Firestore
- Authentication: Firebase Auth
- Email: SendGrid
- Deployment: Firebase Hosting & Cloud Functions

## License

MIT
