import { StrategyFactory } from './StrategyFactory';
import { PersonalizationData } from '../types';

export class AdPersonalizationContent {
  private strategyFactory: StrategyFactory;

  constructor() {
    this.strategyFactory = new StrategyFactory();
    this.initialize();
  };

  public initialize(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  };

  private handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    if (message.action === 'adsPersonalization.strategies.settingsRequest') {
      this.handleKey(message.data);
    }
  };

  private handleKey(data: PersonalizationData): void {
    const strategy = this.strategyFactory.getStrategy(data.key);

    if (strategy) strategy.execute(data);
  }
}