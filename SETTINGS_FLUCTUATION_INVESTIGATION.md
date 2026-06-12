# Investigation: apparent fluctuations in logged ad-personalization settings

Date: 2026-06-12. Data: `webmunk-429215.webmunk_extension_prod` (BigQuery), 32,655 `ad_personalization` events, ~2,150 registered participants. Code references are to this repo.

## Summary

Participants' settings appeared to fluctuate across days after the extension switched them. Three findings, in order of importance:

1. **Treatment fidelity: for a meaningful share of participants the switch never sticks.** Among series actually switched OFF during the treatment window, **28% of Facebook, 18% of Google, and 7% of Amazon** show *repeated* "found wrong, re-switched" events. For Facebook/Google the failure repeats on essentially every ~2-day visit — consistent with the save click silently failing — so these participants may be effectively untreated while the logs record success.
2. **Participants are not flipping settings.** Between consecutive genuine readings, values flip <1% of the time.
3. **Survey 2's redirect rewrites the assignment** and the extension re-switches real settings 1–4 days later — an end-of-window artifact that looks like spontaneous reverts in day-level data. The rewrite is not a clean restoration; the Qualtrics Survey-2 redirect needs auditing.

## Study timeline (verified from data)

| Day | Event |
|---|---|
| 0 | Enrollment. Extension runs all 3 platforms with no assignment yet → **baseline read-only measurements** |
| ~7 (median 7.1) | Survey 1 (`SV_4HhyYRHaAIhKzQy`). Qualtrics redirect delivers assignment → **switch executed** |
| 7–21 | Treatment window. Extension re-runs every ~2 days |
| ~21 (median 14.3 after S1) | Survey 2 (`SV_9t66rhkhoFuq2Jo`). Redirect **replaces** assignment → re-switching; extension wraps up |

## How to interpret `ad_personalization` events

| Field state | Meaning | Trust as measurement? |
|---|---|---|
| `values_initial_value IS NULL` | Read-only run (no assignment for that key) | **Yes** — actual DOM read |
| `values_initial_value IS NOT NULL` | Switch-path run | `current_value` echoes the *intended* target — never re-verified |
| `initial_value != current_value` | "Correction": found wrong at visit start, re-switched | First one after S1 = the treatment; **repeats = switch not persisting** |

Per-platform semantics of `initial_value` on switch runs:
- **Facebook**: real read of the checked radio at visit start (`FacebookActivityStrategy.ts:27-28`) — corrections are trustworthy evidence.
- **Google**: fabricated — always `!value` when the click path runs (`GoogleAndYoutubeStrategy.ts:36,51`); a correction means "the click path executed," conflating failed saves with detection flakiness.
- **Amazon**: lagged — reports the *previous* run's reading via `chrome.storage.local.amazonInitialValue` (`AmazonStrategy.ts:38-44,58-59,68`).

Also: failures are invisible by construction. Closed-tab runs are never sent to Jitsu (`webmunk-ext/src/worker/Worker.ts:79-81`), strategy errors go only to local storage (`AdPersonalizationWorker.ts:60-67,88-90`), and element waits have no timeout (`BaseStrategy.ts:100-115`).

## Finding 1 — Within-treatment re-switching (the anomaly observed after Survey 1)

Correction events between each user's Survey 1 and Survey 2, per user×platform series.
Denominator matters: series whose assigned target is "ON" are mostly no-ops (baselines are
overwhelmingly ON), so condition on the series actually being switched OFF:

| Platform | Switched-OFF series | ≥1 correction (the switch itself) | ≥2 corrections (switch not sticking) | Among ≥2: share of visits corrected |
|---|---|---|---|---|
| fad | 595 | 399 | **169 (28%)** | median 100%, avg 94% |
| gyta | 604 | 547 | **108 (18%)** | median 100%, avg 75% |
| aap | 601 | 569 | **42 (7%)** | median 40%, avg 46% |

The keep-ON arm shows near-zero repeated corrections on Google/Amazon (0.3–1.1%) but 10.3%
on Facebook — Facebook churns even on no-op targets, consistent with misreads (e.g., the
dialog surfacing a different Account Center profile) on top of failed saves.

