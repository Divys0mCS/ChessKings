# ♟️ chesskings

A real-time chess web application with multiplayer gameplay, ratings, leaderboards, AI analysis, and more.

## 🌟 Overview

**chesskings** is a full-stack chess platform featuring:

- ♟️ Real-time multiplayer using Socket.IO
- 🔐 Firebase Authentication (optional demo mode)
- 🏆 Player ratings and leaderboard powered by Firestore
- 🤖 AI analysis using Stockfish.js
- 📱 Responsive design for mobile and desktop
- 🌙 Modern dark theme with micro-animations
- ⌨️ Keyboard navigation and touch-friendly chessboard
- 📊 Post-game analysis with FEN input and principal variation (PV) lines

## 📦 Development Progress

| Phase | Status | Details |
|---|---|---|
| Phase 1–4 | ✅ Complete | All base tasks verified |
| Phase 5 | ✅ Complete | All 10 subtasks (28–35) implemented |
| TypeScript | ✅ Passing | `tsc --noEmit` exits with code 0 |
| Production Build | ✅ Passing | Next.js 16.4.6, Turbopack, 7 routes prerendered |
| Git Commit | ✅ Complete | Commit `0be279d` |
| Git Push | ⚠️ Pending | Local commit; cloud sandbox authentication limitation |

## 🛠️ Prerequisites

Make sure you have the following installed or configured:

| Requirement | Version / Details |
|---|---|
| Node.js | >= 20.11.0 |
| npm / pnpm / bun | Any supported package manager |
| Firebase | Firebase project (optional for demo mode) |
| Render | Account for Socket.IO server deployment |
| Vercel | Account for frontend deployment |

## 🔥 Environment Variables

### Required for Production

Configure the following variables in your Vercel project:

| Variable | Example / Source | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `chesskings-7c740.firebaseapp.com` | Firebase authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `chesskings-7c740` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console | Firebase Web App ID |
| `NEXT_PUBLIC_SOCKET_URL` | `https://chesskings.onrender.com` | Socket.IO server URL |

Configure this variable on Render:

| Variable | Value | Description |
|---|---|---|
| `CLIENT_ORIGIN` | `https://chesskings.onrender.com` | Allowed client origin for Socket.IO |

### 🔐 Optional Server-Side Variables

| Variable | Default / Example | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON | Server-side Firebase operations |
| `SOCKET_PORT` | `4001` | Socket.IO server port |
| `ALLOW_DEV_AUTH` | `1` | Enables demo authentication tokens |
| `NEXT_PUBLIC_DEMO_MODE` | `1` | Forces demo mode without Firebase |

**Security note:** Never commit Firebase service account credentials or private keys to GitHub.

## 📋 Configuring Environment Variables

### Vercel

1. Open your Vercel Dashboard.
2. Select your chesskings project.
3. Navigate to **Settings → Environment Variables**.
4. Add all six `NEXT_PUBLIC_FIREBASE_*` variables.
5. Add `NEXT_PUBLIC_SOCKET_URL`.
6. Save the changes.
7. Redeploy the application.

### Render

1. Open your Render Dashboard.
2. Select your Socket.IO service.
3. Navigate to **Settings → Environment**.
4. Add:

   ```env
   CLIENT_ORIGIN=https://chesskings.onrender.com
   ALLOW_DEV_AUTH=1
   ```

5. Save and restart the service.

`ALLOW_DEV_AUTH=1` is optional and should only be enabled when demo authentication is intentionally required.

## 🏃 Running Locally

### 1. Clone the Repository

