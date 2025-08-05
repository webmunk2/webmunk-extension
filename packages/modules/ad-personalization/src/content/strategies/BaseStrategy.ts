import { PersonalizationData } from '../../types';

export interface IStrategy {
  strategyKey: string;
  execute(data: PersonalizationData): Promise<void>;
}

interface ResponseItem {
  currentValue: boolean;
  initialValue?: boolean;
}

export abstract class BaseStrategy implements IStrategy {
  abstract strategyKey: string;
  abstract execute(data: PersonalizationData): Promise<void>;

  protected addBlurEffect(): void {
    document.body.style.filter = 'blur(20px)';

    const overlay = document.createElement('div');
    const mainContainer = document.createElement('div');
    const styles = document.createElement('style');
    styles.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 10000;

        width: 100%;
        height: 100%;
      }

      .main-container {
        position: fixed;
        top: 50%;
        left: 50%;
        z-index: 10001;

        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
        justify-content: center;
        color: black;
        font-family: 'Roboto', sans-serif;
        border-radius: 5px;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        transform: translate(-50%, -50%);
      }
    `;

    overlay.appendChild(styles);
    overlay.appendChild(mainContainer);

    overlay.classList.add('overlay');
    mainContainer.classList.add('main-container');

    const content = `
      <svg xmlns="http://www.w3.org/2000/svg" style="margin-top: 24px;" width="80px" height="80px" viewBox="0 0 24 24"><g><circle cx="12" cy="2.5" r="1.5" fill="black" opacity="0.6"/><circle cx="16.75" cy="3.77" r="1.5" fill="black" opacity="0.29"/><circle cx="20.23" cy="7.25" r="1.5" fill="black" opacity="0.43"/><circle cx="21.5" cy="12" r="1.5" fill="black" opacity="0.57"/><circle cx="20.23" cy="16.75" r="1.5" fill="black" opacity="0.71"/><circle cx="16.75" cy="20.23" r="1.5" fill="black" opacity="0.86"/><circle cx="12" cy="21.5" r="1.5" fill="black"/><animateTransform attributeName="transform" calcMode="discrete" dur="1.125s" repeatCount="indefinite" type="rotate" values="0 12 12;30 12 12;60 12 12;90 12 12;120 12 12;150 12 12;180 12 12;210 12 12;240 12 12;270 12 12;300 12 12;330 12 12;360 12 12"/></g></svg>
      <p style="font-size: 24px; line-height: 1; margin: 24px; text-align: center;">
        Please don't close this tab/window, but you can open a new tab while waiting. <br>
        Ad personalization is in progress...
      </p>
    `;
    mainContainer.innerHTML = content;

    document.documentElement.appendChild(overlay);
  }

  protected async waitForElements<T extends Element = HTMLElement>(selector: string, isNeedToDisabledTimeout?: boolean): Promise<NodeListOf<T> | null> {
    return new Promise((resolve) => {
      const elements = document.querySelectorAll(selector) as NodeListOf<T>;

      if (elements.length > 0) {
        return resolve(elements);
      }

      const observer = new MutationObserver(() => {
        const newElements = document.querySelectorAll(selector) as NodeListOf<T>;

        if (newElements.length > 0) {
          resolve(newElements);
          observer.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      !isNeedToDisabledTimeout && setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 5000);
    });
  }

  protected async waitForElement(selector: string, textContent: string | null = null): Promise<HTMLElement> {
    return new Promise((resolve) => {
      const check = () => {
        const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        const element = textContent ? elements.find((el) => el.textContent?.trim() === textContent) : elements[0];

        if (element && element.offsetParent !== null) {
          resolve(element);
        } else {
          requestAnimationFrame(check);
        }
      };

      check();
    });
  }

  protected async waitForPageReload(): Promise<boolean> {
    return new Promise((resolve) => {
      const initialUrl = window.location.href;

      const checkForReload = () => {
        if (window.location.href !== initialUrl) {
          resolve(true);
        } else {
          setTimeout(checkForReload, 100);
        }
      };

      checkForReload();
    });
  }

  protected sendResponseToWorker(response: ResponseItem | null, error?: string): void {
    chrome.runtime.sendMessage({
      action: 'adsPersonalization.strategies.settingsResponse',
      response: { values: response, error },
    });
  }
}
