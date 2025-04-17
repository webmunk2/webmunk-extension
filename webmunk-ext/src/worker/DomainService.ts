import { ConfigService } from './ConfigService';
import { JitsuService } from './JitsuService';
import { Event } from '../enums';
import { DELAY_BETWEEN_EXCLUDED_VISITED_DOMAINS } from '../config';

export class DomainService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jitsuService: JitsuService
  ) {}

  public async getExcludedDomains(): Promise<string[]> {
    const storageData = await chrome.storage.local.get('excludedDomains');

    return storageData.excludedDomains || [];
  }

  public async markExcludedDomainAsVisited(domain: string): Promise<void> {
    const visits = await this.getVisitedDomains();

    visits[domain] = (visits[domain] || 0) + 1;

    await chrome.storage.local.set({ excludedDomainVisits: visits });
  }

  public async initExcludedDomains(): Promise<void> {
    const excludedDomainsString = await this.configService.getConfigByKey('excludedDomains');
    const newDomains: string[] = excludedDomainsString ? JSON.parse(excludedDomainsString) : [];

    await this.startDayTiming();
    await this.saveExcludedDomainsIfNeeded(newDomains);
  }

  public async trackExcludedDomains(): Promise<void> {
    const visits = await this.getVisitedDomains();

    if (!Object.keys(visits).length) return;

    if (!(await this.isDayPassed())) return;

    await this.clearVisitedDomains();
    await this.initExcludedDomains();
    await this.jitsuService.track(Event.EXCLUDED_DOMAINS_VISIT, { visits });
  }

  private async saveExcludedDomainsIfNeeded(newDomains: string[]): Promise<void> {
    const storageData = await chrome.storage.local.get('excludedDomains');
    const savedDomains: string[] = storageData.excludedDomains || [];

    if (!savedDomains.length || this.isUpdateNeeded(savedDomains, newDomains)) {
      await chrome.storage.local.set({ excludedDomains: newDomains });
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