```bash
git clone https://github.com/Divys0mCS/chesskings.git

cd chesskings
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development

Start the web application, Socket.IO server, and proxy concurrently:

```bash
npm run dev
```

### Development Commands

**Web application only:**

```bash
npm run dev:web
```

Runs at:

```text
http://localhost:3001
```

**Socket.IO server only:**

```bash
npm run dev:socket
```

Runs at:

```text
http://localhost:4001
```

### 🎮 Demo Mode (Without Firebase)

You can run chesskings without configuring Firebase:

```bash
ALLOW_DEV_AUTH=1 NEXT_PUBLIC_DEMO_MODE=1 npm run dev
```

Sign in as a guest or use a demo token:

```text
dev:<uid>:<name>
```

Example:

```text
dev:12345:Alice
```

## 🧪 Type Checking & Production Build

### TypeScript Check

```bash
npm run typecheck
```

Expected result:

```text
tsc --noEmit
Exit code: 0
```

### Production Build

```bash
npm run build
```

Expected result:

- Next.js 16.4.6
- Turbopack build
- All 7 routes prerendered successfully
- No TypeScript build errors

## 🐋 Architecture

### Technology Stack

| Component | Technology | Location |
|---|---|---|
| Frontend | Next.js 16.4.6, React 19, Tailwind CSS | `src/`, `app/` |
| Real-time Server | Node.js, Socket.IO 4.8.4 | `server/index.ts` |
| Authentication | Firebase SDK 13.4.0 | `src/lib/firebase.ts` |
| Database | Cloud Firestore | Firebase |
| AI Analysis | Stockfish.js Web Worker | `src/lib/engine.ts` |
| Routing | Next.js App Router | `app/` |
| Environment | dotenv | `server/env.ts` |

### Data Flow

```text
                  ┌──────────────────┐
                  │     Browser      │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Vercel Frontend │
                  │   Next.js App    │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Render Socket.IO │
                  │      Server      │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Multiplayer Game │
                  │    Management    │
                  └──────────────────┘

Authentication:
Browser → Firebase Auth → Firestore

Game Moves:
Browser ↔ Socket.IO Server

