// Live selector audit for webmunk ad-personalization strategies (signed-out pass).
// Visits the three platform settings pages and reports what the extension's exact
// selectors would find. No clicking in this pass.
import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

const targets = [
  {
    key: 'gyta',
    url: 'https://myadcenter.google.com/home',
    selectors: ['[aria-label*="Turn off."]', '[aria-label*="Turn on."]', '[jsname="Lnwj0b"]', '[jsname="mXJpKc"]'],
  },
  {
    key: 'aap',
    url: 'https://www.amazon.com/adprefs',
    selectors: ['[name="optout"]', '#optOutControl', '#adprefs-signin-button-id'],
  },
  {
    key: 'fad',
    url: 'https://accountscenter.facebook.com/ad_preferences/ad_settings/data_from_partners',
    selectors: ['.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft', '[name="radio1"]', '[name="radio2"]'],
  },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: 'en-US' });

for (const t of targets) {
  const page = await ctx.newPage();
  const result = { key: t.key, requested: t.url };
  try {
    await page.goto(t.url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(5000); // let SPA render past document 'complete'
    result.finalUrl = page.url();
    result.title = await page.title();
    // The content script gate: strategy only runs if location starts with the config URL
    result.strategyWouldRun = result.finalUrl.startsWith(t.url);
    result.counts = {};
    for (const sel of t.selectors) {
      const els = await page.$$(sel);
      result.counts[sel] = els.length;
      if (els.length > 0 && els.length <= 6) {
        result[`detail ${sel}`] = await Promise.all(els.map(async (e) =>
          (await e.evaluate((n) => (n.getAttribute('aria-label') || n.textContent || n.outerHTML.slice(0, 80)).trim().slice(0, 90)))));
      }
    }
    if (t.key === 'aap') {
      result.checkedBox = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('[name="optout"]')];
        const checked = boxes.find((b) => b.checked);
        return checked ? checked.value : null;
      });
    }
  } catch (e) {
    result.error = String(e).slice(0, 200);
  }
  console.log(JSON.stringify(result, null, 1));
  await page.close();
}
await browser.close();
