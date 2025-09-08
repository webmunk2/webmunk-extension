import { Event } from '../enums';
import { DomainService } from './DomainService';
import { EventService } from './EventService';
import { FirebaseAppService } from './FirebaseAppService';
import { getTabInfo } from './utils';

export class ScreenshotService {
  private lastScreenshot: number = 0;

  constructor(
    private readonly eventService: EventService,
    private readonly domainService: DomainService,
    private readonly firebaseAppService: FirebaseAppService
  ) {}

  public async makeScreenshotIfNeeded(url: URL): Promise<void> {
      if (await this.domainService.isNeedToExcludeSpecifiedDomain(url)) return;
      if (await this.isThereNotificationOnPage()) return;
      if (!this.isOneMinutePassed()) return;

      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 50 });
      const blob = this.dataURLToBlob(dataUrl);
      if (!blob) return;

      const firebaseUrl = await this.firebaseAppService.uploadScreenshotToFirebase(blob, Event.SCREEN_ANALYSIS);
      if (!firebaseUrl) return;

      const timestamp = new Date().toISOString();
      const response = await this.analyzeScreenshot(firebaseUrl);

      await this.eventService.track(Event.SCREEN_ANALYSIS, { timestamp, pageUrl: url.href, response });
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

  public async makeScreenshotAdsRated(url: URL): Promise<void> {
      if (await this.domainService.isNeedToExcludeSpecifiedDomain(url)) return;
      if (await this.isThereNotificationOnPage()) return;

      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 50 });
      const blob = this.dataURLToBlob(dataUrl);
      if (!blob) return;

      const firebaseUrl = await this.firebaseAppService.uploadScreenshotToFirebase(blob, Event.SCREEN_ANALYSIS);
      if (!firebaseUrl) return;

      const timestamp = new Date().toISOString();
      const response = await this.analyzeScreenshot(firebaseUrl);

      this.lastScreenshot = Date.now();

      await this.eventService.track(Event.SCREEN_ANALYSIS, { timestamp, pageUrl: url.href, response });
  }

  private isOneMinutePassed(): boolean {
    const currentDate = Date.now();
    const oneMinuteInMilliSeconds = 60000;

    if (currentDate - oneMinuteInMilliSeconds < this.lastScreenshot) return false;

    this.lastScreenshot = currentDate;
    return true;
  }

  private async analyzeScreenshot(dataUrl: string): Promise<string | undefined> {
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