Sanity check for the design: the redirects delivered ~600 switch-OFF series per platform;
if the intended treated-arm sizes are materially smaller, the Survey-1 redirect may be
over-assigning `false` (same Qualtrics parameter plumbing as Finding 3).

Interpretation:
- The FB/Google "fails every visit" signature points to the **save action silently failing**: Facebook's confirm is "the last button matching" rotated obfuscated CSS classes (`FacebookActivityStrategy.ts:49-51`) — plausibly Cancel; Google's save dialog is clicked via deploy-specific `jsname`s (`Lnwj0b`/`mXJpKc`) and the toggle is found by whole-page substring match `[aria-label*="Turn off."]`. A secondary candidate: scope ambiguity — Facebook Account Center exposes per-profile (FB vs Instagram) radios, so different visits may touch different profiles.
- Amazon's sporadic pattern fits **browser-scoped state**: adprefs shows a cookie-scoped setting when signed out, so sign-out/cookie-clearing genuinely reverts what the page displays.
- **Affected participants are identifiable**: flag user×key series with ≥2 corrections in the treatment window as likely-untreated (or bound results with/without them).

## Finding 2 — Genuine settings are stable

Between consecutive read-only events for the same user×key, values flip 0.5–0.9% of the time (43 flips / ~6,150 pairs). Participants are not manually toggling.

## Finding 3 — Survey-2 assignment rewrite

Assignments travel as URL params in the Qualtrics→landing redirect; each redirect **replaces** `personalizationConfigs` and clears `checkedItems`, forcing re-execution (`SurveyService.ts:134-136,253-254,277-285`). Of 1,093 target flips between consecutive switch events, 1,085 bracket a survey completion — all Survey 2. The re-switch lands 1–4 days later (next browsing-triggered cycle), masking the connection in day-level data.

The rewrite is not clean restoration: e.g., 71 gyta users went `original=true, treatment=true → post=false`; 15 went `original=false, treatment=false → post=true`. Note the feedback loop: each survey URL embeds the extension's own logged values (`SurveyService.ts:155-163`), and the redirect feeds values back as the new assignment. **Audit the Qualtrics Survey-2 redirect parameters.**

## Reproduction queries

Classify transitions and flip rates:

```sql
WITH ordered AS (
  SELECT user_id, key, timestamp, values_current_value AS curr,
    values_initial_value IS NOT NULL AS has_initial,
    LAG(values_current_value) OVER w AS prev_curr,
    LAG(values_initial_value IS NOT NULL) OVER w AS prev_has_initial
  FROM `webmunk-429215.webmunk_extension_prod.ad_personalization`
  WHERE values_current_value IS NOT NULL
  WINDOW w AS (PARTITION BY user_id, key ORDER BY timestamp)
)
SELECT key,
  IF(prev_has_initial, 'echo', 'read') || '->' || IF(has_initial, 'echo', 'read') AS transition,
  COUNT(*) n, COUNTIF(curr != prev_curr) flips
FROM ordered WHERE prev_curr IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;
```

Within-treatment corrections (Finding 1):

```sql
WITH s1 AS (
  SELECT user_id, MIN(timestamp) AS s1_ts
  FROM `webmunk-429215.webmunk_extension_prod.survey_completed`
  WHERE survey_url LIKE '%SV_4HhyYRHaAIhKzQy%' GROUP BY user_id
),
s2 AS (
  SELECT user_id, MIN(timestamp) AS s2_ts
  FROM `webmunk-429215.webmunk_extension_prod.survey_completed`
  WHERE survey_url LIKE '%SV_9t66rhkhoFuq2Jo%' GROUP BY user_id
),
per_user AS (
  SELECT e.user_id, e.key,
    COUNT(*) AS n_events,
    COUNTIF(e.values_initial_value != e.values_current_value) AS n_corrections
  FROM `webmunk-429215.webmunk_extension_prod.ad_personalization` e
  JOIN s1 USING(user_id) LEFT JOIN s2 USING(user_id)
  WHERE e.values_initial_value IS NOT NULL
    AND e.timestamp > s1.s1_ts AND (s2.s2_ts IS NULL OR e.timestamp < s2.s2_ts)
  GROUP BY 1, 2
)
SELECT key, COUNT(*) AS series,
  COUNTIF(n_corrections >= 2) AS repeated_corrections,
  ROUND(AVG(IF(n_corrections >= 2, n_corrections / n_events, NULL)) * 100) AS avg_pct_visits_corrected
FROM per_user GROUP BY key ORDER BY key;
```

