import { Event, ExcludedDomains } from '../enums';
import { ScreenshotResponse } from '../types';
import { ConfigService } from './ConfigService';
import { DomainService } from './DomainService';
import { EventService } from './EventService';
import { FirebaseAppService } from './FirebaseAppService';
import { RateService } from './RateService';
import { getTabInfo } from './utils';

export class ScreenshotService {
  private lastScreenshot: number = 0;

  constructor(
    private readonly eventService: EventService,
    private readonly domainService: DomainService,
    private readonly firebaseAppService: FirebaseAppService,
    private readonly configService: ConfigService,
    private readonly rateService: RateService
  ) {}

  public async makeScreenshotIfNeeded(url: URL): Promise<void> {
    if (await this.domainService.isNeedToExcludeSpecifiedDomain(url, ExcludedDomains.screenshots)) return;
    if (await this.isThereNotificationOnPage()) return;
    if (await this.isNeedToStopDataCollection()) return;
    if (!this.isOneMinutePassed()) return;

    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 50 });
    const tabUrl = (await getTabInfo()).url;
    const blob = this.dataURLToBlob(dataUrl);
    if (!blob) return;

    const firebaseUrl = await this.firebaseAppService.uploadScreenshotToFirebase(blob, Event.SCREEN_ANALYSIS);
    if (!firebaseUrl) return;

    const timestamp = new Date().toISOString();
    const response = await this.analyzeScreenshot(firebaseUrl);

    await this.eventService.track(Event.SCREEN_ANALYSIS, { timestamp, pageUrl: tabUrl, response });

    if (response?.result !== '0') await this.rateService.send((await getTabInfo()).id!, timestamp);
  }

  private async isThereNotificationOnPage(): Promise<boolean> {
    const tabId = (await getTabInfo()).id;

    return new Promise((resolve) => {
      const messageListener = (request: any): void => {
        if (request.action === 'webmunkExt.notificationService.isThereNotificationRes') {
          resolve(request.result);
          chrome.runtime.onMessage.removeListener(messageListener);
        }
      }

      chrome.runtime.onMessage.addListener(messageListener);

      chrome.tabs.sendMessage(tabId!, { action: 'webmunkExt.screenshotService.isThereNotificationReq' }, { frameId: 0 });
    })
  }

  private async isNeedToStopDataCollection(): Promise<boolean> {
    const user = await this.firebaseAppService.getUser();

    const stopConfig = await this.configService.getConfigByKey('stopDataCollection');
    const isGlobalStop = stopConfig === true || stopConfig === 'true';

    const usersConfig = await this.configService.getConfigByKey('stopDataCollectionForSpecifiedUsers');
    const stoppedUserIds = JSON.parse(usersConfig || '[]');

    const isUserStopped = stoppedUserIds.includes(user.uid);

    return isGlobalStop || isUserStopped;
  }

  private isOneMinutePassed(): boolean {
    const currentDate = Date.now();
    const oneMinuteInMilliSeconds = 60000;

    if (currentDate - oneMinuteInMilliSeconds < this.lastScreenshot) return false;

    this.lastScreenshot = currentDate;
    return true;
  }

  private async analyzeScreenshot(dataUrl: string): Promise<ScreenshotResponse | undefined> {
    const response = await fetch('https://analyzescreenshot-wuagwq3jva-uc.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    })

    const data = await response.json();

    return data;
  }

  private dataURLToBlob(dataUrl: string): Blob | null {
    const parts = dataUrl.split(',');
    const metaMatch = parts[0].match(/:(.*?);/);

    if (!metaMatch) return null;

    const mimeType = metaMatch[1];
    const base64String = parts[1];
    const binaryString = atob(base64String);

    const byteLength = binaryString.length;
    const byteArray = new Uint8Array(byteLength);

    for (let i = 0; i < byteLength; i++) {
      byteArray[i] = binaryString.charCodeAt(i);
    }

    return new Blob([byteArray], { type: mimeType });
  }
}