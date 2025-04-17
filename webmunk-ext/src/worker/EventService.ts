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

  async track(event: string, properties: any): Promise<void> {
    const user = await this.firebaseAppService.getUser();
    const trackInactiveUsers = await this.configService.getConfigByKey('trackInactiveUsers');

    if (!user) {
      console.error('There is no user identifier. Please register.');
      return;
    }

    if (!user.active && !trackInactiveUsers) {
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
