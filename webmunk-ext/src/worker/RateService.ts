import { Event } from '../enums';
import { EventService } from './EventService';
import { DELAY_BETWEEN_AD_RATING_POPUP } from '../config';
import { RateResponses } from '../types';

export class RateService {
  private lastNotificationTimestamp: number;

  constructor(private readonly eventService: EventService) {
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

  private async isExtensionHasToBeRemoved(): Promise<boolean> {
    const result = await chrome.storage.local.get('removeModalShowed');

    return result.removeModalShowed || false;
  }

  private async shouldNotify(): Promise<boolean> {
    if (await this.isExtensionHasToBeRemoved()) return false;

    const currentTime = Date.now();

    // 10 min
    return currentTime - this.lastNotificationTimestamp >= Number(DELAY_BETWEEN_AD_RATING_POPUP);
  }

  private async getLastAdsRateNotificationTime(): Promise<number> {
    const result = await chrome.storage.local.get('lastAdsRateNotificationTime');
    return result.lastAdsRateNotificationTime || 0;
  }

  private async trackAdsRated(response: RateResponses | string, screenshotTimestamp: string): Promise<void> {
    await this.eventService.track(Event.ADS_RATED, { mark: response, screenshotTimestamp });
  }

  public async send(tabId: number, screenshotTimestamp: string): Promise<any> {
    if (!await this.shouldNotify()) return;

    this.lastNotificationTimestamp = Date.now();
    chrome.storage.local.set({ lastAdsRateNotificationTime: this.lastNotificationTimestamp });
    return new Promise<void>((resolve, reject) => {
      const messageAction = `webmunkExt.rateService.adRatingResponse_${screenshotTimestamp}`;
      const messageListener = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.action === messageAction) {
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onRemoved.removeListener(tabCloseListener);

          await this.trackAdsRated(message.response, screenshotTimestamp);

          resolve();
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
        { action: 'webmunkExt.rateService.adRatingRequest', timestamp: screenshotTimestamp },
        { frameId: 0 }
      );
    });
  }
}
