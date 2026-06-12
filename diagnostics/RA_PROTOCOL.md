# RA Protocol (manual): Verifying whether the extension's ad-settings switches actually take effect

> **Prefer the scripted version**: `README.md` in this folder walks through `npm run login` →
> `npm run audit:logged-in -- --dialogs` → `npm run switch-test`, which automates Parts 1–2
> below (except testing the real extension build, steps 4–10). Use this manual protocol if
> you can't run Node, or to cross-check the scripts with the actual extension installed.

**Goal.** Event data suggests that for some participants the extension reports switching an ad
setting, but the switch never takes effect on Facebook (and possibly Google). This protocol
(a) checks whether the page elements the extension clicks are still the right ones, and
(b) runs one end-to-end switch on test accounts and verifies the result by hand.

Background and findings so far: see `../SETTINGS_FLUCTUATION_INVESTIGATION.md`. Signed-out
checks already done by script (`audit.mjs`, `amazon-revert-test.mjs`): Amazon's cookie-scoped
revert is confirmed; Facebook's selector matches generic buttons.

**You'll need:** Chrome, the study's test accounts for Google, Facebook, and Amazon (do NOT
use personal accounts — this changes ad settings), and the study extension build (unpacked
build folder from the dev team). Budget ~1 hour. Record everything in a shared doc,
including screenshots.

## Part 1 — Selector audit (no extension needed, ~20 min)

1. Log into the test Google account. Go to `myadcenter.google.com/home`. F12 → Console:

```js
['[aria-label*="Turn off."]','[aria-label*="Turn on."]','[jsname="Lnwj0b"]','[jsname="mXJpKc"]']
 .forEach(s => console.log(s, document.querySelectorAll(s).length,
   [...document.querySelectorAll(s)].map(e => (e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,60))));
```

   Record the output. Then click the "Personalized ads" toggle so the confirmation dialog
   opens, run the snippet again with the dialog open, record. Repeat with personalization in
   the opposite state. Good = first two patterns match exactly one element (the main toggle);
   `jsname` patterns match exactly one button when the dialog is open. Zero or multiple
   matches = the extension can click the wrong thing or hang.

2. Log into the test Facebook account. Go to
   `accountscenter.facebook.com/ad_preferences/ad_settings/data_from_partners`. Click the
   review/settings button so the dialog with the two radio options is visible. Console:

```js
const sel='.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
console.log(document.querySelectorAll(sel).length,
  [...document.querySelectorAll(sel)].map(b => b.textContent.trim()));
console.log('radios:', document.querySelectorAll('[name="radio1"],[name="radio2"]').length);
```

   Record the button texts **in order**. The extension clicks the **last** element as
   "confirm" (`FacebookActivityStrategy.ts:49-51`). Note whether the last one is actually the
   confirm button.

3. Log into the test Amazon account, go to `amazon.com/adprefs`, record which radio is
   selected.

## Part 2 — End-to-end switch verification (~30 min)

4. `chrome://extensions` → Developer mode → Load unpacked → select the build folder.
   Register with a test Prolific ID via the popup.

5. Note each platform's current setting. Open `chrome://extensions` → click the extension's
   **"service worker"** link to open its console, paste:

```js
chrome.storage.local.set({
  personalizationConfigs: { gyta: false, aap: false, fad: false },
  personalizationTime: 0,
  'adPersonalization.checkedItems': {}
});
```

   This assigns "turn personalization OFF" for all three platforms and makes the next check
   fire immediately.

6. Browse to any ordinary website. The extension opens tabs for the three platforms and
   performs the switches (blur overlay: "Ad personalization is in progress"). Do not close
   the tabs. Record per platform: completed and closed on its own, or stuck (how long;
   screenshot; close manually and note it).

7. **Decisive step.** Afterward, open each settings page in a fresh tab and record the actual
   state: Google "Personalized ads" off? Facebook data-from-partners radio? Amazon radio?

8. Give the data team the test Prolific ID to pull this run's `ad_personalization` events
   from BigQuery (`webmunk-429215.webmunk_extension_prod`). Needed comparison, per platform:
   **what the log claims vs. what you saw in step 7.**

9. (Repeat-cycle check) Re-run the step-5 snippet, browse again to trigger another cycle, and
   record whether the extension finds each setting already correct (tab closes quickly) or
   visibly re-does the switch — re-doing it means the previous switch didn't stick.

10. Cleanup: restore the test accounts' settings, remove the extension.
