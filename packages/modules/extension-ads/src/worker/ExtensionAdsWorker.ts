import TimeThrottler from './throttler.js';
import webRequest from './traffic.js';
// @ts-ignore
import filtersData from './url-filter.json';
import cosmeticFilteringEngine from './cosmetic-filtering.js';
import hostUrlFilters from './host-url-filter.json';
import {
  domainFromHostname,
  hostnameFromURI,
  entityFromDomain,
} from './uri-utils.js';

type AdData = {
  adId: string;
  title: string;
  text: string;
  content: Array<{ src?: string; href?: string; type: string }>;
  coordinates: any;
  redirectedUrl: string | null
};

type ProcessedAdData = {
  title: string;
  company: string;
  adId: string;
  text: string;
  coordinates: any;
  initialUrl: string;
  redirected: boolean;
  redirectedUrl: string | null;
  content: any[];
  sentAt?: number;
};

type TabData = {
  ads: Map<string, ProcessedAdData>;
  title: string | undefined;
  url: string | undefined;
  status: string | undefined;
  prevUrl: string | null | undefined;
};

type EventData = {
  pageUrl: string;
  title: string;
  company: string;
  text: string;
  coordinates: any;
  initialUrl: string;
  redirected: boolean;
  redirectedUrl: string | null;
  content: any[];
  adId: string;
};

enum moduleEvents {
  AD_DETECTED = 'ad_detected',
  AD_CLICKED = 'ad_clicked',
  ADS_RATED = 'ads_rated',
};

export class ExtensionAdsWorker {
  private tabData: Record<number, TabData> = {};
  private throttler: TimeThrottler;
  private eventEmitter: any;
  private lastClickTime: number | null = null;

  constructor () {
    this.throttler = new TimeThrottler(1, 200);
    this.eventEmitter = (self as any).messenger.registerModule('ads-scraper');
  }

