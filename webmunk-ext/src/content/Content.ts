import { NotificationService } from './NotificationService';

export class Content {
  private lastScrollSent = 0;
  private readonly SCROLL_THROTTLE_MS = 1000;
  private readonly notificationService: NotificationService

  constructor () {
    this.notificationService = new NotificationService();
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