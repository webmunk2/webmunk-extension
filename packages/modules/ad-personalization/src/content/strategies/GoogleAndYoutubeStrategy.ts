import { PersonalizationData } from '../../types';
import { BaseStrategy } from './BaseStrategy';

export class GoogleAndYoutubeStrategy extends BaseStrategy {
  public strategyKey = 'gyta';

  async execute(data: PersonalizationData) {
    const { value } = data;
    let currentValue = value ?? false;

    if (value === undefined) {
      const offButton = document.querySelector('[aria-label*="Turn off."]');
      const onButton = document.querySelector('[aria-label*="Turn on."]');

      const selectedOption = offButton ? true : onButton ? false : null;

      if (selectedOption !== null) {
        return this.sendResponseToWorker({ currentValue: selectedOption });
      }
    }

    if (value) {
      const offButton = document.querySelector('[aria-label*="Turn off."]');
      if (offButton) {
        this.addBlurEffect();
        return this.sendResponseToWorker({ currentValue, initialValue: value });
      }

      const onButton = await this.waitForElement('[aria-label*="Turn on."]') as HTMLElement;
      if (onButton) this.addBlurEffect();
      onButton.click();

      const saveButton = await this.waitForElement('[jsname="Lnwj0b"]') as HTMLElement;
      saveButton.click();

      this.sendResponseToWorker({ currentValue, initialValue: !value });
    } else {
      const onButton = document.querySelector('[aria-label*="Turn on."]');
      if (onButton) {
        this.addBlurEffect();
        return this.sendResponseToWorker({ currentValue, initialValue: value });
      }

      const offButton = await this.waitForElement('[aria-label*="Turn off."]') as HTMLElement;
      if (offButton) this.addBlurEffect();
      offButton.click();

      const saveButton =  await this.waitForElement('[jsname="mXJpKc"]') as HTMLElement;
      saveButton.click();

      this.sendResponseToWorker({ currentValue, initialValue: !value });
    }
  }
}