  public initialize(): void {
    (self as any).messenger.addReceiver('extensionAdsAppMgr', this);
    chrome.tabs.onRemoved.addListener((tabId) => this.handleTabRemoved(tabId));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => this.handleTabUpdated(tabId, changeInfo, tab));
  }

  private handleTabRemoved(tabId: number): void {
    delete this.tabData[tabId];
  }

  private handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    const { title, url, status, openerTabId } = tab;

    if (!this.tabData[tabId]) {
      const prevUrl = openerTabId && this.tabData[openerTabId] ? this.tabData[openerTabId].url : null;
      this.tabData[tabId] = { ads: new Map(), title, url, status, prevUrl };
    } else if (status === 'loading') {
        if (this.tabData[tabId].url !== url) {
          this.tabData[tabId].prevUrl = this.tabData[tabId].url;
        }
        this.tabData[tabId].ads.clear();
    }

    this.tabData[tabId] = { ...this.tabData[tabId], title, url, status };
  }

  public async captureRegion(): Promise<{ success: boolean; imageUri: string }> {
    const imageUri = await chrome.tabs.captureVisibleTab();

    return { success: true, imageUri };
  }

  public _onMessage_isFrameAnAd(_request: any, from: chrome.runtime.MessageSender): any {
    return chrome.tabs.sendMessage(from.tab!.id!, { action: "isFrameAnAd", frameId: from.frameId });
  }

  public async testRedirect(url: string): Promise<{ redirected: boolean; redirectedUrl: string | null }> {
    const result: { redirected: boolean; redirectedUrl: string | null } = {
      redirected: false,
      redirectedUrl: null
    };

    try {
      const res = await fetch(url);

      if (res.redirected) {
        result.redirected = true;
        result.redirectedUrl = res.url.replace(/\\+/g, '');
      } else {
        const match = (await res.text()).match(/document\.location\.replace\("(.*)"\)/);
        if (match && match[1]) {
          result.redirected = true;
          result.redirectedUrl = match[1].replace(/\\+/g, '');
        }
      }
    } catch (error) {
      console.warn(`Exception fetching for redirects ${url}`, error);
    }

    return result;
  }

  public _onMessage_youAreAFrameAd(data: any, from: chrome.runtime.MessageSender): void {
    chrome.tabs.sendMessage(from.tab!.id!, { action: "youAreAFrameAd" }, { frameId: data.frameId });
  }

  private normalizeUrl(url: string, tabUrl: string): string {
    try {
      const normalizedUrl = url.trim().replace(/(\s\d+x,?)/g, '');

      switch (true) {
        case (normalizedUrl.startsWith('//')): {
          const protocol = /^((http|https):)/.exec(tabUrl);
          return protocol ? protocol[1] + normalizedUrl : normalizedUrl;
        }
        case (normalizedUrl.startsWith('/')): {
          const origin = /^(.*?:\/\/[^\/]+)/.exec(tabUrl);
          return origin ? origin[1] + normalizedUrl : normalizedUrl;
        }
        case (normalizedUrl.startsWith('url(')): {
          const matches = /url\('(.*)'\)/.exec(normalizedUrl);
          return matches && matches[1] ? matches[1] : normalizedUrl;
        }
        case (normalizedUrl.startsWith('blob:')): {
          return normalizedUrl.slice(5);
        }
        default: {
          return normalizedUrl;
        }
    }
    } catch (error) {

      console.warn('Exception occurred while normalizing URL: ', error);
      return url;
    }
  }

  private contentFilterPredicate(item: { src?: string; href?: string }): boolean {
    const filters = filtersData.filters;
    const url = item.src || item.href;

     // Check if the URL contains any of the filter strings
    return !!url && !filters.some((filter) => url.includes(filter));
  }

  private async processAdData({ title, text, content, coordinates, adId, redirectedUrl }: AdData,
    tabUrl: string,
    clickedUrl?: string | null
    ): Promise<ProcessedAdData | void>  {
    const uniqueUrls = new Set();
    const allowedRedirectTypes = ['a', 'div'];
    const filteredContent = content.filter(this.contentFilterPredicate);

    const processedContent = await Promise.all(
      filteredContent.map(async (item: any) => {
        const itemUrl = item.src || item.href;
        const normalizedUrl = this.normalizeUrl(itemUrl, tabUrl);

        if (uniqueUrls.has(normalizedUrl)) return;

        uniqueUrls.add(normalizedUrl);

        let redirectResult = {};

        if (allowedRedirectTypes.includes(item.type)) {
          redirectResult = await this.testRedirect(normalizedUrl);
        }

        return { ...item, ...redirectResult, initialUrl: normalizedUrl };
      })
    );

    // Filter out any null values due to errors
    const filteredProcessedContent = processedContent.filter(result => !!result);

    if (!filteredProcessedContent.length) return;

    // processedContent should already be properly sorted on the content script side, but we might need to add sorting here as well
    const successRedirectItem = filteredProcessedContent.find((item) => item.redirected);

    const clickedItem = clickedUrl
      && filteredProcessedContent.find((item) => item.initialUrl === clickedUrl);

    if (clickedUrl && !clickedItem) {
      console.warn('Clicked content is not found!');
    }

    const mainContentItem = clickedItem || successRedirectItem || filteredProcessedContent[0];
    const company = this.getCompanyName(mainContentItem.redirectedUrl || mainContentItem.initialUrl, title);

    return {
      title,
      company,
      adId,
      text,
      coordinates,
      initialUrl: mainContentItem.initialUrl,
      redirected: mainContentItem.redirected,
      redirectedUrl,
      content: filteredProcessedContent,
    };
  }

  private getCompanyName(url: string, title: string): string {
    const domain = new URL(url).hostname?.replace('www.', '');
    const mainDomain = domain ? domain.split('.')[0] : '';

    // Based on research, domains with a length <=3 characters are typically not company names,
    // but common domain extensions (e.g., com, net, org, ru, ua).
    if (mainDomain.length <= 3) {
      const sanitizedTitle = title.toLowerCase().replace(/(?<=\S)[^\w\s]+(?=\S)/gi, '');

      return this.formatToPascalCase(sanitizedTitle);
    }

    return this.formatToPascalCase(mainDomain);
  }

  private formatToPascalCase(text: string): string {
    return text
      .split(/[_.-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  private prepareEventData(adData: ProcessedAdData, pageUrl: string): EventData {
    const {
      title,
      adId,
      company,
      text,
      coordinates,
      initialUrl,
      redirected,
      redirectedUrl,
      content,
    } = adData;

    return { pageUrl: pageUrl, title, company, text, coordinates, initialUrl, redirected, redirectedUrl, content, adId };
  }

  private sendAdsIfNeeded(tabId: number): void {
    if (!this.tabData[tabId].ads.size) return;

    const newAds = Array.from(this.tabData[tabId].ads.values()).filter(ad => !ad.sentAt)

    if (!newAds.length) return;

    newAds.forEach((ad) => {
      const eventData = this.prepareEventData(ad, this.tabData[tabId].url!);
      this.eventEmitter.emit(moduleEvents.AD_DETECTED, eventData);
      ad.sentAt = Date.now();
    })
  }

  private isAdBlockNotValid(adData: AdData[]): boolean {
    const filters = hostUrlFilters.filters;

    return adData.some((ad) => {
      return ad.content.some((item) => {
        const url = item.src || item.href;

        if (url && filters.some((filter) => url.startsWith(filter))) {
          return true;
        }

        return false;
      });
    });
  }

  public async _onMessage_adContent(data: { meta: any; adsData: AdData[] }, from: { tab: { id: number; url: string } }): Promise<void> {
    const { id: tabId, url: tabUrl } = from.tab;
    const { meta, adsData } = data;

    if (!adsData.length) return;

    for (const adData of adsData) {
      if (!this.isAdBlockNotValid([adData])) {
        const result = await this.processAdData(adData, tabUrl, null);
        if (!result) continue;

        this.tabData[tabId].ads.set(result.initialUrl, result);

        // console.log(`%cReceiving ad from tab ${tabId} - ${tabUrl}, ads detected: ${this.tabData[tabId].ads.size}`, 'color: green; font-weight: bold');
        // console.log('Tab data:', this.tabData[tabId]);
        this.sendAdsIfNeeded(tabId);
      }
    }
  }

  public async _onMessage_adClicked(data: { clickedUrl: string, adId: string }, from: { tab: { id: number; url: string } }): Promise<void> {
    const { id: tabId, url: tabUrl } = from.tab;
    const { clickedUrl, adId } = data;

    const now = Date.now();

    if (this.lastClickTime && now - this.lastClickTime < 1000) {
      return;
    }

    this.lastClickTime = now;

    if (clickedUrl || adId) {
        // console.log(`%cUser clicked on an url: ${clickedUrl}, id: ${adId}`, 'color: orange; font-weight: bold');
        this.eventEmitter.emit(moduleEvents.AD_CLICKED, { adId, clickedUrl, pageUrl: tabUrl });
    } else {
        // console.log("No tracked ad found for clicked URL.");
    }
  }

  public _onMessage_captureRegion(request: any, _from: chrome.runtime.MessageSender): any {
    return this.throttler.add(async () => {
      return this.captureRegion();
    }).then(result => {
      console.log(result);
      return result;
    });
  }

  public _onMessage_getAllFrames(_request: any, from: chrome.runtime.MessageSender): chrome.webNavigation.GetFrameDetails[] {
    const frames: any = chrome.webNavigation.getAllFrames({ tabId: from.tab!.id! });
    return frames.filter((f: any) => f.frameId !== 0);
  }

  public async _onMessage_isDisplayNone(_request: any, from: chrome.runtime.MessageSender): Promise<{ success: boolean; isAd: boolean; isDisplayNone?: boolean }> {
    return chrome.webNavigation.getAllFrames({tabId:from.tab!.id!}).then(async frames => {
      let result: { success: boolean; isAd: boolean; isDisplayNone?: boolean } = { success: true, isAd: false };
        let path = [from.frameId+"/false"];
        let cont = true;
        let myself = frames?.find(f => f.frameId==from.frameId);
        while (cont){
          result = await (self as any).messenger?.sendToMainPage(from.tab!.id, "content", "isDisplayNone", from.frameId, myself?.parentFrameId)
          path.unshift(myself?.parentFrameId+"/"+result.isDisplayNone)
          if (result.isDisplayNone){
              result =  {success: true, isAd: true, isDisplayNone: true};
              cont = false;
          }
          else{
              if (myself?.parentFrameId == 0) cont = false;
              myself = frames?.find(f => f.frameId==myself?.parentFrameId);
          }
        }
        // console.log(`_onMessage_isDisplayNone ${JSON.stringify(path)} => ${result.isDisplayNone}`)
        return result;
    });
  }

  public async _onMessage_parentFrameIsAnAd(_request: any, from: chrome.runtime.MessageSender): Promise<{ success: boolean; isAd: boolean }> {
    return chrome.webNavigation.getAllFrames({tabId: from.tab!.id!}).then(async frames => {
      let result ={success: true, isAd: false};
      let path = [from.frameId+"/false"];
      let cont = true;
      let myself = frames?.find(f => f.frameId==from.frameId);

      while (cont) {
        if (myself?.parentFrameId ==0) {
          result = await (self as any).messenger?.sendToMainPage(from.tab!.id, "content", "isFrameAnAd", from.frameId, 0)
          path.unshift("0/"+(result.success ? result.isAd:"unknown"))
          cont = false;
        } else {
          result = await (self as any).messenger?.sendToMainPage(from.tab!.id, "content", "areYouAnAd", {}, myself?.parentFrameId)
          path.unshift(myself?.parentFrameId+"/"+result.isAd)

          if (result.isAd){
            result =  {success: true, isAd: true};
            cont = false;
          } else {
            myself = frames?.find(f => f.frameId == myself?.parentFrameId);
          }
        }
      }
        // console.log(`_onMessage_parentFrameIsAnAd ${JSON.stringify(path)} => ${result.isAd}`)
      return result;
    })
  }

  public _onMessage_retrieveContentScriptParameters(request: any, _from: chrome.runtime.MessageSender): void {
    console.log("retrieveContentScriptParameters receiving message", request)
    const response = {
      collapseBlocked: true, //µb.userSettings.collapseBlocked,
      noGenericCosmeticFiltering: false,
      noSpecificCosmeticFiltering: false,
      specificCosmeticFilters: {},
    };

    const tabId = _from.tab?.id;
    const frameId = _from.frameId;

    request.tabId = tabId;
    request.frameId = frameId;
    request.hostname = hostnameFromURI(request.url);
    request.domain = domainFromHostname(request.hostname);
    request.entity = entityFromDomain(request.domain);

    const scf = response.specificCosmeticFilters =
      cosmeticFilteringEngine.retrieveSpecificSelectors(request, response);
  }

  public async _onMessage_adDetected(request: { frameIds: Set<number>; main: any }, _from: chrome.runtime.MessageSender): Promise<{ success: boolean; result: { main: any; frames: any[] } }> {
    const results: any[] = [];
    const frameIdArray = Array.from(request.frameIds);

    for (let i = 0; i < frameIdArray.length; i++) {
        const frameId = frameIdArray[i];
        const result = await chrome.tabs.sendMessage(_from.tab!.id!, { action: "getIframeContent" }, { frameId });
        results.push(result);
    }

    return { success: true, result: { main: request.main, frames: results } };
  }

  public async _onMessage_isUrlAnAds(request: { href?: string; src?: string }, from: chrome.runtime.MessageSender): Promise<{ success: boolean; urlIsAnAd: boolean }>{
    const details: {
      tabId: number;
      type: string;
      method: string;
      requestId: number;
      url?: string;
     } = {
      ...from,
      tabId: from.tab!.id!,
      type: "main_frame",
      method: "GET",
      requestId: Math.ceil(Math.random() * 1000000)
    };

    let urlRefIsAnAd = false

    if (request.href){
      details.url = request.href
      urlRefIsAnAd = webRequest.testUrl(details)
    }

    let urlSrcIsAnAd = false;

    if (request.src){
      details.url = request.src
      urlSrcIsAnAd = webRequest.testUrl(details)
    }
    return {success:true, urlIsAnAd: urlRefIsAnAd || urlSrcIsAnAd}
  }

  public setPossibleAssetsPaths(paths: string[]): void {
    // @ts-ignore
    if (self.µBlock && self.µBlock.setPossibleAssetsPaths) self.µBlock.setPossibleAssetsPaths(paths);
    else console.warn("EXCEPTION: extensionAdsAppMgr: no method for setting remote assets.json path")
  }
};