// Shared helpers for the diagnostics scripts.
// The selectors and click sequences here intentionally MIRROR the extension's strategies in
// packages/modules/ad-personalization/src/content/strategies/ — do not "fix" them; the point
// is to reproduce what the extension does, including its quirks.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROFILE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'profile');

export const URLS = {
  gyta: 'https://myadcenter.google.com/home',
  aap: 'https://www.amazon.com/adprefs',
  fad: 'https://accountscenter.facebook.com/ad_preferences/ad_settings/data_from_partners',
};

// Extension selectors (verbatim from the strategies)
export const SEL = {
  googleOff: '[aria-label*="Turn off."]',
  googleOn: '[aria-label*="Turn on."]',
  googleSaveWhenTurningOn: '[jsname="Lnwj0b"]',
  googleSaveWhenTurningOff: '[jsname="mXJpKc"]',
  fbButtons: '.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft',
  fbRadioChecked: '[name="radio1"]:checked, [name="radio2"]:checked',
  amazonOptout: '[name="optout"]',
  amazonSave: '#optOutControl',
};

// Persistent profile so the RA logs in once and the scripts reuse the session.
// channel:'chrome' uses installed Google Chrome (Google login often rejects bare Chromium).
export async function launchProfile({ headless = false } = {}) {
  const opts = {
    headless,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  };
  try {
    return await chromium.launchPersistentContext(PROFILE_DIR, { ...opts, channel: 'chrome' });
  } catch {
    return await chromium.launchPersistentContext(PROFILE_DIR, opts);
  }
}

export async function describeMatches(page, selector, max = 8) {
  return page.$$eval(
    selector,
    (els, m) =>
      els.slice(0, m).map((e) => (e.getAttribute('aria-label') || e.textContent || e.outerHTML.slice(0, 80)).trim().slice(0, 90)),
    max,
  );
}

export async function readAmazonState(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[name="optout"]')];
    const checked = boxes.find((b) => b.checked);
    // '0' = personalized ads ON, '1' = opted out
    return checked ? checked.value : 'none';
  });
}

export async function readFbCheckedRadio(page) {
  return page.evaluate(() => {
    const checked = document.querySelector('[name="radio1"]:checked, [name="radio2"]:checked');
    return checked ? checked.name : 'none'; // radio1 = partners-data ON, radio2 = OFF
  });
}

// Google state as the extension infers it (GoogleAndYoutubeStrategy.ts:12-15)
export async function readGoogleState(page) {
  return page.evaluate(() => {
    const off = document.querySelector('[aria-label*="Turn off."]');
    const on = document.querySelector('[aria-label*="Turn on."]');
    return off ? 'ON (Turn off. present)' : on ? 'OFF (Turn on. present)' : 'UNKNOWN (neither present)';
  });
}

export function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

// Wait with a hard timeout, reporting (instead of hanging forever like the extension does).
export async function waitOrTimeout(page, selector, ms, label) {
  try {
    await page.waitForSelector(selector, { timeout: ms, state: 'visible' });
    return true;
  } catch {
    console.log(`  TIMEOUT after ${ms / 1000}s waiting for ${label} (${selector}).`);
    console.log('  NOTE: the real extension has NO timeout here — it would hang forever and log nothing.');
    return false;
  }
}
