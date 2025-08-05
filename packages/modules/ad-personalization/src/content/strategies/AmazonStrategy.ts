import { PersonalizationData } from '../../types';
import { BaseStrategy } from './BaseStrategy';
import { ErrorMessages } from '../../ErrorMessages';

export class AmazonStrategy extends BaseStrategy {
  public strategyKey = 'aap';

  async execute(data: PersonalizationData) {
    const { value } = data;
    let currentValue = value ?? false;

    const signInButton = document.querySelector('#a-autoid-0-announce') as HTMLElement;

    if (signInButton) {
      const initialUrl = window.location.href;

      signInButton.click();
      await this.observeUrlChanging(initialUrl);
    }

    const boxes = await this.waitForElements<HTMLInputElement>('[name="optout"]', true);

    this.addBlurEffect();

    let specifiedBox;

    const checkedBox = Array.from(boxes!).find((box) => box.checked);

    // Retrieve the stored amazonInitialValue from local storage. After the page reloads,
    // the state resets, and the initial value is taken as the current one, not the previous one.
    // Therefore, it's important to store it beforehand to ensure the correct initial value is preserved.
    let { amazonInitialValue } = await chrome.storage.local.get('amazonInitialValue');
    const initialValue = checkedBox?.value === '0';

    if (amazonInitialValue === undefined) {
      amazonInitialValue = initialValue;
      await chrome.storage.local.set({ amazonInitialValue });
    }

    if (value === undefined) {
      specifiedBox = Array.from(boxes!).find((box) => box.checked);
      currentValue = specifiedBox?.value === '0';

      return this.sendResponseToWorker({ currentValue })
    } else {
      specifiedBox = Array.from(boxes!).find((box) => box.value === (value ? '0' : '1'));
    }

    if (!specifiedBox) return this.sendResponseToWorker(null, ErrorMessages.INVALID_URL);

    if (specifiedBox?.checked) {
      await chrome.storage.local.set({ amazonInitialValue: initialValue });
      return this.sendResponseToWorker({ currentValue, initialValue: amazonInitialValue })
    };

    await new Promise((resolve) => requestAnimationFrame(resolve));

    specifiedBox?.click();

    const saveButton = document.getElementById('optOutControl') as HTMLElement;
    saveButton?.click();
    await chrome.storage.local.set({ amazonInitialValue: initialValue });

    const pageReloaded = await this.waitForPageReload();

    if (pageReloaded) return this.sendResponseToWorker({ currentValue, initialValue: value });
  }

  private async observeUrlChanging(url: string): Promise<void> {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (window.location.href !== url) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document, { subtree: true, childList: true });
    });
  }
}
