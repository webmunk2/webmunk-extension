# Webmunk switching diagnostics — RA test package

Standalone tests for whether the extension's ad-personalization switches actually take
effect. **Nothing here modifies or requires the extension** — the scripts replicate the
extension's exact click sequences (same selectors, same quirks, e.g. Facebook's
"confirm = last matching button") on the live pages and then independently verify the result.

Background and data analysis: `../SETTINGS_FLUCTUATION_INVESTIGATION.md`.
Manual (no-code) alternative: `RA_PROTOCOL.md`. Record results in a copy of
`RESULTS_TEMPLATE.md` (save as `RESULTS.md`).

## What you need

- Google Chrome installed; Node.js 18+ (`node --version`)
- **Test accounts** for Google, Amazon, Facebook. Never personal accounts — the switch test
  changes their ad settings (restorable with `--target=on`).

## Setup (once)

```bash
cd diagnostics
npm install
npx playwright install chromium   # fallback browser if Chrome can't be used
```

## Run, in order

| Step | Command | What it does |
|---|---|---|
| 0 | `npm run login` | Opens a browser; log into the three test accounts, then close the window. The session is saved locally in `profile/`. |
| 1 | `npm run audit:logged-in -- --dialogs` | Counts what the extension's selectors match on each logged-in page; opens the Facebook/Google dialogs to list buttons **in order** (then presses Escape — saves nothing). Key output: whether Facebook's LAST matching button is really the confirm. |
| 2 | `npm run switch-test` | **The decisive test.** Performs the extension's exact switch-OFF sequence on all three platforms, then reloads each page and prints a CLAIM vs REALITY table. A MISMATCH = the extension would have logged success while the setting did not change. |
| 3 | `npm run switch-test` (again, ~5 min later) | Simulates the extension's next visit. "Corrected again" = the switch didn't stick — the exact pattern in the study data. |
| 4 | `npm run switch-test -- --target=on` | Restores the settings (verify on the pages afterwards). |

Extras: `npm run audit` (signed-out audit, no login needed) and `npm run amazon-revert`
(signed-out proof that Amazon's setting reverts when cookies are cleared — already run on
2026-06-12, results below).

`--only=fad|gyta|aap` limits `switch-test` to one platform.

## Notes for the tester

- If a script prints `TIMEOUT ... the real extension has NO timeout here`, that itself is a
  finding: on participants' machines the extension would hang silently and log nothing.
  Screenshot the page and note it.
- If Google refuses to log in inside the automated browser, log into `accounts.google.com`
  in the opened window first (the `login` step opens it directly), then continue.
- The scripts intentionally reproduce the extension's behavior verbatim — if something looks
  like it's clicking the "wrong" button, that is the point. Don't fix it; record it.

## Findings already established (2026-06-12, signed-out pass)

| Platform | Result |
|---|---|
| Amazon | **Revert mechanism confirmed.** Fresh session defaults to "personalized ON"; the strategy's clicks opt out and persist across revisits; **clearing cookies fully reverts to ON**. Signed-out state is browser-scoped. |
| Facebook | **Selector genericness confirmed.** Signed out redirects to the login page, where the extension's class selector matches "Log in", "Forgot password?", "Create new account" — the classes are generic across Facebook UI, so "confirm = last matching button" is unreliable. |
| Google | Signed out redirects to the Google sign-in page → the extension's URL gate blocks the strategy → nothing runs, nothing logged (invisible failure). |

## Files

- `login.mjs` — one-time login into the persistent test profile
- `audit-logged-in.mjs` — logged-in selector audit (`--dialogs` opens dialogs read-only)
- `switch-test.mjs` — end-to-end switch + independent verification (`--target=on|off`, `--only=`)
- `audit.mjs` — signed-out selector audit
- `amazon-revert-test.mjs` — signed-out Amazon cookie-revert proof
- `helpers.mjs` — shared selectors (verbatim from the extension's strategies) and utilities
- `RA_PROTOCOL.md` — manual protocol (DevTools snippets + testing with the real extension build)
- `RESULTS_TEMPLATE.md` — copy to `RESULTS.md` and fill in
