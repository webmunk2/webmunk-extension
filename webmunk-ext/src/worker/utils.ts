import { UrlParameters } from '../enums';

// if ab(ad blocker) parameter is true, then we disable the loading of all surveys except the first one
export const isNeedToDisableSurveyLoading = async (): Promise<boolean> => {
  const personalizationConfigsResult = await chrome.storage.local.get('personalizationConfigs');
  const personalizationConfigs = personalizationConfigsResult.personalizationConfigs || {};
  const specifiedItem = personalizationConfigs[UrlParameters.AD_BLOCKER] ?? false;

  if (specifiedItem) return true;

  return false;
}

export const getActiveTabId = async (isNeedToCheckUrl?: boolean): Promise<number> => {
  const excludedUrls = ['facebook.com/ad_preferences/ad_settings/data_from_partners', 'myadcenter.google.com', 'amazon.com/adprefs'];

  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];

      if (isNeedToCheckUrl) {
        if (excludedUrls.some((url) => tab.url?.includes(url))) {
          resolve(0)
          return;
        };
      }

      if (!tab || !tab.id || tab.url?.startsWith('chrome://')) {
        resolve(0);
      } else {
        resolve(tab.id);
      }
    });
  })
};

