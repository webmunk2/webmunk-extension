// THE DECISIVE TEST. Replicates, click-for-click, what the extension's strategies do to
// switch ad personalization OFF (the study treatment), then independently reloads each
// page and compares what the extension WOULD HAVE LOGGED against the ACTUAL state.
//
// Run `npm run login` first (test accounts only — this WILL change their ad settings).
// Restore settings manually afterward, or run with --target=on to flip them back.
//
// Usage: npm run switch-test [-- --target=on] [-- --only=fad|gyta|aap]
import { launchProfile, URLS, SEL, describeMatches, readAmazonState, readFbCheckedRadio, readGoogleState, log, waitOrTimeout } from './helpers.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => a.startsWith('--target='))?.split('=')[1] !== 'on'; // true = switch OFF
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const wantOff = target; // mirrors extension's value=false (turn personalization off)

const results = [];
const ctx = await launchProfile({ headless: false });
const page = ctx.pages()[0] ?? (await ctx.newPage());

// ---------- Google (GoogleAndYoutubeStrategy.ts, value=false path) ----------
if (!only || only === 'gyta') {
  log('gyta', `navigating to ${URLS.gyta}; target = personalization ${wantOff ? 'OFF' : 'ON'}`);
  await page.goto(URLS.gyta, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  let claimed = 'no event (run did not complete)';
  const alreadySel = wantOff ? SEL.googleOn : SEL.googleOff; // evidence it's already correct
  const clickSel = wantOff ? SEL.googleOff : SEL.googleOn;
  const saveSel = wantOff ? SEL.googleSaveWhenTurningOff : SEL.googleSaveWhenTurningOn;
  if (await page.$(alreadySel)) {
    claimed = `already correct -> would log current=${!wantOff}, initial=${!wantOff} (init==curr)`;
  } else if (await waitOrTimeout(page, clickSel, 20000, 'the toggle')) {
    const matches = await describeMatches(page, clickSel);
    log('gyta', `clicking first match of ${clickSel} (${matches.length} total): "${matches[0]}"`);
    await page.click(clickSel);
    if (await waitOrTimeout(page, saveSel, 20000, 'the save button')) {
      await page.click(saveSel);
      claimed = `clicked toggle+save -> would log current=${!wantOff}, initial=${wantOff} (a "correction")`;
    }
  }
  await page.waitForTimeout(3000);
  await page.goto(URLS.gyta, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  const actual = await readGoogleState(page);
  results.push({ platform: 'Google', claimed, actual, expected: wantOff ? 'OFF' : 'ON' });
}

// ---------- Amazon (AmazonStrategy.ts) ----------
if (!only || only === 'aap') {
  log('aap', `navigating to ${URLS.aap}`);
  await page.goto(URLS.aap, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);
  let claimed = 'no event (run did not complete)';
  if (await waitOrTimeout(page, SEL.amazonOptout, 20000, 'optout radios')) {
    const want = wantOff ? '1' : '0';
    const state = await readAmazonState(page);
    if (state === want) {
      claimed = `already correct -> would log current=${!wantOff} (init from PREVIOUS run)`;
    } else {
      await page.click(`${SEL.amazonOptout}[value="${want}"]`);
      await page.click(SEL.amazonSave);
      await page.waitForLoadState('load');
      claimed = `clicked radio+submit, page reloaded -> would log current=${!wantOff}, initial=${!wantOff} (init==curr even though it CHANGED)`;
    }
  }
  await page.goto(URLS.aap, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);
  const v = await readAmazonState(page);
  results.push({ platform: 'Amazon', claimed, actual: v === '1' ? 'OFF (opted out)' : v === '0' ? 'ON (personalized)' : v, expected: wantOff ? 'OFF' : 'ON' });
}

// ---------- Facebook (FacebookActivityStrategy.ts) ----------
if (!only || only === 'fad') {
  log('fad', `navigating to ${URLS.fad}`);
  await page.goto(URLS.fad, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  let claimed = 'no event (run did not complete)';
  if (!page.url().startsWith(URLS.fad)) {
    log('fad', `redirected to ${page.url()} — the extension's URL gate would block the strategy entirely`);
  } else if (await waitOrTimeout(page, SEL.fbButtons, 20000, 'the review button')) {
    await page.click(SEL.fbButtons); // extension clicks the FIRST match
    await page.waitForTimeout(2000);
    if (await waitOrTimeout(page, SEL.fbRadioChecked, 10000, 'a checked radio')) {
      const initial = await readFbCheckedRadio(page); // radio1=ON, radio2=OFF — a REAL read
      const wantRadio = wantOff ? 'radio2' : 'radio1';
      if (initial === wantRadio) {
        claimed = `already correct (found ${initial}) -> would log init==curr`;
      } else {
        await page.click(`[name="${wantRadio}"]`);
        const buttons = await describeMatches(page, SEL.fbButtons, 12);
        log('fad', `clicking LAST of ${buttons.length} matching buttons as "confirm": "${buttons[buttons.length - 1]}"`);
        const all = await page.$$(SEL.fbButtons);
        await all[all.length - 1].click(); // extension clicks the LAST match — verbatim quirk
        claimed = `found ${initial}, clicked ${wantRadio} + last-button "confirm" -> would log current=${!wantOff}, initial=${initial === 'radio1'}`;
      }
    }
  }
  await page.waitForTimeout(3000);
  // Independent verification: fresh load, reopen dialog, read the radio
  await page.goto(URLS.fad, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  let actual = 'could not verify';
  if (page.url().startsWith(URLS.fad) && (await page.$(SEL.fbButtons))) {
    await page.click(SEL.fbButtons);
    await page.waitForTimeout(2000);
    if (await waitOrTimeout(page, SEL.fbRadioChecked, 10000, 'a checked radio')) {
      const r = await readFbCheckedRadio(page);
      actual = r === 'radio2' ? 'OFF (radio2)' : r === 'radio1' ? 'ON (radio1)' : r;
    }
    await page.keyboard.press('Escape');
  }
  results.push({ platform: 'Facebook', claimed, actual, expected: wantOff ? 'OFF' : 'ON' });
}

await ctx.close();

console.log('\n================ CLAIM vs REALITY ================');
for (const r of results) {
  const ok = r.actual.startsWith(r.expected);
  console.log(`\n${r.platform}  ->  ${ok ? 'MATCH' : '*** MISMATCH: extension would log success but the setting is NOT as claimed ***'}`);
  console.log(`  extension would log: ${r.claimed}`);
  console.log(`  actual page state:   ${r.actual}   (expected: ${r.expected})`);
}
console.log('\nRecord this table in RESULTS.md. A MISMATCH on Facebook/Google confirms the silent-save-failure hypothesis.');
console.log('To restore the test accounts: npm run switch-test -- --target=on');
