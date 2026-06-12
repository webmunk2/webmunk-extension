// Step 0: opens a browser with a persistent profile so you can log into the THREE TEST
// ACCOUNTS once (Google, Amazon, Facebook). The other scripts reuse this profile.
// Do NOT use personal accounts — later scripts will change ad settings.
import { launchProfile } from './helpers.mjs';

const ctx = await launchProfile({ headless: false });

console.log('A browser window has opened with three tabs.');
console.log('Log into the TEST account on each site, then simply CLOSE the browser window.');
console.log('(If Google blocks the login, log into accounts.google.com first, then revisit the tab.)');

const pages = ctx.pages();
const first = pages[0] ?? (await ctx.newPage());
await first.goto('https://accounts.google.com/');
await (await ctx.newPage()).goto('https://www.amazon.com/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.com%2Fadprefs&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0').catch(() => {});
await (await ctx.newPage()).goto('https://www.facebook.com/login').catch(() => {});

await new Promise((resolve) => ctx.on('close', resolve));
console.log('Profile saved. Now run: npm run audit:logged-in');
