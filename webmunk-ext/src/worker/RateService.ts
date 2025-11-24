import { Event, RateType } from '../enums';
import { EventService } from './EventService';
import { DELAY_BETWEEN_AD_RATING_POPUP, DELAY_BETWEEN_SURVEY } from '../config';

const DAILY_POPUP_LIMIT = 15;

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

  private async isSurveyBlocked(): Promise<boolean> {
    const { completedSurveys = [], weekEndTime = 0 } = await chrome.storage.local.get([
      'completedSurveys',
      'weekEndTime'
    ]);
  
    if (completedSurveys.length === 0 || completedSurveys.length === 2) return false;
  
    const now = Date.now();
    const firstWeekEndTime = weekEndTime - Number(DELAY_BETWEEN_SURVEY);

    if (completedSurveys.length === 1 && now <= firstWeekEndTime) {
      return false; 
    }
  
    return true;
  }

  private async isExtensionHasToBeRemoved(): Promise<boolean> {
    const result = await chrome.storage.local.get('removeModalShowed');
    return result.removeModalShowed || false;
  }

  private async shouldNotify(): Promise<boolean> {
    if (await this.isExtensionHasToBeRemoved()) return false;
    if (await this.isSurveyBlocked()) return false;
    if (await this.hasReachedDailyLimit()) return false;

    const currentTime = Date.now();
    return currentTime - this.lastNotificationTimestamp >= Number(DELAY_BETWEEN_AD_RATING_POPUP);
  }

  private async getLastAdsRateNotificationTime(): Promise<number> {
    const result = await chrome.storage.local.get('lastAdsRateNotificationTime');
    return result.lastAdsRateNotificationTime || 0;
  }

  private async getLastRateType(): Promise<RateType> {
    const result = await chrome.storage.local.get('lastRateType');
    return result.lastRateType || RateType.distraction;
  }

  private async getPopupData(): Promise<{ date: string | null, count: number }> {
    const result = await chrome.storage.local.get('popupData');
    return result.popupData || { date: null, count: 0 };
  }

  private async toggleRateType(): Promise<RateType> {
    const lastType = await this.getLastRateType();
    const newType = lastType === RateType.relevance ? RateType.distraction : RateType.relevance;

    await chrome.storage.local.set({ lastRateType: newType });
    return newType;
  }

  private async hasReachedDailyLimit(): Promise<boolean> {
    const data = await this.getPopupData();
    const today = new Date().toISOString().slice(0, 10);
  
    if (data.date !== today) {
      await chrome.storage.local.set({ popupData: { date: today, count: 0 }});

      return false;
    }
  
    return data.count >= DAILY_POPUP_LIMIT;
  }

  private async incrementDailyCount(): Promise<void> {
    const data = await this.getPopupData();

    await chrome.storage.local.set({ popupData: { ...data, count: data.count + 1 }});
  }

  private async trackAdsRated(
    response: string,
    screenshotTimestamp: string,
    type: RateType
  ): Promise<void> {
    await this.eventService.track(Event.ADS_RATED, {
      mark: response,
      screenshotTimestamp,
      version: type,
    });
  }

  public async send(tabId: number, screenshotTimestamp: string): Promise<any> {
    if (!(await this.shouldNotify())) return;

    this.lastNotificationTimestamp = Date.now();
    await chrome.storage.local.set({ lastAdsRateNotificationTime: this.lastNotificationTimestamp });

    const type = await this.toggleRateType();

    return new Promise<void>((resolve) => {
      const messageAction = `webmunkExt.rateService.adRatingResponse_${screenshotTimestamp}`;

      const messageListener = async (message: any) => {
        if (message.action === messageAction) {
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onRemoved.removeListener(tabCloseListener);

          await this.trackAdsRated(message.response, screenshotTimestamp, type);

          if (message.response !== 'skip') {
            await this.incrementDailyCount();
          }

          resolve();
        }
      };

      const tabCloseListener = async (closedTabId: number) => {
        if (closedTabId === tabId) {
          chrome.runtime.onMessage.removeListener(messageListener);
          await this.trackAdsRated('pageWasClosed', screenshotTimestamp, type);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      chrome.tabs.onRemoved.addListener(tabCloseListener);

      chrome.tabs.sendMessage(
        tabId,
        {
          action: 'webmunkExt.rateService.adRatingRequest',
          timestamp: screenshotTimestamp,
          type,
        },
        { frameId: 0 }
      );
    });
  }
}