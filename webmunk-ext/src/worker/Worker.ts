// dont remove next line, all webmunk modules use messenger utility
// @ts-ignore
import { messenger } from '@webmunk/utils';
import { NotificationService } from './NotificationService';
import { AdPersonalizationItem, User, PersonalizationConfigItem } from '../types';
import { DELAY_BETWEEN_REMOVE_NOTIFICATION, DELAY_BETWEEN_AD_PERSONALIZATION } from '../config';
import { RudderStackService } from './RudderStackService';
import { FirebaseAppService } from './FirebaseAppService';
import { ConfigService } from './ConfigService';
import { SurveyService } from './SurveyService';
import { NotificationText, UrlParameters, Event } from '../enums';
import { getActiveTabId, isNeedToDisableSurveyLoading } from './utils';

// this is where you could import your webmunk modules worker scripts
import "@webmunk/extension-ads/worker";
import "@webmunk/cookies-scraper/worker";
import "@webmunk/ad-personalization/worker";

if (typeof window === "undefined") {
  // @ts-ignore
  global.window = self;
}

export class Worker {
  private readonly firebaseAppService: FirebaseAppService;
  private readonly configService: ConfigService;
  private readonly rudderStack: RudderStackService;
  private readonly notificationService: NotificationService;
  private readonly surveyService: SurveyService;
  private isAdPersonalizationChecking: boolean = false;

  constructor() {
    this.firebaseAppService = new FirebaseAppService();
    this.configService = new ConfigService(this.firebaseAppService);
    this.rudderStack = new RudderStackService(this.firebaseAppService, this.configService);
    this.notificationService = new NotificationService();
    this.surveyService = new SurveyService(this.firebaseAppService, this.notificationService, this.rudderStack);
  }

  public async initialize(): Promise<void> {
    await this.firebaseAppService.login();
    await this.surveyService.initSurveysIfExists();

    messenger.addReceiver('appMgr', this);
    messenger.addModuleListener('ads-scraper', this.onModuleEvent.bind(this));
    messenger.addModuleListener('cookies-scraper', this.onModuleEvent.bind(this));
    messenger.addModuleListener('ad-personalization', this.onAdPersonalizationModuleEvent.bind(this));
    chrome.runtime.onMessage.addListener(this.onPopupMessage.bind(this),);
    chrome.tabs.onUpdated.addListener(this.onUrlTracking.bind(this));
  }

  private async onAdPersonalizationModuleEvent(event: string, data: any): Promise<void> {
    await this.rudderStack.track(event, data);
  }

  private async onModuleEvent(event: string, data: any): Promise<void> {
    if (await this.isExtensionHasToBeRemoved()) {
      await this.showRemoveExtensionNotification();
      return
    };

    await this.rudderStack.track(event, data);
  }

  private async middleware(): Promise<void> {
    const user = await this.firebaseAppService.getUser();

    if (!user || !user.active) return

    await this.checkAdPersonalization();
    await this.surveyService.initSurveysIfNeeded();
  }

  private async onPopupMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (request.action === 'webmunkExt.popup.loginReq') {
      const userData = await this.firebaseAppService.login(request.username);
      await chrome.runtime.sendMessage({ action: 'webmunkExt.popup.loginRes', data: userData });
    } else if (request.action === 'webmunkExt.popup.successRegister') {
      await this.surveyService.startWeekTiming();
    }
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

  private async isNeedToForceUserLogIn(): Promise<boolean> {
    const personalizationConfigsResult = await chrome.storage.local.get('personalizationConfigs');
    const personalizationConfigs = personalizationConfigsResult.personalizationConfigs || {};
    const specifiedItem = personalizationConfigs[UrlParameters.ONLY_INFORMATION] ?? false;

    const { personalizationTime = 0 } = await chrome.storage.local.get('personalizationTime');
    const completedSurveysResult = await chrome.storage.local.get('completedSurveys');
    const completedSurveys = completedSurveysResult.completedSurveys || [];

    if (personalizationTime === 0 && completedSurveys.length < 2 && specifiedItem === false) return true;

    return false;
  }

  private async checkAdPersonalization(): Promise<void> {
    if (this.isAdPersonalizationChecking) return;
    this.isAdPersonalizationChecking = true;

    try {
      const isNeedToCheck = await this.isNeedToCheckAdPersonalization();
      if (!isNeedToCheck) return;

      const isNeedToLogin = await this.isNeedToForceUserLogIn();

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
          { action: 'webmunkExt.worker.notifyAdPersonalization', data: { key: item.key, isNeedToLogin }},
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

    if (!tab || !tab.url || changeInfo.status !== 'complete') return;

    await this.middleware();
    await this.surveyService.isThisSurveyUrl(tab.url);

    await this.rudderStack.track(Event.URL_TRACKING, { url: tab.url });
  }
}