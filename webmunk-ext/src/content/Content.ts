import { NotificationService } from './NotificationService';
import { RateService } from './RateService';

export class Content {
  private lastScrollSent = 0;
  private readonly SCROLL_THROTTLE_MS = 1000;
  private readonly notificationService: NotificationService;
  private readonly rateService: RateService;

  constructor () {
    this.notificationService = new NotificationService();
    this.rateService = new RateService();
  }

  public initialize(): void {
    this.addScrollListener();
    this.addClickListener();
  }

  private addScrollListener(): void {
    window.addEventListener('scroll', () => {
      const now = Date.now();

      if (now - this.lastScrollSent > this.SCROLL_THROTTLE_MS) {
        this.lastScrollSent = now;
        chrome.runtime.sendMessage({ action: 'page_action', url: window.location.href });
      }
    });
  }

  private addClickListener(): void {
    window.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'page_action', url: window.location.href });
    }, true);
  }
}