# Estimation Room

Real-time multiplayer planning poker. React + Vite frontend, Firebase (Firestore + Realtime Database + Anonymous Auth) backend — no custom server.

## Local development

1. Copy `.env.example` to `.env` and fill in your Firebase web app config (Project Settings → your web app → SDK setup and configuration), including `VITE_FIREBASE_DATABASE_URL` from the Realtime Database console.
2. In the Firebase console, enable **Firestore Database**, **Realtime Database**, and **Authentication → Sign-in method → Anonymous**.
3. Publish the rules in `firestore.rules` via the Firestore **Rules** tab, and the rules in `database.rules.json` via the Realtime Database **Rules** tab.
4. `npm install`
5. `npm run dev`

Realtime Database is used only for presence (detecting when a tab closes/crashes so a participant is removed from the room automatically) — all room/vote data still lives in Firestore.

## Deployment (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages on every push to `main`. It needs these repository secrets set (Settings → Secrets and variables → Actions):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`

Also enable Pages under Settings → Pages → Source → GitHub Actions.

Live at: https://rgblife.github.io/estimation-room/

Firebase web config values aren't secret in the traditional sense (they're safe to expose in a shipped client bundle), but they're kept out of the repo as a matter of hygiene and to keep the codebase config-agnostic.

## Future improvements

- **Rate limiting on room creation.** Currently unbounded — an anonymous client can create rooms as fast as it wants. Firestore security rules can't track request rate across documents/time on their own; the practical options are a per-uid Firestore counter doc checked in rules, and/or Firebase App Check to block non-browser scripted abuse.
- **Presence cleanup trust model.** Disconnect cleanup (tab close/crash) is detected via Realtime Database and enforced with a Firestore rule that lets any current participant remove one other participant's key once presence confirms they're gone. This is a client-trust model — a malicious client could in theory remove a still-connected participant — accepted as low-severity (a griefing annoyance, not a data exposure) to avoid needing Cloud Functions/Blaze billing.
- **Bundle size.** The production build is ~900KB (mostly the Firebase SDK, now including Realtime Database). Could reduce with more aggressive tree-shaking or code-splitting if load time becomes a concern.
