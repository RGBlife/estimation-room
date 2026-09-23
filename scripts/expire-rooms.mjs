// Deletes Firebase rooms nobody has touched for MAX_AGE_DAYS (default 30),
// the same inactivity expiry the room service applies. Run daily by
// .github/workflows/expire-rooms.yml.
//
// "Untouched" is the room document's own updateTime: every vote, join, leave
// and reveal writes the document, so an old updateTime means nobody has used
// the room since. That also catches rooms whose last visitor's tab crashed --
// nobody is left to remove their seat, so the room never looks empty, but it
// stops being written to all the same.
//
// Each delete is conditional on the updateTime just read, so a room someone
// rejoins while this runs is kept. The room's Realtime Database leftovers
// (table damage, throws, drivers, presence) go with it.
//
// Environment:
//   FIREBASE_SERVICE_ACCOUNT   service-account key JSON (production)
//   FIREBASE_PROJECT_ID        project to clean (default: the key's project)
//   FIREBASE_DATABASE_URL      Realtime Database URL, for the leftovers
//   FIRESTORE_EMULATOR_HOST    / FIREBASE_DATABASE_EMULATOR_HOST: use emulators
//   MAX_AGE_DAYS               inactivity before expiry (default 30)
//   DRY_RUN=1                  report what would be deleted, delete nothing

import { createSign } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const maxAgeDays = Number(process.env.MAX_AGE_DAYS || 30);
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST;
const databaseEmulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const account = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
const projectId = process.env.FIREBASE_PROJECT_ID || account?.project_id;

if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) throw new Error('MAX_AGE_DAYS must be a positive number');
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT');
if (!firestoreEmulator && !account) throw new Error('Set FIREBASE_SERVICE_ACCOUNT, or FIRESTORE_EMULATOR_HOST for local runs');

const firestoreBase = firestoreEmulator
  ? `http://${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// An OAuth token for the service account, from a JWT signed with its key --
// what Google's client libraries do, without depending on one.
async function accessToken() {
  if (!account) return 'owner'; // the emulators accept this as an admin token
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope: [
      'https://www.googleapis.com/auth/datastore',
      'https://www.googleapis.com/auth/firebase.database',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const response = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!response.ok) throw new Error(`Token request failed: ${response.status} ${await response.text()}`);
  return (await response.json()).access_token;
}

async function* listRooms(token) {
  let pageToken = '';
  do {
    // Only the name and updateTime are needed; the mask keeps each page small.
    const url = `${firestoreBase}/rooms?pageSize=300&mask.fieldPaths=code${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Listing rooms failed: ${response.status} ${await response.text()}`);
    const page = await response.json();
    yield* page.documents ?? [];
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
}

async function deleteRoom(token, room) {
  // A commit rather than a plain DELETE: the precondition travels in the
  // body, which the emulator honours too (it ignores it as a query string).
  const response = await fetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ writes: [{ delete: room.name, currentDocument: { updateTime: room.updateTime } }] }),
  });
  if (response.ok) return 'deleted';
  const body = await response.text();
  // The room was written after we listed it -- someone is using it again.
  if (/FAILED_PRECONDITION/.test(body)) return 'touched';
  throw new Error(`Deleting ${room.name} failed: ${response.status} ${body}`);
}

async function deleteLeftovers(token, code) {
  const paths = [`gtaTable/${code}`, `gta/${code}`, `throws/${code}`, `presence/${code}`];
  for (const path of paths) {
    const url = databaseEmulator
      ? `http://${databaseEmulator}/${path}.json?ns=${projectId}`
      : process.env.FIREBASE_DATABASE_URL ? `${process.env.FIREBASE_DATABASE_URL.replace(/\/$/, '')}/${path}.json` : null;
    if (!url) return;
    const response = await fetch(url, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Deleting ${path} failed: ${response.status} ${await response.text()}`);
  }
}

const token = await accessToken();
const cutoff = Date.now() - maxAgeDays * DAY_MS;
const counts = { scanned: 0, expired: 0, deleted: 0, touched: 0 };
for await (const room of listRooms(token)) {
  counts.scanned++;
  if (Date.parse(room.updateTime) >= cutoff) continue;
  counts.expired++;
  const code = room.name.split('/').pop();
  const idleDays = Math.floor((Date.now() - Date.parse(room.updateTime)) / DAY_MS);
  if (dryRun) { console.log(`would delete ${code} (idle ${idleDays} days)`); continue; }
  const outcome = await deleteRoom(token, room);
  counts[outcome]++;
  if (outcome === 'deleted') {
    await deleteLeftovers(token, code);
    console.log(`deleted ${code} (idle ${idleDays} days)`);
  } else {
    console.log(`kept ${code}: used again while this ran`);
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}scanned ${counts.scanned} rooms; ${counts.expired} idle over ${maxAgeDays} days; deleted ${counts.deleted}; kept ${counts.touched} used meanwhile`);