AI Analysis:
Browser → Stockfish.js Worker → Analysis UI
```

## 📁 Project Structure

```text
chesskings/
├── package.json
├── package-lock.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── .env.example
├── PROGRESS.md
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── auth.tsx
│   │   ├── (dashboard)/
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   └── opponent/
│   │   └── api/
│   │
│   ├── components/
│   │   ├── board/
│   │   │   └── ChessBoard.tsx
│   │   ├── game/
│   │   │   └── GameRoom.tsx
│   │   ├── analysis/
│   │   │   ├── FenInput
│   │   │   └── StockfishAnalysis
│   │   └── shared/
│   │
│   ├── lib/
│   │   ├── engine.ts
│   │   └── firebase.ts
│   │
│   └── types/
│
├── server/
│   ├── index.ts
│   ├── games.ts
│   ├── matchmaking.ts
│   ├── challenges.ts
│   ├── presence.ts
│   ├── ratings.ts
│   ├── auth.ts
│   └── env.ts
│
├── public/
│
└── README.md
```

## 🚀 Deployment

chesskings uses:

- **Vercel** for the Next.js frontend.
- **Render** for the Socket.IO multiplayer server.
- **Firebase** for authentication and persistent data.

### 1. Deploy Frontend to Vercel

1. Push your repository to GitHub.
2. Open [Vercel](https://vercel.com/).
3. Import the repository:

   `Divys0mCS/chesskings`

4. Select the `main` branch.
5. Configure the Firebase and Socket.IO environment variables.
6. Deploy the project.
7. Wait for the production build to complete.

### 2. Deploy Socket.IO Server to Render

1. Open [Render](https://render.com/).
2. Create a new Web Service.
3. Connect your GitHub repository.
4. Configure the service:

**Build Command:**

```bash
npm install
```

**Start Command:**

```bash
npx tsx server/index.ts
```

5. Add the required environment variables.
6. Deploy the service.

Example server URL:

```text
https://chesskings.onrender.com
```

### 3. Post-Deployment Checklist

- [ ] Vercel frontend loads successfully.
- [ ] Firebase configuration is correct.
- [ ] Browser console has no Firebase 400 errors.
- [ ] Render server starts successfully.
- [ ] Socket.IO connections establish correctly.
- [ ] Guest sign-in works.
- [ ] Players can create games.
- [ ] Matchmaking finds opponents.
- [ ] Real-time moves synchronize between players.
- [ ] AI analysis works.
- [ ] Leaderboard loads correctly.

## 🎮 How to Play

### Demo Mode

1. Open your deployed chesskings website.
2. Select **Continue as Guest**.
3. Enter your nickname.
4. Choose your preferred board theme.
5. Select **Create Game** or **Find Opponent**.
6. Start playing chess in real time!

Demo mode uses a default rating of 1500.

### Firebase Authentication Mode

1. Open the application.
2. Select **Sign In**.
3. Sign in using email/password or Google.
4. Set your nickname during your first sign-in.
5. Create a game or find an opponent.
6. Play and build your rating!

Ratings and leaderboard data are persisted using Firestore.

## ✨ Features

| Feature | Demo Mode | Firebase Auth |
|---|---|---|
| Game Creation | ✅ | ✅ |
| Matchmaking | ✅ | ✅ |
| Real-time Multiplayer | ✅ | ✅ |
| Player Ratings | Default 1500 | Firestore |
| Leaderboard | Static Entries | Firestore |
| Nickname / Prename | ✅ | ✅ |
| Board Themes | ✅ | ✅ |
| AI Analysis | ✅ | ✅ |
| Post-game Analysis | ✅ | ✅ |
| FEN Input | ✅ | ✅ |
| Best Move Suggestions | ✅ | ✅ |
| Challenges | ✅ | ✅ |
| Rematches | ✅ | ✅ |
| Keyboard Navigation | ✅ | ✅ |
| Touch-friendly Board | ✅ | ✅ |

## 🤖 AI Chess Analysis

chesskings integrates Stockfish.js through a Web Worker.

Analysis features include:

- Position evaluation.
- Best move recommendations.
- Principal Variation (PV) lines.
- FEN position input.
- Post-game position analysis.
- AI-powered chess insights.

The analysis engine runs in the browser without requiring a separate AI server.

## ⚠️ Known Issues & Workarounds

### 1. Render Free Tier Sleeps

**Problem:**

Render's free tier may shut down inactive services after approximately 15 minutes. This can interrupt multiplayer connections.

**Solutions:**

| Method | Description |
|---|---|
| Manual Wake-up | Visit your Render service URL |
| UptimeRobot | Configure periodic health checks |
| Cron Job | Send periodic requests to your service |
| Render Paid Plan | Use an always-on service plan |

### 2. Missing Firebase Variables on Vercel

**Problem:**

Without all six Firebase environment variables, the application may operate in demo mode only. Firebase requests can also fail.

**Solution:**

1. Open Vercel Dashboard.
2. Navigate to Settings → Environment Variables.
3. Add all six `NEXT_PUBLIC_FIREBASE_*` variables.
4. Redeploy the frontend.

### 3. CLIENT_ORIGIN Not Configured

**Problem:**

Socket.IO origin validation may fail, causing client disconnections.

**Solution:**

Set the following variable in Render:

```env
CLIENT_ORIGIN=https://chesskings.onrender.com
```

Restart the service afterward.

### 4. Render Start Command

**Problem:**

Using `node server/index.js` can cause startup errors because the server entry point is TypeScript.

**Solution:**

Use:

```bash
npx tsx server/index.ts
```

This was addressed in commit:

```text
0be279d - Fix Render startup: use tsx instead of node
```

### 5. Demo Authentication Token

Demo tokens follow this format:

```text
dev:<uid>:<name>
```

Example:

```text
dev:12345:Alice
```

To enable demo authentication:

```env
ALLOW_DEV_AUTH=1
NEXT_PUBLIC_DEMO_MODE=1
```

Only enable development authentication intentionally; do not expose demo authentication in a production deployment where it is not wanted.

## 🔄 Development Workflow

Follow this workflow when contributing:

1. Create a new branch from `main`.
2. Implement your feature or fix.
3. Run TypeScript checks:

   ```bash
   npm run typecheck
   ```

4. Run the production build:

   ```bash
   npm run build
   ```

5. Test locally:

   ```bash
   npm run dev
   ```

6. Commit your changes.
7. Push your branch to GitHub.
8. Redeploy Vercel or Render if required.

### Commit Convention

```bash
git commit -m "Your concise description of the change.

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>"
```

If AI attribution is not required or is declined, omit the footer.

## 📞 Troubleshooting

| Issue | Solution |
|---|---|
| Firebase 400 errors | Verify all six Firebase environment variables |
| Socket.IO disconnects | Check `CLIENT_ORIGIN` and Render service status |
| Render server sleeping | Wake the service or configure periodic health checks |
| Cannot sign in | Verify Firebase configuration and enabled sign-in providers |
| Demo mode works but Firebase Auth doesn't | Check Firebase credentials and authentication settings |
| Build fails | Run `npm run typecheck` and inspect build errors |
| Render startup crashes | Verify the start command uses `tsx server/index.ts` |
| Multiplayer not working | Verify `NEXT_PUBLIC_SOCKET_URL` and Socket.IO server availability |

## 📄 License

This project is licensed under the **MIT License**.

---

<p align="center">
  ♟️ <strong>chesskings</strong>
  <br />
  Play. Compete. Analyze. Improve.
  <br />
  Built for chess lovers.
</p>
