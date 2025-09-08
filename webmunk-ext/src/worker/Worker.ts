// dont remove next line, all webmunk modules use messenger utility
// @ts-ignore
import { messenger } from '@webmunk/utils';
import { NotificationService } from './NotificationService';
import { AdPersonalizationItem, PersonalizationConfigItem } from '../types';
import { DELAY_BETWEEN_REMOVE_NOTIFICATION, DELAY_BETWEEN_AD_PERSONALIZATION, UNINSTALL_URL } from '../config';
import { EventService } from './EventService';
import { FirebaseAppService } from './FirebaseAppService';
import { ConfigService } from './ConfigService';
import { DomainService } from './DomainService';
import { SurveyService } from './SurveyService';
import { ScreenshotService } from './ScreenshotService';
import XMLHttpRequest from 'xhr-shim';
import { NotificationText, UrlParameters, Event } from '../enums';
import { getActiveTabId, getInstalledExtensions, isNeedToDisableSurveyLoading, getTabInfo } from './utils';

// this is where you could import your webmunk modules worker scripts
import "@webmunk/extension-ads/worker";
import "@webmunk/cookies-scraper/worker";
import "@webmunk/ad-personalization/worker";

if (typeof window === "undefined") {
  // @ts-ignore
  global.window = self;
}

// @ts-ignore
(global as any)['XMLHttpRequest'] = XMLHttpRequest;

export class Worker {
  private readonly firebaseAppService: FirebaseAppService;
  private readonly configService: ConfigService;
  private readonly eventService: EventService;
  private readonly notificationService: NotificationService;
  private readonly surveyService: SurveyService;
  private readonly domainService: DomainService;
  private readonly screenshotService: ScreenshotService;
  private isAdPersonalizationChecking: boolean = false;

  constructor() {
    this.firebaseAppService = new FirebaseAppService();
    this.configService = new ConfigService(this.firebaseAppService);
    this.eventService = new EventService(this.firebaseAppService, this.configService);
    this.notificationService = new NotificationService();
    this.surveyService = new SurveyService(this.firebaseAppService, this.notificationService, this.eventService);
    this.domainService = new DomainService(this.configService, this.eventService);
    this.screenshotService = new ScreenshotService(this.eventService, this.domainService, this.firebaseAppService);
  }

  public async initialize(): Promise<void> {
    await this.firebaseAppService.login();
    await this.surveyService.initSurveysIfExists();
    await this.domainService.initExcludedDomains();

    messenger.addReceiver('appMgr', this);
    messenger.addModuleListener('ads-scraper', this.onModuleEvent.bind(this));
    messenger.addModuleListener('cookies-scraper', this.onModuleEvent.bind(this));
    messenger.addModuleListener('ad-personalization', this.onAdPersonalizationModuleEvent.bind(this));
    chrome.runtime.onMessage.addListener(this.onPopupMessage.bind(this),);
    chrome.tabs.onUpdated.addListener(this.onUrlTracking.bind(this));
  }

  private onAdPersonalizationModuleEvent(event: string, data: any): void {
    this.eventService.track(event, data);
  }

  private async login(prolificId: string): Promise<void> {
    const response: any = { action: 'webmunkExt.popup.loginRes' };

    try {
      const userData = await this.firebaseAppService.login(prolificId);
      response.data = userData;
    } catch (error: any) {
      response.error = error.message;
    }

    await chrome.runtime.sendMessage(response);
  }

  private async onModuleEvent(event: string, data: any): Promise<void> {
    if (await this.isExtensionHasToBeRemoved()) {
      await this.showRemoveExtensionNotification();
      return
    };

    if (event === Event.ADS_RATED) {
      const url = (await getTabInfo()).url;

      url && await this.screenshotService.makeScreenshotAdsRated(new URL(url));
    }

    await this.eventService.track(event, data);
  }

  private async middleware(): Promise<void> {
    if (!(await this.isUserExist())) return;

    await this.checkAdPersonalization();
    await this.domainService.trackExcludedDomains();
    await this.surveyService.initSurveysIfNeeded();
  }

