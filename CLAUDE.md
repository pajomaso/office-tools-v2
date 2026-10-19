# Office tool v2 — working rules

Owner is not a developer. Explain things in plain language.

## Rules for this whole project
- Never commit or push to `main`/`master`, or to whatever branch DigitalOcean deploys. Work only on `office-tool-v2`.
- Never push a branch, open a PR or deploy without being asked.
- Never connect to or run migrations against the production database. Use the local database with fake data only. Never put real access codes in test data or commits.
- Before any database schema change, explain it in plain words and wait for an OK.
- Small commits, one feature at a time, with clear messages.
- After each step, say in plain language what changed and how to see it running.

## Where this lives
- Home of v2: private repo `pajomaso/office-tools-v2` (git remote `v2`, branch `main` there = local `office-tool-v2`). Push with `git push v2 office-tool-v2:main` only when asked.
- `origin` is the old `pajomaso/subofficehub`: do not push v2 work there.

## Spec
Notion: "Office Tool — Changes for Rui (Oct 2026)" https://app.notion.com/p/3f3caae58631810b90fcf80ac36a3942
The spec replaces JTBD v6 where they differ. Anything marked `??` in it is unconfirmed.

## Running locally
- Postgres: Homebrew `postgresql@16` (`brew services start postgresql@16`), database `office_engine`, `.env` points at localhost.
- Node 24 (`/usr/local/bin`), pnpm. Apps: API `:8080` (`artifacts/api-server`), UI `:5174` (`artifacts/portal`, proxies `/api`).
- Dev servers are defined in `.claude/launch.json` (`api-server`, `portal`).
- Seed fake data: `pnpm --filter @workspace/scripts run seed:v2` (refuses to run unless the database is on localhost).
- Schema: `pnpm --filter @workspace/db run push` (local only). **Every schema change also needs a migration**: `pnpm --filter @workspace/db run generate -- --name <what>` and commit `lib/db/migrations`. New databases (staging, production) are set up only with `pnpm --filter @workspace/db run migrate` (v2 tables only, tracked in `__portal_migrations`). If `drizzle-kit` asks about renames it hangs without a terminal; drop/rename columns by SQL first.
- All tests: `pnpm run test` (timezone and metrics tests under 3 machine timezones + password/door-code tests). Timezone only: `pnpm run test:time` runs the booking-time tests with the machine set to 3 different timezones (must all pass).
- Spec check: with the API running, `python3 scripts/spec-check.py` resets the fake data and checks the whole spec item by item (localhost only). See SPEC-CHECK.md for the results and the deploy plan.
- Check: `npx tsc -p artifacts/portal/tsconfig.json --noEmit` and the same in `artifacts/api-server` (both should be clean).

## Notes
- Door codes are stored encrypted. Locally a fixed fake key is used; production MUST set `PORTAL_CODE_KEY` (32 random bytes, base64) and the app refuses to start the feature without it. Never reuse the local key for real codes.
- Tags: changes go into one open batch; sending it makes a secret link for the supplier (`/access/<token>`, no account). Only a SHA-256 hash of the link is stored, so a link is shown once and can be regenerated or revoked. A tag only changes when its line is marked done. Set `PORTAL_URL` in production so links point at the real site.
- Production needs `PORTAL_URL` (https), `PORTAL_CODE_KEY` and `DATABASE_URL`; the server refuses to start without them. Sign-in links, sessions and the supplier link are stored hashed.
- No email service is connected: the welcome email is shown as a preview, and sign-in links are shown on screen outside production.
- The live app (office-8mijw.ondigitalocean.app) is NOT built from this repo. This repo only contains v2 (the old Office Engine apps were removed on 19 Oct). Confirm with Davide which repo/branch DigitalOcean deploys before any merge.
- The office is in Braga: all booking rules and display use Europe/Lisbon time (`artifacts/api-server/src/routes/portal-time.ts`, `artifacts/portal/src/lib/time.ts`).
- Magic-link emails are not sent yet; outside production the link is logged and shown on screen.
