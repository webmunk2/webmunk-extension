enum moduleEvents {
  COOKIES = 'cookies',
  PRIVACY_SETTINGS = 'privacy_settings',
};

export class CookiesWorker {
  private eventEmitter: any;

  constructor () {
    this.eventEmitter = (self as any).messenger.registerModule('cookies-scraper');
    chrome.runtime.onMessage.addListener(this.onPopupMessage.bind(this));
  }

  private async onPopupMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (request.action === 'webmunkExt.popup.successRegister') {
      await this.checkPrivacy();
    } else if (request.action === 'webmunkExt.worker.recordCookies') {
      await this.recordCookies();
    }
  }

  initialize() {
    (self as any).messenger.addReceiver('cookiesAppMgr', this);
  }

  private async checkPrivacy(): Promise<void> {
    const websites = chrome.privacy.websites as any;

    const privacySettings = {
      thirdPartyCookiesAllowed: (await websites.thirdPartyCookiesAllowed.get({})).value,
      topicsEnabled: (await websites.topicsEnabled.get({})).value,
      fledgeEnabled: (await websites.fledgeEnabled.get({})).value,
      adMeasurementEnabled: (await websites.adMeasurementEnabled.get({})).value,
    };

    this.eventEmitter.emit(moduleEvents.PRIVACY_SETTINGS, privacySettings);
  }

  private async recordCookies(): Promise<void> {
    if (await this.isCookiesRecorded()) return;

    const cookies = await chrome.cookies.getAll({});
    if (!cookies.length) return;

    const limitedCookies = this.getCookiesWithinSizeLimit(cookies);

    this.eventEmitter.emit(moduleEvents.COOKIES, { cookies: limitedCookies });
    await this.recordCookiesChecked();
  }

  private getCookiesWithinSizeLimit(cookies: chrome.cookies.Cookie[]): chrome.cookies.Cookie[] {
    // Maximum payload size allowed by Jitsu — 900KB
    const MAX_SIZE = 900_000;
    const getSizeInBytes = (obj: any) => new TextEncoder().encode(JSON.stringify(obj)).length;

    const limitedCookies: chrome.cookies.Cookie[] = [];
    let currentSize = getSizeInBytes({ cookies: [] });

    for (const cookie of cookies) {
      const cookieSize = getSizeInBytes(cookie);

      if (currentSize + cookieSize > MAX_SIZE) break;

      limitedCookies.push(cookie);
      currentSize += cookieSize;
    }

    return limitedCookies;
  }

  private async isCookiesRecorded(): Promise<boolean> {
    const { cookiesRecorded } = await chrome.storage.local.get('cookiesRecorded');

    return cookiesRecorded ?? false;
  }

  private async recordCookiesChecked(): Promise<void> {
    await chrome.storage.local.set({ cookiesRecorded: true });
  }
};