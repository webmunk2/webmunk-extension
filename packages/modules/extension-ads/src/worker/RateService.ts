export class RateService {
  private lastNotificationTimestamp: number;

  constructor() {
    this.lastNotificationTimestamp = 0;
    this.initializeLastNotificationTime();
  }

  private async initializeLastNotificationTime(): Promise<void> {
    const storedTimestamp = await this.getLastAdsRateNotificationTime();

    if (!storedTimestamp) {
      this.lastNotificationTimestamp = Date.now();
      await chrome.storage.local.set({ lastAdsRateNotificationTime: this.lastNotificationTimestamp });
    } else {
      this.lastNotificationTimestamp = storedTimestamp;
    }
  }

  private async shouldNotify(): Promise<boolean> {
    const currentTime = Date.now();

    // 20 min
    return currentTime - this.lastNotificationTimestamp >= 1200000;
  }

  private async getLastAdsRateNotificationTime(): Promise<number> {
    const result = await chrome.storage.local.get('lastAdsRateNotificationTime');
    return result.lastAdsRateNotificationTime || 0;
  }

  public async send(tabId: number): Promise<any> {
    if (!await this.shouldNotify()) return;

    this.lastNotificationTimestamp = Date.now();
    chrome.storage.local.set({ lastAdsRateNotificationTime: this.lastNotificationTimestamp });
    return new Promise((resolve, reject) => {
      const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.action === 'extensionAds.rateService.adRatingResponse') {
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onRemoved.removeListener(tabCloseListener);

          resolve(message.response);
        }
      };

      const tabCloseListener = (closedTabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
        if (closedTabId === tabId) {
          chrome.runtime.onMessage.removeListener(messageListener);
          reject(null);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      chrome.tabs.onRemoved.addListener(tabCloseListener);

      chrome.tabs.sendMessage(
        tabId,
        { action: 'extensionAds.rateService.adRatingRequest' },
        { frameId: 0 }
      );
    });
  }
}
