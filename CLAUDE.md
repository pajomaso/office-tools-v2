# Office tool v2 — working rules

Owner is not a developer. Explain things in plain language.

## Rules for this whole project
- Never commit or push to `main`/`master`, or to whatever branch DigitalOcean deploys. Work only on `office-tool-v2`.
- Never push a branch, open a PR or deploy without being asked.
- Never connect to or run migrations against the production database. Use the local database with fake data only. Never put real access codes in test data or commits.
- Before any database schema change, explain it in plain words and wait for an OK.
- Small commits, one feature at a time, with clear messages.
- After each step, say in plain language what changed and how to see it running.

## Spec
Notion: "Office Tool — Changes for Rui (Oct 2026)" https://app.notion.com/p/3f3caae58631810b90fcf80ac36a3942
The spec replaces JTBD v6 where they differ. Anything marked `??` in it is unconfirmed.

## Running locally
- Postgres: Homebrew `postgresql@16` (`brew services start postgresql@16`), database `office_engine`, `.env` points at localhost.
- Node 24 (`/usr/local/bin`), pnpm. Apps: API `:8080` (`artifacts/api-server`), UI `:5174` (`artifacts/portal`, proxies `/api`).
- Dev servers are defined in `.claude/launch.json` (`api-server`, `portal`).
- Seed fake data: `pnpm --filter @workspace/scripts run seed:v2` (refuses to run unless the database is on localhost).
- Schema: `pnpm --filter @workspace/db run push` (local only). If `drizzle-kit` asks about renames it hangs without a terminal; drop/rename columns by SQL first.
- All tests: `pnpm run test` (timezone tests under 3 machine timezones + password/door-code tests). Timezone only: `pnpm run test:time` runs the booking-time tests with the machine set to 3 different timezones (must all pass).
- Check: `npx tsc -p artifacts/portal/tsconfig.json --noEmit` and the same in `artifacts/api-server` (filter for `portal`; `api-zod` errors predate this work).

## Notes
- Door codes are stored encrypted. Locally a fixed fake key is used; production MUST set `PORTAL_CODE_KEY` (32 random bytes, base64) and the app refuses to start the feature without it. Never reuse the local key for real codes.
- No email service is connected: the welcome email is shown as a preview, and sign-in links are shown on screen outside production.
- The live app (office-8mijw.ondigitalocean.app) is NOT built from this repo. This repo's deploy config is Replit's. Confirm with Davide which repo/branch DigitalOcean deploys before any merge.
- The office is in Braga: all booking rules and display use Europe/Lisbon time (`artifacts/api-server/src/routes/portal-time.ts`, `artifacts/portal/src/lib/time.ts`).
- Magic-link emails are not sent yet; outside production the link is logged and shown on screen.
