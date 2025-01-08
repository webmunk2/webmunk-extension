import config from '../data/config.json';

interface Message {
  action: string;
  data: DataMessage;
}

interface DataMessage {
  key: string;
  isNeedToLogin?: boolean;
}

interface MessageResponse {
  response: {
    values: {
      currentValue: boolean;
      initialValue: boolean;
    };
    error?: string;
  };
  tabId: number;
}

enum moduleEvents {
  AD_PERSONALIZATION = 'ad_personalization',
}

export class AdPersonalizationWorker {
  private eventEmitter: any;
  private urlIndexes: { [key: string]: number } = {};

  constructor() {
    this.eventEmitter = (self as any).messenger.registerModule('ad-personalization');
  }

  public initialize() {
    (self as any).messenger.addReceiver('adPersonalization', this);
    chrome.runtime.onMessage.addListener(this.onPopupMessage.bind(this));
    this.initSettings();
  }

  private async onPopupMessage(request: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (request.action === 'webmunkExt.popup.checkSettingsReq') {
      await this.handleCheckSettingsRequest(request.data);
    }
  }

  private async handleCheckSettingsRequest(data: DataMessage) {
    const { key, isNeedToLogin } = data;
    let url = await this.getAccordantUrl(key);
    let hasError = false;
    let lastError: string | undefined = undefined;

    while (url) {
      const { response, tabId } = await this.send(key, url, isNeedToLogin);

      if (response.error) {
        await this.removeWorkingUrl(key);
        await this.removeCheckedItem(key);
        await chrome.tabs.remove(tabId);

        hasError = true;
        lastError = response.error;
        url = await this.getAccordantUrl(key, true);
      } else {
        await this.addWorkingUrl(key, url);
        await this.removeFromInvalidItems(key);

        this.eventEmitter.emit(moduleEvents.AD_PERSONALIZATION, { key, url, values: response.values });

        await chrome.tabs.remove(tabId);

        await this.addCheckedItem(key, response);

        break;
      }
    }

    if (hasError && !url) {
      await this.addToInvalidItems(key, lastError || 'Unknown error');
    }
  }

  private async initSettings() {
    const adPersonalization = config;
    await chrome.storage.local.set({ 'adPersonalization.items': adPersonalization });
  }

  private async getAccordantUrl(key: string, isNeedToUseNextUrl: boolean = false): Promise<string | null> {
    const selectedObject = config.find((object) => object.key === key)!;

    const storageData = await chrome.storage.local.get('adPersonalization.workingUrls');
    const workingUrls = storageData['adPersonalization.workingUrls'] || {};

    if (workingUrls[key]) {
      return workingUrls[key];
    }

    let currentIndex = this.urlIndexes[key] || 0;

    if (isNeedToUseNextUrl) {
      currentIndex += 1;

      if (currentIndex >= selectedObject.url.length) {
        return null;
      }
    }

    this.urlIndexes[key] = currentIndex;

    return selectedObject.url[currentIndex];
  }

  private async addToInvalidItems(key: string, error: string): Promise<void> {
    const invalidItemsResult = await chrome.storage.local.get('adPersonalization.invalidItems');
    const invalidItems = invalidItemsResult['adPersonalization.invalidItems'] || [];

    const existingItem = invalidItems.find((item: { key: string; error: string }) => item.key === key);

    if (!existingItem) {
      invalidItems.push({ key, error });
      await chrome.storage.local.set({ 'adPersonalization.invalidItems': invalidItems });
    }
  }

  private async removeFromInvalidItems(key: string): Promise<void> {
    const invalidItemsResult = await chrome.storage.local.get('adPersonalization.invalidItems');
    const invalidItems = invalidItemsResult['adPersonalization.invalidItems'] || [];

    const updatedInvalidItems = invalidItems.filter((item: { key: string; error: string }) => item.key !== key);

    await chrome.storage.local.set({ 'adPersonalization.invalidItems': updatedInvalidItems });
  }

  private async addWorkingUrl(key: string, url: string): Promise<void> {
    const storageData = await chrome.storage.local.get('adPersonalization.workingUrls');
    const workingUrls = storageData['adPersonalization.workingUrls'] || {};

    workingUrls[key] = url;

    await chrome.storage.local.set({ 'adPersonalization.workingUrls': workingUrls });
  }

  private async removeWorkingUrl(key: string): Promise<void> {
    const storageData = await chrome.storage.local.get('adPersonalization.workingUrls');
    const workingUrls = storageData['adPersonalization.workingUrls'] || {};

    if (workingUrls[key]) {
      delete workingUrls[key];
      await chrome.storage.local.set({ 'adPersonalization.workingUrls': workingUrls });
    }
  }

  private async addCheckedItem(key: string, response: any): Promise<void> {
    const checkedAdPersonalizationResult = await chrome.storage.local.get('adPersonalization.checkedItems');
    const checkedAdPersonalization = checkedAdPersonalizationResult['adPersonalization.checkedItems'] || {};

    checkedAdPersonalization[key] = response;

    await chrome.storage.local.set({ 'adPersonalization.checkedItems': checkedAdPersonalization });
  }

  private async removeCheckedItem(key: string): Promise<void> {
    const checkedAdPersonalizationResult = await chrome.storage.local.get('adPersonalization.checkedItems');
    const checkedAdPersonalization = checkedAdPersonalizationResult['adPersonalization.checkedItems'] || {};

    if (checkedAdPersonalization[key]) {
      delete checkedAdPersonalization[key];
      await chrome.storage.local.set({ 'adPersonalization.checkedItems': checkedAdPersonalization });
    }
  }

  private async getConfig(key: string): Promise<boolean | string> {
    const specifiedItemResult = await chrome.storage.local.get('personalizationConfigs');
    const specifiedItem = specifiedItemResult.personalizationConfigs || {};

    return specifiedItem[key];
  }

  private async send(key: string, url: string, isNeedToLogin?: boolean): Promise<MessageResponse> {
    const value = await this.getConfig(key);

    return new Promise((resolve, reject) => {
      let createdTabId: number | null = null;

      const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.action === 'adsPersonalization.strategies.settingsResponse' && sender.tab?.id === createdTabId) {
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve({ response: message.response, tabId: sender.tab.id });
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);

      chrome.tabs.create({ url: url }, (tab) => {
        if (tab && tab.id) {
          createdTabId = tab.id;

          chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            if (tabId === createdTabId && changeInfo.status === 'complete') {
              chrome.tabs.sendMessage(
                createdTabId,
                { action: 'adsPersonalization.strategies.settingsRequest', data: { key, value, url, isNeedToLogin } }
              );
            }
          });
        }
      });
    });
  }
}