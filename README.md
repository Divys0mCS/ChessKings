♟️ chesskings
Play. Compete. Analyze. Improve.

chesskings is a full-stack, real-time multiplayer chess platform built with Next.js, React, TypeScript, Socket.IO, Firebase, and Stockfish.js.

Play chess online, challenge opponents, compete for higher ratings, track your progress, and analyze positions with a powerful chess engine.

<p align="center">
<a href="https://chesskings.vercel.app/"><strong>♟️ PLAY CHESSKINGS</strong></a>
&nbsp; | &nbsp;
<a href="https://github.com/Divys0mCS/chesskings">GitHub Repository</a>
</p>

✨ Features
♟️ Real-Time Multiplayer
Create private chess games.
Find opponents through matchmaking.
Real-time moves powered by Socket.IO.
Automatic game state synchronization.
Reconnection support.
Server-authoritative game management.
Live chess clocks with increment and timeout detection.
Resignation and draw offers.
🏆 Competitive Chess
Elo-based player rating system.
Rated and casual game modes.
Rating-based matchmaking.
Multiple time controls.
Separate ratings for Bullet, Blitz, and Rapid.
Player profiles and statistics.
Win, loss, and draw tracking.
Rating history.
🤝 Challenges
Challenge other players.
Choose your preferred color.
Select time controls.
Choose rated or casual games.
Accept or decline challenges.
Real-time challenge notifications.
Challenge expiration handling.
🤖 AI Chess Analysis

Powered by Stockfish.js.

Position evaluation.
Best move recommendations.
Principal Variation (PV) lines.
FEN position input.
Post-game position analysis.
Browser-based chess engine using Web Workers.
🔐 Authentication & Persistence
Firebase Authentication.
Email/password sign-in.
Google sign-in.
Guest/demo mode for development.
Firestore-powered player profiles.
Persistent ratings and leaderboard data.
Player preferences and board themes.
🎨 User Experience
Responsive mobile and desktop interface.
Modern dark-themed design.
Smooth micro-animations.
Interactive chessboard.
Touch-friendly controls.
Keyboard navigation.
Move history and move highlighting.
Captured pieces and chess sounds.
🛠️ Technology Stack
Technology	Purpose
Next.js 16	Frontend framework
React 19	User interface
TypeScript	Type safety
Tailwind CSS 4	Styling
Node.js	Backend runtime
Socket.IO 4	Real-time multiplayer
Firebase Auth	Authentication
Cloud Firestore	Persistent player data
Firebase Admin SDK	Server-side Firebase operations
Stockfish.js	Chess engine and analysis
chess.js	Chess rules and move validation
react-chessboard	Interactive chessboard
Zod	Data validation
Vercel	Frontend deployment
Render	Socket.IO server hosting
🏗️ Architecture

chesskings uses a separate frontend and real-time game server.

System Overview
text
                  ┌─────────────────────┐
                  │       Player        │
                  │      Browser        │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │       Vercel        │
                  │    Next.js App      │
                  └──────────┬──────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
       ┌─────────────────┐    ┌──────────────────┐
       │ Firebase Auth   │    │  Render Server   │
       │                 │    │    Socket.IO     │
       └────────┬────────┘    └────────┬─────────┘
                │                      │
                ▼                      ▼
       ┌─────────────────┐    ┌──────────────────┐
       │   Firestore     │    │   Game Manager   │
       │ Ratings/Profile │    │   Matchmaking    │
       │ Leaderboard     │    │   Challenges     │
       └─────────────────┘    └──────────────────┘

       AI ANALYSIS:
       Browser → Stockfish.js Web Worker → Analysis UI

Project Structure
text
chesskings/
│
├── public/                  # Static assets
│
├── scripts/
│   └── dev-proxy.ts         # Development proxy
│
├── server/
│   ├── index.ts             # Socket.IO entry point
│   ├── games.ts             # Game management
│   ├── matchmaking.ts       # Matchmaking system
│   ├── challenges.ts        # Challenge management
│   ├── presence.ts          # Player presence
│   ├── ratings.ts           # Elo rating calculations
│   ├── auth.ts              # Token verification
│   └── env.ts               # Environment configuration
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── auth.tsx
│   │   ├── (dashboard)/
│   │   │   ├── profile/
│   │   │   └── opponent/
│   │   └── api/
│   │
│   ├── components/
│   │   ├── board/
│   │   ├── game/
│   │   ├── analysis/
│   │   └── shared/
│   │
│   ├── lib/
│   │   ├── engine.ts
│   │   └── firebase.ts
│   │
│   └── types/
│
├── .env.example
├── .gitignore
├── AGENTS.md
├── firebase.json
├── firestore.rules
├── next.config.ts
├── package.json
├── package-lock.json
├── PROGRESS.md
├── tsconfig.json
├── eslint.config.mjs
├── LICENSE
└── README.md

🚀 Getting Started
Prerequisites

Install the following:

Node.js >= 20.11.0
npm
Git
A Firebase project (optional when using demo mode)
1. Clone the Repository
bash
git clone https://github.com/Divys0mCS/chesskings.git

cd chesskings

2. Install Dependencies
bash
npm install

3. Configure Environment Variables

Create a .env.local file in the project root.

You can use .env.example as a reference.

bash
cp .env.example .env.local


Configure the Firebase web SDK:

env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id


Configure the Socket.IO server:

env
SOCKET_PORT=4001
CLIENT_ORIGIN=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=


