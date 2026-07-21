# Scrum Poker

Real-time multiplayer planning poker. React + Vite frontend, Firebase (Firestore + Anonymous Auth) backend — no custom server.

## Local development

1. Copy `.env.example` to `.env` and fill in your Firebase web app config (Project Settings → your web app → SDK setup and configuration).
2. In the Firebase console, enable **Firestore Database** and **Authentication → Sign-in method → Anonymous**.
3. Publish the rules in `firestore.rules` via the Firestore **Rules** tab in the console.
4. `npm install`
5. `npm run dev`

## Deployment (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages on every push to `main`. It needs these repository secrets set (Settings → Secrets and variables → Actions):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Also enable Pages under Settings → Pages → Source → GitHub Actions.

Live at: https://rgblife.github.io/estimation-room/

Firebase web config values aren't secret in the traditional sense (they're safe to expose in a shipped client bundle), but they're kept out of the repo as a matter of hygiene and to keep the codebase config-agnostic.

## Future improvements

- **Rate limiting on room creation.** Currently unbounded — an anonymous client can create rooms as fast as it wants. Firestore security rules can't track request rate across documents/time on their own; the practical options are a per-uid Firestore counter doc checked in rules, and/or Firebase App Check to block non-browser scripted abuse.
- **Presence/heartbeat.** A user who force-quits their tab (rather than clicking "Leave room") lingers in the room's participant list until another participant's write touches the room. Could add a TTL sweep via a Cloud Function if this becomes annoying.
- **Bundle size.** The production build is ~770KB (mostly the Firebase SDK). Could reduce with more aggressive tree-shaking or code-splitting if load time becomes a concern.
