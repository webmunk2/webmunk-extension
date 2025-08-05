export class NotificationService {
  constructor() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    if (message.action === 'webmunkExt.notificationService.removeExtension') {
      try {
        chrome.management.uninstallSelf({ showConfirmDialog: true });
      } catch (error) {
        chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
      }
    }
  }

  public async showNotification(tabId: number, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.action === 'webmunkExt.notificationService.extensionNotificationResponse') {
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onRemoved.removeListener(tabCloseListener);
          resolve();
        }
      };

      const tabCloseListener = (closedTabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
        if (closedTabId === tabId) {
          chrome.runtime.onMessage.removeListener(messageListener);
          reject(null);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      chrome.tabs.onRemoved.addListener(tabCloseListener);

      chrome.tabs.sendMessage(
        tabId,
        { action: 'webmunkExt.notificationService.extensionNotificationRequest', text },
        { frameId: 0 }
      );
    });
  }
}