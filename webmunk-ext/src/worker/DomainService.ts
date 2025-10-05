import { ConfigService } from './ConfigService';
import { EventService } from './EventService';
import { Event, ExcludedDomains } from '../enums';
import { type FirebaseConfig } from './FirebaseRemoteConfig';
import { DELAY_BETWEEN_EXCLUDED_VISITED_DOMAINS } from '../config';

export class DomainService {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventService: EventService
  ) {}

  public async isNeedToExcludeSpecifiedDomain(url: URL, config: keyof FirebaseConfig): Promise<boolean> {
    const domains = await this.getExcludedDomains(config);

    const hostname = url.hostname;
    const href = url.href;

    const isExcluded = domains.some((domain) =>
      hostname === domain ||
      hostname.endsWith(`.${domain}`) ||
      href.startsWith(domain));

    return isExcluded;
  }

  public async getExcludedDomains(config: keyof FirebaseConfig): Promise<string[]> {
    const storageData = await chrome.storage.local.get(config);

    return storageData[config] || [];
  }

  public async markExcludedDomainAsVisited(domain: string): Promise<void> {
    const visits = await this.getVisitedDomains();

    visits[domain] = (visits[domain] || 0) + 1;

    await chrome.storage.local.set({ excludedDomainVisits: visits });
  }

  public async initExcludedDomains(config: keyof FirebaseConfig): Promise<void> {
    const excludedDomainsString = await this.configService.getConfigByKey(config);
    const newDomains: string[] = excludedDomainsString ? JSON.parse(excludedDomainsString) : [];

    if (config === ExcludedDomains.url_tracking) await this.startDayTiming();
    await this.saveExcludedDomainsIfNeeded(newDomains, config);
  }

  public async trackExcludedDomains(): Promise<void> {
    const visits = await this.getVisitedDomains();

    if (!Object.keys(visits).length) return;

    if (!(await this.isDayPassed())) return;

    await this.clearVisitedDomains();
    await this.initExcludedDomains(ExcludedDomains.url_tracking);
    await this.initExcludedDomains(ExcludedDomains.screenshots);
    await this.eventService.track(Event.EXCLUDED_DOMAINS_VISIT, { visits });
  }

  private async saveExcludedDomainsIfNeeded(newDomains: string[], config: keyof FirebaseConfig): Promise<void> {
    const storageData = await chrome.storage.local.get(config);
    const savedDomains: string[] = storageData[config] || [];

    if (!savedDomains.length || this.isUpdateNeeded(savedDomains, newDomains)) {
      await chrome.storage.local.set({ [config]: newDomains });
    }
  }

  private isUpdateNeeded(savedDomains: string[], newDomains: string[]): boolean {
    if (savedDomains.length !== newDomains.length) return true;

    const savedSet = new Set(savedDomains);
    return newDomains.some((domain) => !savedSet.has(domain));
  }

  private async getVisitedDomains(): Promise<Record<string, number>> {
    const { excludedDomainVisits } = await chrome.storage.local.get('excludedDomainVisits');

    return excludedDomainVisits || {};
  }

  private async clearVisitedDomains(): Promise<void> {
    await chrome.storage.local.remove('excludedDomainVisits');
  }

  private async startDayTiming(): Promise<void> {
    const currentDate = Date.now();
    const delay = Number(DELAY_BETWEEN_EXCLUDED_VISITED_DOMAINS);

    const endTime = currentDate + delay;

    await chrome.storage.local.set({ dayEndTime: endTime });
  }

  private async isDayPassed(): Promise<boolean> {
    const { dayEndTime } = await chrome.storage.local.get('dayEndTime');
    const currentTime = Date.now();

    return currentTime >= dayEndTime;
  }
}
