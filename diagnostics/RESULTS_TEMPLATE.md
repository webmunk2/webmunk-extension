# Test results — fill in and share

Tester: ______  Date: ______  Test account emails (no passwords): ______

## A. Selector audit, logged in (`npm run audit:logged-in -- --dialogs`)

| Check | Result | OK? |
|---|---|---|
| Google: `[aria-label*="Turn off."]` match count (+ what they are) | | exactly 1? |
| Google: `[aria-label*="Turn on."]` match count | | exactly 1? |
| Google dialog: `[jsname="Lnwj0b"]` / `[jsname="mXJpKc"]` counts | | exactly 1? |
| Facebook: button-class match count before dialog (+ texts) | | |
| Facebook dialog: buttons IN ORDER; is the LAST one the confirm? | | **key result** |
| Facebook dialog: which radio was checked | | |
| Amazon: signed in? which radio checked | | |

Repeat the Google checks with personalization in the other state if time allows.

## B. Switch test (`npm run switch-test`)

Paste the final "CLAIM vs REALITY" table here:

```
(output)
```

| Platform | Extension would log | Actual page state after | MATCH / MISMATCH |
|---|---|---|---|
| Google | | | |
| Amazon | | | |
| Facebook | | | |

## C. Repeat cycle (run `npm run switch-test` a second time, ~5 min later)

A platform whose first run said "clicked ... (a correction)" and whose second run says the
same thing again = the switch is not sticking (this is the pattern in the study data).

| Platform | 2nd run: already correct, or corrected again? |
|---|---|
| Google | |
| Amazon | |
| Facebook | |

## D. Anything odd

Screenshots, timeouts ("the real extension would hang forever here"), redirects, etc.

## Cleanup

- [ ] Restored settings (`npm run switch-test -- --target=on`) or manually
- [ ] Verified all three pages show the original state