Survey attribution of target flips (Finding 3): join echo→echo flips to `survey_completed` with `s.timestamp BETWEEN prev_ts AND ts`.

## Live-page verification — results so far (2026-06-12)

Automated signed-out tests (scripts + full results in `diagnostics/`):

- **Amazon revert mechanism CONFIRMED**: fresh sessions default to "personalized ON"; the strategy's exact clicks opt out successfully and persist across revisits; **clearing cookies fully reverts the setting to ON**. This explains Amazon's sporadic corrections without any human action.
- **Facebook selector genericness CONFIRMED**: the class selector `.x1lliihq.x193iq5w...` matches "Log in" / "Forgot password?" / "Create new account" on the login page — the classes are generic Facebook UI atoms, so "confirm = last matching button" is unreliable on the settings dialog.
- **Signed-out = invisible failure CONFIRMED** for Google and Facebook: both redirect away from the target URL, the content-script URL gate (`AdPersonalizationContent.ts:24-28`) fails, the strategy never runs, and nothing is logged.

## Live-page verification — remaining (needs a logged-in test account)

**Decisive test (silent save failure):** install the extension build on a test profile, assign `fad=false` (seed `chrome.storage.local.set({personalizationConfigs:{fad:false}})` from the service-worker console), let it run, then manually open the Facebook ad settings page. If the setting is unchanged while BigQuery shows a success event, the failure mode is confirmed. Repeat for `gyta`.

**Selector audit** (DevTools console; expect exactly 1 match in every state — signed in/out, setting on/off, non-English locale, second account/profile):

```js
// myadcenter.google.com/home
['[aria-label*="Turn off."]','[aria-label*="Turn on."]','[jsname="Lnwj0b"]','[jsname="mXJpKc"]']
  .forEach(s => console.log(s, document.querySelectorAll(s).length));

// www.amazon.com/adprefs
['[name="optout"]','#optOutControl','#adprefs-signin-button-id']
  .forEach(s => console.log(s, document.querySelectorAll(s).length));

// accountscenter.facebook.com/ad_preferences/ad_settings/data_from_partners
const sel = '.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
console.log(sel, document.querySelectorAll(sel).length,
  [...document.querySelectorAll(sel)].map(b => b.textContent)); // verify LAST one is the confirm button
```

**Amazon scope test:** opt out signed-in, then visit adprefs signed-out and after clearing amazon.com cookies; compare what the page shows.

**Race reproduction (control-arm contamination risk):** seed `{personalizationConfigs:{oi:true}}`, set Google personalization ON, enable 6x CPU throttling, trigger a cycle — on the buggy path the extension clicks "Turn off" instead of reading (`GoogleAndYoutubeStrategy.ts:37-51`).

## Recommended fixes (for any future wave; not implemented)

1. **Verify, then log**: after every switch, re-read the DOM (or re-open the page) and log `measuredValue` separately from the intended value; schedule periodic read-backs for all arms.
2. Make runs with no assignment strictly read-only (fix the `GoogleAndYoutubeStrategy` fallthrough).
3. Emit closed-tab and error outcomes to Jitsu so failures are visible.
4. Merge rather than replace `personalizationConfigs` on survey redirects; stop building survey URLs from the extension's own logged values; audit the Qualtrics Survey-2 redirect.
5. Add timeouts to `waitForElement`; scope selectors to the specific toggle's container; identify Facebook's confirm button by role/text, not class soup.