  private async onPopupMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (request.action === 'webmunkExt.popup.loginReq') {
      await this.login(request.prolificId);
    } else if (request.action === 'webmunkExt.popup.successRegister') {
      await this.handleSuccessfulRegistration();
    } else if (request.action === 'page_action') {
      await this.screenshotService.makeScreenshotIfNeeded(new URL(request.url));
    }
  }

  private async handleSuccessfulRegistration(): Promise<void> {
    await this.surveyService.startWeekTiming();
    await this.trackInstalledExtensions();
    await this.trackProlificUserMapping();
    await this.setUninstallUrl();
  }

  private async setUninstallUrl(): Promise<void> {
    const user = await this.firebaseAppService.getUser();
    const prolificId = user.prolificId;

    chrome.runtime.setUninstallURL(`${UNINSTALL_URL}?key=webmunk&userId=${prolificId}`);
  }

  private async isNeedToCheckAdPersonalization(): Promise<boolean> {
    const personalizationConfigsResult = await chrome.storage.local.get('personalizationConfigs');
    const personalizationConfigs = personalizationConfigsResult.personalizationConfigs || {};
    const array: PersonalizationConfigItem[] = Object.entries(personalizationConfigs).map(([key, value]) => ({
      key,
      value: Boolean(value),
    }));

    const specifiedItem = array.find((config) => config.key === UrlParameters.ONLY_INFORMATION);

    if (specifiedItem && specifiedItem.value) return true;

    const adPersonalizationConfiguration = [
      UrlParameters.FACEBOOK,
      UrlParameters.GOOGLE_AND_YOUTUBE,
      UrlParameters.AMAZON
    ];

    const isAdPersonalizationConfiguration = array.some((config) => adPersonalizationConfiguration.includes(config.key as UrlParameters));

    return isAdPersonalizationConfiguration;
  }

  private async checkAdPersonalization(): Promise<void> {
    if (this.isAdPersonalizationChecking) return;
    this.isAdPersonalizationChecking = true;

    try {
      const isNeedToCheck = await this.isNeedToCheckAdPersonalization();
      if (!isNeedToCheck) return;

      const { personalizationTime = 0 } = await chrome.storage.local.get('personalizationTime');
      const delayBetweenAdPersonalization = Number(DELAY_BETWEEN_AD_PERSONALIZATION);
      const currentDate = Date.now();

      if (currentDate < delayBetweenAdPersonalization + personalizationTime) return;

      const adPersonalizationResult = await chrome.storage.local.get('adPersonalization.items');
      const adPersonalization: AdPersonalizationItem[] = adPersonalizationResult['adPersonalization.items'] || [];

      const tabId = await getActiveTabId();
      if (!tabId) return;

      adPersonalization.forEach((item) => {
        chrome.tabs.sendMessage(
          tabId,
          { action: 'webmunkExt.worker.notifyAdPersonalization', data: { key: item.key }},
          { frameId: 0 }
        );
      });

      await chrome.storage.local.set({ personalizationTime: currentDate });
    } finally {
      this.isAdPersonalizationChecking = false;
    }
  }

  private async isAllAdPersonalizationSettingsChecked(): Promise<boolean> {
    const adPersonalizationResult = await chrome.storage.local.get('adPersonalization.items');
    const adPersonalization: AdPersonalizationItem[] = adPersonalizationResult['adPersonalization.items'] || [];

    const checkedAdPersonalizationResult = await chrome.storage.local.get('adPersonalization.checkedItems');
    const checkedAdPersonalization = checkedAdPersonalizationResult['adPersonalization.checkedItems'] || {};

    return Object.keys(checkedAdPersonalization).length === adPersonalization.length;
  }

  private async isExtensionHasToBeRemoved(): Promise<boolean> {
    const completedSurveysResult = await chrome.storage.local.get('completedSurveys');
    const completedSurveys = completedSurveysResult.completedSurveys || [];
    const needToDisableSurveyLoading = await isNeedToDisableSurveyLoading();

    if (needToDisableSurveyLoading && await this.surveyService.isWeekPassed()) {
      return true;
    } else if ((completedSurveys.length === 2 && await this.isAllAdPersonalizationSettingsChecked())) {
      return true;
    }

    return false;
  }

  private async showRemoveExtensionNotification(): Promise<void> {
    const { removeModalShowed = 0 } = await chrome.storage.local.get('removeModalShowed');
    const currentDate = Date.now();
    const delayBetweenRemoveNotification = Number(DELAY_BETWEEN_REMOVE_NOTIFICATION);

    if (currentDate - removeModalShowed < delayBetweenRemoveNotification) return;

    const tabId = await getActiveTabId(true);
    if (!tabId) return;

    try {
      await this.notificationService.showNotification(tabId, NotificationText.REMOVE);
      await chrome.storage.local.set({ removeModalShowed: currentDate });
    } catch (error) {
      console.error("Failed to show rate notification:", error);
    }
  }

  private async onUrlTracking(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    if (await this.isExtensionHasToBeRemoved()) {
      await this.showRemoveExtensionNotification();
      return
    };

    if (!tab || !tab.url || changeInfo.status !== 'complete' || !(await this.isUserExist())) return;
    const observedUrl = new URL(tab.url);

    await this.middleware();
    await this.surveyService.isThisSurveyUrl(observedUrl);

    await this.trackUrlIfNeeded(observedUrl);

    await this.screenshotService.makeScreenshotIfNeeded(observedUrl);
  }

  private async trackUrlIfNeeded(url: URL): Promise<void> {
    const isExcluded = await this.domainService.isNeedToExcludeSpecifiedDomain(url);

    /**
     * Check if the hostname is 'hbs.qualtrics.com'.
     * This is needed because we exclude 'qualtrics.com',
     * but the 'hbs' subdomain should be tracked.
    */
    const isSpecialCase = url.hostname === 'hbs.qualtrics.com';

    if (isExcluded && !isSpecialCase) {
      await this.domainService.markExcludedDomainAsVisited(url.hostname);
      return;
    }

    await this.eventService.track(Event.URL_TRACKING, { url: url.href });
  }

  private async trackInstalledExtensions(): Promise<void> {
    const extensions = await getInstalledExtensions();

    await this.eventService.track(Event.INSTALLED_EXTENSIONS, { extensions });
  }

  private async trackProlificUserMapping(): Promise<void> {
    const user = await this.firebaseAppService.getUser();

    await this.eventService.track(Event.USER_MAPPING, { prolificId: user.prolificId });
  }

  private async isUserExist(): Promise<boolean> {
    return !!(await this.firebaseAppService.getUser());
  }
}