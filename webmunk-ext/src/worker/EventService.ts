import 'setimmediate';
import { jitsuAnalytics } from "@jitsu/js";
import { JITSU_WRITE_KEY, JITSU_INGEST_URL } from '../config';
import { FirebaseAppService } from './FirebaseAppService';
import { ConfigService } from './ConfigService';

export class EventService {
  private client: any;

  constructor(
    private readonly firebaseAppService: FirebaseAppService,
    private readonly configService: ConfigService
  ) {
    this.client = jitsuAnalytics({ writeKey: JITSU_WRITE_KEY, host: JITSU_INGEST_URL, cookie_policy: "none" })
  }

  async isNeedToStopDataCollection(id: string): Promise<boolean> {
    const stopConfig = await this.configService.getConfigByKey('stopDataCollection');
    const isGlobalStop = stopConfig === true || stopConfig === 'true';

    const usersConfig = await this.configService.getConfigByKey('stopDataCollectionForSpecifiedUsers');
    const stoppedUserIds = JSON.parse(usersConfig || '[]');

    const isUserStopped = stoppedUserIds.includes(id);

    return isGlobalStop || isUserStopped;
  }

  async track(event: string, properties: any): Promise<void> {
    const user = await this.firebaseAppService.getUser();
    if (await this.isNeedToStopDataCollection(user.uid)) return;

    if (!user) {
      console.error('There is no user identifier. Please register.');
      return;
    }

    if (!user.active) {
      console.error('User is not active.');
      return;
    }

    this.client.identify(user.uid, { $doNotSend: true });

    try {
      await this.client.track({
        event,
        ...properties,
      });
    } catch (err) {
      console.error('Failed to send event:', err);
    }
  }
}
