# Multiplayer feedback checks

Changes on `astral-experiment`; no production deployment is part of this work.

- **Reveal delay:** Firebase applies the initiating client's write locally before the other clients receive it. Results now appear without the additional 260ms card-exit wait, and a slow round write displays a sharing status. A seven-client emulator test verifies delivery, but does not establish production network latency or database location. The user confirmed this was several seconds on the GitHub Pages site built from `main`. That production delay still needs measurement on the affected connection; the changes in this branch are not deployed.
- **Cars with six or seven players:** local physics now moves the car through a DOM transform instead of rerendering the full car overlay every frame. Driver subscriptions preserve unchanged objects and combine position updates at 20Hz; phase changes and impacts remain immediate. Stationary cars send a heartbeat instead of continuous identical writes. Remote movement uses transforms. Vacated seats no longer remain invisible obstacles, and viewers no longer repeat collision writes.
- **Early reveal:** any participant can reveal after at least one vote, including with Enter. The table still displays the vote count. No change to the existing reveal permissions is needed.
- **Nudge:** the picker lists other active players who have not voted. A nudge produces a short shake and a text reminder; reduced-motion users receive text only. The UI limits sending and receiving to one nudge per ten seconds. Nudges use the existing transient throw transport, with an additional allowed event type in `database.rules.json`.
- **Table damage:** remote clients no longer delete damage when their local reveal state changes or rolls back. Only the client successfully advancing the round or switching the deck requests a reset. The emulator test drives seven clients, submits 21 simultaneous cracks, verifies both halves remain visible, and checks cleanup on the next round. This removes a reset race; it does not prove that race caused the original report.
- **Joining permissions:** a legacy saved avatar with a newly edited category was rejected by the actual emulator rules. Normalising the same avatar to the current schema makes the join succeed without relaxing Firestore rules. Valid choices are retained; invalid indices use the renderer's defaults. This is a reproduced cause, not confirmation of the affected user's exact error.

## Run the checks

A Java 21+ runtime and Firebase CLI are required for the emulators.

```sh
npm run emulators
# In another terminal:
npm run test:multiplayer
```

The Playwright configuration overrides the app's Firebase configuration with the `demo-scrum-poker` project and starts an isolated Vite server on port 4177. It creates independent browser contexts and anonymous users. Tests cover the real Firestore/Realtime Database rules, an early reveal, nudge delivery, seven drivers, persistent table fracture, new-round cleanup, and rejection/repair of a hybrid legacy avatar.

Regular checks remain `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:visual`.

Before the nudge feature is used on a deployed site, the matching Realtime Database rules must be deployed. Everyone in a multiplayer validation session should refresh to the same build; older clients still contain the previous table-reset behaviour. `main` and the deployed rules were left unchanged.
