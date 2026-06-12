// Amazon adprefs behavioral test (signed-out): perform exactly the clicks
// AmazonStrategy does, then test persistence across reloads and cookie clears.
import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const URL = 'https://www.amazon.com/adprefs';

const readState = async (page) => page.evaluate(() => {
  const boxes = [...document.querySelectorAll('[name="optout"]')];
  const checked = boxes.find((b) => b.checked);
  // value '0' = personalized ads ON, '1' = opted out
  return checked ? checked.value : 'none';
});

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();

const log = (step, val) => console.log(`${step}: checked optout value = ${val} (${val === '0' ? 'personalized ON' : val === '1' ? 'OPTED OUT' : val})`);

await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
await page.waitForSelector('[name="optout"]', { timeout: 15000 });
log('1. fresh session', await readState(page));

// AmazonStrategy lines 52-67: click the box for value=false ('1'), then #optOutControl
await page.click('[name="optout"][value="1"]');
await page.click('#optOutControl');
await page.waitForLoadState('load');
await page.waitForSelector('[name="optout"]', { timeout: 15000 });
log('2. after opt-out click + submit (page reloaded)', await readState(page));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('[name="optout"]', { timeout: 15000 });
log('3. after independent revisit (same cookies)', await readState(page));

await ctx.clearCookies();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('[name="optout"]', { timeout: 15000 });
log('4. after clearing cookies and revisiting', await readState(page));

await browser.close();
