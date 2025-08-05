// dont remove next line, all webmunk modules use messenger utility
// @ts-ignore
import { messenger } from '@webmunk/utils';
// import services like example below
// import { RudderStackService } from './RudderStackService';

// this is where you could import your webmunk modules worker scripts
import "@webmunk/extension-ads/worker";
import "@webmunk/cookies-scraper/worker";
import "@webmunk/ad-personalization/worker";

export class Worker {
  // private readonly rudderStack: RudderStackService;

  constructor() {
    // this.rudderStack = new RudderStackService(this.firebaseAppService, this.configService);
  }

  public async initialize(): Promise<void> {
    messenger.addReceiver('appMgr', this);
    messenger.addModuleListener('ads-scraper', this.onModuleEvent.bind(this));
    messenger.addModuleListener('cookies-scraper', this.onModuleEvent.bind(this));
    messenger.addModuleListener('ad-personalization', this.onModuleEvent.bind(this));
  }

  private async onModuleEvent(event: string, data: any): Promise<void> {
    // await this.rudderStack.track(event, data);
  }
}