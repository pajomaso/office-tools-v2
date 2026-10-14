# Office tool v2 — spec check and deploy plan

Branch: `office-tool-v2`. Checked on 8 Oct 2026 against the Notion spec "Office Tool — Changes for Rui (Oct 2026)".
Nothing here has been deployed. Everything below ran on a local computer with fake data.

## How this was checked

| What | Result |
|---|---|
| `python3 scripts/spec-check.py` (the whole spec, item by item, against the running app) | **111 passed, 0 failed, 1 skipped** (the skipped one is the rate-limit test: it locks that page for an hour, so it's opt-in) |
| Same script on a database built **from the schema file alone** (fresh install) | 107 passed, 0 failed; columns and indexes identical to the development database |
| `pnpm run test` (timezone, metrics, passwords, door codes, tokens, production settings) | 14 tests × 3 machine timezones + 8, all passing |
| Production build (`api-server` bundle) started with production settings | Starts; refuses to start with missing or unsafe settings; cookie is `HttpOnly; Secure; SameSite=Lax`; sign-in link never in the response or the logs |
| Automated accessibility audit (axe) on every page | 0 violations after the fixes below |
| Occupancy numbers | Matched an independent SQL query |
| Dependency audit | 15 known vulnerabilities → 2 (both in the old check-in app, not part of this) |

Re-run it any time: start the API and run `python3 scripts/spec-check.py` (see CLAUDE.md). It only runs against `localhost`, because it resets and creates fake data.

## Spec, section by section

### Removed
- ✅ No plans, pricing, quotas, discounts, desk booking, pricing page, "Your plan", "Desks in use", billing or invoices (no endpoints, no fields, no screens).
- ✅ "Book room" is no longer the lead of Home (it is in the room cards, and on the Rooms page).

### Bugs to fix
- ✅ Timezone: a 09:00 booking is 09:00 for everyone, before and after the autumn clock change (tested for real bookings and in unit tests under 3 machine timezones).
- ✅ "Office Lisbon": the admin dashboard says **Office 42 · Braga**. (The old app's dashboard isn't in this repo, so that exact bug can only be fixed there.)

### Users and login
- ✅ One account type with an admin role; several admins, same permissions.
- ✅ Name, email, tag, company; companies; "one-off event" users (no company).
- ✅ Magic link **and** password. Wrong tries are limited; a locked account can still use the link.
- ⚠️ The password form has the standard fields Bitwarden and browsers look for, but it was **not tested with a real Bitwarden**.
- ⚠️ The three real admin emails are not in the app yet (local data uses fake ones). Note the spec says `paulo.sousa@subvisual.co`, while you have been signing in as `paulo@subvisual.co`: confirm which is right.

### Onboarding a new user
- ✅ Create user → give a tag → admin chooses a 4-digit code (a code used by another tag is refused) → change joins the pending batch → welcome email.
- ✅ Welcome email copy is editable (Settings), with the tag number, the code, the MyJABLOTRON links and the "may not be active yet" note.
- ❌ **Emails are not sent**: no email service is connected. The admin sees a preview to copy.
- ⚠️ The email text still has `[gaps]` for coffee/fridge/microwave, how to request equipment, and the login videos.

### Home
- ✅ One page: date, today's bookings, messages, open issues and requests, rooms.
- ✅ Messages: anyone posts, editable, one week by default and adjustable, past messages viewable, admins delete and pin any. The separate board and announcements are gone.
- ✅ One form for issue/request with title, text, type and public/private. People can follow public items, see who handles them and read the status note.

### Rooms
- ✅ Alfa (4), Bravo (4, **unconfirmed**: the spec says "??4 or 2??", admins can change it in Settings), Charlie (6). Admins set names and photos.
- ✅ Calendar (7 days, 24 hours, opens at 08:00), list, My bookings, booking from Home.
- ✅ Bookings in the booker's own name; booking for someone else with a note; create, edit, cancel; admins can do it for any booking. No booking rules; editable note on the booking page.
- ✅ 24/7 (a Saturday-night booking works). Cleaning and maintenance slots are shown and can't be booked over.
- ⚠️ A booking has to end by midnight of the same day, and can't start in the past. (Sanity limits, not rules.)

### Personal area
- ✅ Private. Tag number and code each behind a show/hide toggle; the code is only sent to the browser when you press show.
- ✅ Pending tag request shown until Ricardo confirms. Requests for a new tag, a lost tag, a new code (they reach the admins).
- ✅ Guest WiFi for everyone, internal WiFi only for `@subvisual.co` accounts.
- ⚠️ The three guides (door, app, sign-up) are `[to fill in]`.

### Tags and the Ricardo flow
- ✅ Statuses active, spare, lost, blocked; "pending" shows while a change is waiting.
- ✅ New user, spare assigned, reassigned, renamed, lost, returned each create a change in **one open batch**, which stays open until an admin sends it.
- ✅ Sending gives a link and "Ricardo, here's a new request: [link]". His page needs no account, shows one line per tag with Done and "Mark all done". No door codes, no emails.
- ✅ On Done the tag record updates, it is logged and every admin is notified (in the app). Until then the tag keeps the old name.
- ✅ Admins can change a code themselves, block a tag directly, mark a done line done for Ricardo (if he answers by email), and undo a mistaken Done.
- ✅ A line whose tag changed in the meantime is **not applied** (marked out of date).
- ❌ **Importing the Notion "Access Control" database is not built** (needs the real file, handled outside the repository).
- ⚠️ "All admins are notified" is **in the app only** (Dashboard badge and a banner on Tags): there are no emails.

### Admin
- ✅ Dashboard (inbox): unclaimed items with Claim, pending batch, Ricardo's updates, today's bookings, quick actions.
- ✅ Issues board open → claimed → done, status note, supplier; no notifications.
- ✅ Suppliers; booking history one year back with filters; metrics (occupancy by week and month, per room and overall, peak hours); settings for room names/photos, booking note, guides, WiFi, welcome email, and the metrics working window.
- ⚠️ The board moves cards with buttons, not drag and drop.
- ⚠️ Occupancy is a share of the "working window" (default Mon–Fri 08:00–20:00, editable): over 24/7 the numbers would be tiny. Peak hours cover all 24 hours.

## Found and fixed during this review

| Problem | Why it mattered |
|---|---|
| The sign-in link was written to the **server log** in every environment | Anyone with log access could sign in as anyone in production. Now only outside production. |
| Sessions, sign-in links and invite links were stored **readable** in the database | A database copy (backup) could be used to sign in. Now only a hash is stored (like the supplier link already was). |
| In production, the address in sign-in/supplier links came from the **request** | Someone could request a link for another person with a look-alike address and catch the secret. Now only `PORTAL_URL` is used. |
| Missing production settings failed halfway through a request (HTTP 500) | The server now refuses to start without `PORTAL_URL` (https), `PORTAL_CODE_KEY` (32 bytes) and `DATABASE_URL`. |
| 15 vulnerable dependencies (1 critical in Express' IP handling, which the rate limits rely on; Multer; Drizzle) | Updated within the allowed version ranges; 2 left, in the old check-in app. |
| Secondary text colour, green, amber and red were below the WCAG AA contrast | Darkened slightly (deviates a little from the original palette). |
| Supplier page had no `main`/heading; empty table headers; the hidden email field for password managers used `display: none` | Fixed. |
| "Book a room" as the headline action of Home | Removed, per the spec. |
| Editing a booking made through the API at an odd time (18:28) silently reset its time | Fixed earlier (the form keeps the real time). |

## Known limits and things nobody has tested
- **Not tested with real people or devices**: Bitwarden, iPhone/Android browsers beyond the emulated phone size (the calendar is tight at 375 px: the List view is better there), screen readers by hand, load.
- Door codes are encrypted with `PORTAL_CODE_KEY`. **If that key is lost, every stored code is unreadable.** Keep a copy in a password manager.
- Rate limits count by IP: many people behind one office IP share the allowance on Ricardo's page.
- The account lock (5 wrong passwords) can be triggered by someone else on purpose; the emailed link still works.
- One tag per person.
- No browser-based automated UI tests: the spec check exercises the API; the screens were checked by hand and with axe.
- The repository still contains the **old Office Engine** (`office-engine`, `check-in`, `mockup-sandbox`, old API routes). They are not part of v2 and one of them carries the 2 remaining audit findings. The type-check of `lib/api-zod` also fails (it did before this work).
- The live app (`office-8mijw.ondigitalocean.app`) is **not built from this repository** and its data model is unknown. v2 cannot be placed on top of it.

## What deploying safely would need (not done)

**A. Decide first**
1. Confirm in DigitalOcean (Apps → the app → Settings → component → Source) which repo and branch the live app deploys. Do not push `office-tool-v2` anywhere that is watched by an auto-deploy.
2. Recommended: a **new** DigitalOcean app and a **new** managed Postgres for v2, running next to the old one, then switch the address when ready. Keep the old app as the fallback.
3. Choose an email service (needed for sign-in links and the welcome email) and a sending domain.

**B. Before the first deploy (work on the branch)**
4. Put the code on a dedicated release branch, not `master`; decide whether to drop the old apps from it.
5. ✅ **Done (14 Oct):** `.do/app.yaml`. One service serves both the web app and the API (same address, cookies stay first-party), a pre-deploy job runs the migrations, managed database with backups, manual deploys. Checked with a clean build from a fresh copy of the repository; not validated by DigitalOcean itself (needs `doctl`).
6. ✅ **Done:** `lib/db/migrations` (baseline of the `portal_*` tables) and `pnpm --filter @workspace/db run migrate`. On a new database it builds exactly the same tables, indexes and constraints as the development one; running it twice is harmless.
7. Connect the email service in `portal-mail.ts`. (The rate limit on "email me a link" is ✅ done: 5 per address per 15 min, 30 per IP per hour; password form 30 per IP per 15 min. On in production.)
8. ✅ **Done:** security headers and a content-security-policy (checked: no page breaks), CORS off in production. Also found and fixed: the old Office Engine routes (no sign-in at all) are no longer served in production.
9. ✅ **Done in code:** with `DATABASE_CA_CERT` set (the app definition does it) the connection is encrypted and the certificate verified. To be confirmed on the real database.
10. ✅ **Done:** `pnpm --filter @workspace/scripts run setup:real -- setup.json [--apply]` (example: `scripts/setup.example.json`). Dry run by default; refuses a database that has fake users; safe to run twice.
11. Write the Notion import (tags, users) with a dry-run mode; handle the real codes outside the repository and let the importer encrypt them.

**C. Settings in DigitalOcean (encrypted environment variables)**
`NODE_ENV=production` (already fixed in the build), `PORTAL_URL=https://…`, `PORTAL_CODE_KEY` (32 random bytes, base64; also store a copy in the password manager), `DATABASE_URL` (the new database only), `PORT`. The server will not start if any of these is wrong.

**D. Test in a staging copy (separate app and database)**
Real email sign-in; create a user; onboard with a tag; send a batch and use Ricardo's link from another device; booking from a phone; Bitwarden; check logs contain no links, codes or passwords; run an automated dependency audit.

**E. Go live**
Back up, import, spot-check counts against Notion, switch the address, tell everyone to sign in with a link, keep the old app for a few weeks. Afterwards: uptime check on `/api/healthz`, error alerts, daily backups with a restore test, and a note on who holds `PORTAL_CODE_KEY`.