Optional Firebase Admin configuration:

env
FIREBASE_SERVICE_ACCOUNT=
GOOGLE_APPLICATION_CREDENTIALS=


Development-only settings:

env
ALLOW_DEV_AUTH=1
NEXT_PUBLIC_DEMO_MODE=1


Important: Never commit Firebase service account credentials or private keys. Demo authentication must not be enabled on public production deployments.

🏃 Running the Application
Start Everything

Run the frontend, Socket.IO server, and development proxy concurrently:

bash
npm run dev

Available Commands
Command	Description
npm run dev	Starts all development services
npm run dev:web	Starts Next.js frontend
npm run dev:socket	Starts Socket.IO server
npm run dev:proxy	Starts development proxy
npm run dev:demo	Starts development in demo mode
npm run build	Creates production build
npm run start	Starts Socket.IO server
npm run lint	Runs ESLint
npm run typecheck	Runs TypeScript checks
Local URLs
Service	URL
Next.js	http://localhost:3001
Socket.IO	http://localhost:4001
Development proxy	Configured by development proxy
🎮 Demo Mode

You can develop and test chesskings without configuring Firebase Authentication.

Run:

bash
npm run dev:demo


Demo authentication uses the following token format:

text
dev:<uid>:<name>


Example:

text
dev:12345:Alice


Demo mode provides guest access for development and testing.

Note that demo ratings and leaderboard data are not equivalent to persistent Firebase-backed accounts.

🔥 Firebase Configuration

To enable full authentication and persistent player data:

Visit the Firebase Console.
Create a Firebase project.
Register a Web App.
Copy the Firebase configuration.
Add the six NEXT_PUBLIC_FIREBASE_* variables.
Enable Email/Password authentication.
Enable Google authentication if required.
Create a Cloud Firestore database.
Configure and deploy the Firestore security rules.

The project includes:

firebase.json
firestore.rules
src/lib/firebase.ts

Keep Firebase Admin credentials server-side only.

🚀 Deployment

The recommended deployment architecture is:

Component	Platform
Frontend	Vercel
Multiplayer server	Render
Authentication	Firebase
Database	Cloud Firestore
1. Deploy Frontend to Vercel
Visit Vercel.
Import Divys0mCS/chesskings.
Select the main branch.
Configure the Firebase environment variables.
Set the Socket.IO server URL.
Deploy the application.

Example:

env
NEXT_PUBLIC_SOCKET_URL=https://your-socket-service.onrender.com

2. Deploy Socket.IO Server to Render
Visit Render.
Create a new Web Service.
Connect your GitHub repository.
Set the build command:
bash
npm install

Set the start command:
bash
npm start

Configure the server environment variables.

Example:

env
SOCKET_PORT=4001
CLIENT_ORIGIN=https://your-frontend.vercel.app


Set CLIENT_ORIGIN to the actual frontend origin, not the Render server URL.

Configure Firebase Admin credentials if server-side Firebase operations require them.

Deploy the service.
3. Verify Deployment
Frontend loads successfully.
Firebase authentication works.
Socket.IO server starts.
Browser connects to the multiplayer server.
Guest access works where enabled.
Game creation works.
Matchmaking works.
Real-time moves synchronize.
Player ratings update.
Firestore persistence works.
Stockfish analysis works.
🧪 Testing and Quality Checks

Before submitting changes, run:

TypeScript
bash
npm run typecheck

ESLint
bash
npm run lint

Production Build
bash
npm run build


All checks should complete successfully before deployment.

📊 Development Progress

The project is tracked through PROGRESS.md.

Phase	Area	Progress
Phase 1	Game Core	100%
Phase 2	Matchmaking	100%
Phase 3	Challenges	100%
Phase 4	Profiles, History & Ratings	100%
Phase 5	Polish	80%

Progress figures reflect the current project tracker and may change as development continues.

⚠️ Important Notes
Render Free-Tier Sleep

Render free services may sleep after inactivity.

This can cause:

Delayed initial connections.
Temporary multiplayer interruptions.
Reconnection delays.

The service may need time to wake up before a new game can start.

Socket.IO Connection Issues

Check the following:

NEXT_PUBLIC_SOCKET_URL points to the correct server.
CLIENT_ORIGIN matches the frontend origin.
Render service is running.
Socket.IO connections are not blocked by browser or network restrictions.
Firebase Authentication Issues

Verify:

All six Firebase web configuration variables are correct.
Required authentication providers are enabled.
Firestore is configured.
Firestore security rules allow the intended operations.
🤝 Contributing

Contributions, suggestions, and improvements are welcome!

Fork this repository.
Create a feature branch.
bash
git checkout -b feature/your-feature

Make your changes.
Run the quality checks.
bash
npm run typecheck
npm run lint
npm run build

Commit your changes.
bash
git add .
git commit -m "Add: your feature description"

Push your branch.
bash
git push origin feature/your-feature

Open a Pull Request.
📄 License

This project is licensed under the MIT License.

See the LICENSE file for details.

🔗 Links
Live Website: https://chesskings.vercel.app/
GitHub Repository: https://github.com/Divys0mCS/chesskings
Firebase Console: https://console.firebase.google.com/
Vercel: https://vercel.com/
Render: https://render.com/

<p align="center">

♟️ chesskings

Play. Compete. Analyze. Improve.

Built with ❤️ for chess lovers.

⭐ If you like this project, consider giving it a star on GitHub!

</p>
