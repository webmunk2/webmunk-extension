// Part 1 (scripted): logged-in selector audit. Read-mostly — it opens the Facebook review
// dialog and (with --dialogs) the Google confirm dialog to count buttons, but presses
// Escape instead of saving. Run `npm run login` first.
//
// What to record from the output, per platform:
//  - match counts for each extension selector (good = exactly 1; 0 or >1 = bug confirmed)
//  - Facebook: the ORDERED list of dialog buttons — the extension clicks the LAST one as
//    "confirm"; note whether the last one actually is the confirm button.
import { launchProfile, URLS, SEL, describeMatches, readAmazonState, readFbCheckedRadio, readGoogleState, log, waitOrTimeout } from './helpers.mjs';

const openDialogs = process.argv.includes('--dialogs');
const ctx = await launchProfile({ headless: false });
const page = ctx.pages()[0] ?? (await ctx.newPage());

// ---------- Google ----------
log('gyta', `opening ${URLS.gyta}`);
await page.goto(URLS.gyta, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(6000);
log('gyta', `final URL: ${page.url()}  (extension only runs if it starts with ${URLS.gyta})`);
for (const s of [SEL.googleOff, SEL.googleOn]) {
  const m = await describeMatches(page, s);
  log('gyta', `${s} -> ${m.length} match(es): ${JSON.stringify(m)}`);
}
log('gyta', `state as the extension would read it: ${await readGoogleState(page)}`);
if (openDialogs) {
  const toggle = (await page.$(SEL.googleOff)) || (await page.$(SEL.googleOn));
  if (toggle) {
    await toggle.click();
    await page.waitForTimeout(3000);
    for (const s of [SEL.googleSaveWhenTurningOn, SEL.googleSaveWhenTurningOff]) {
      const m = await describeMatches(page, s);
      log('gyta', `dialog open: ${s} -> ${m.length} match(es): ${JSON.stringify(m)}`);
    }
    await page.keyboard.press('Escape'); // do not save
    log('gyta', 'pressed Escape — no change saved');
  }
}

// ---------- Amazon ----------
log('aap', `opening ${URLS.aap}`);
await page.goto(URLS.aap, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3000);
log('aap', `final URL: ${page.url()}`);
for (const s of [SEL.amazonOptout, SEL.amazonSave, '#adprefs-signin-button-id']) {
  const m = await describeMatches(page, s);
  log('aap', `${s} -> ${m.length} match(es)`);
}
log('aap', `checked optout value: ${await readAmazonState(page)} ('0'=personalized ON, '1'=opted out)`);
log('aap', `signed in? ${(await page.$('#adprefs-signin-button-id')) ? 'NO (sign-in button visible — page shows BROWSER-scoped setting)' : 'yes (account-scoped)'}`);

// ---------- Facebook ----------
log('fad', `opening ${URLS.fad}`);
await page.goto(URLS.fad, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(6000);
log('fad', `final URL: ${page.url()}  (extension only runs if it starts with ${URLS.fad})`);
let m = await describeMatches(page, SEL.fbButtons, 12);
log('fad', `${SEL.fbButtons} -> ${m.length} match(es): ${JSON.stringify(m)}`);
if (m.length > 0) {
  // The extension clicks the FIRST match as the "review" button (FacebookActivityStrategy.ts:18-20)
  log('fad', `clicking FIRST match ("${m[0]}") — exactly what the extension does to open the dialog`);
  await page.click(SEL.fbButtons);
  await page.waitForTimeout(2000);
  const found = await waitOrTimeout(page, SEL.fbRadioChecked, 10000, 'a checked radio');
  if (found) log('fad', `checked radio at dialog open: ${await readFbCheckedRadio(page)} (radio1=partners-data ON, radio2=OFF)`);
  m = await describeMatches(page, SEL.fbButtons, 12);
  log('fad', `dialog open: ${m.length} match(es), IN ORDER: ${JSON.stringify(m)}`);
  log('fad', `>>> the extension would click the LAST one as "confirm": "${m[m.length - 1]}" — is that the confirm button? RECORD THIS. <<<`);
  await page.keyboard.press('Escape'); // do not save
  log('fad', 'pressed Escape — no change saved');
}

await ctx.close();
console.log('\nAudit done. Next: npm run switch-test');
