import { FirebaseOptions } from '@firebase/app';
import { getRemoteConfig, fetchAndActivate, getAll } from 'firebase/remote-config';
import { FirebaseAppService } from './FirebaseAppService';
import { FirebaseConfig, convertConfigValuesToPrimitives } from './FirebaseRemoteConfig';
import { REMOTE_CONFIG_FETCH_INTERVAL } from '../config';

export type Config = FirebaseConfig & FirebaseOptions;

export class ConfigService {
  private config: Config | null = null;
  private fetchPromise: Promise<void> | null = null;

  constructor(private readonly firebaseAppService: FirebaseAppService) {}

  async getConfig(): Promise<Config> {
    if (this.fetchPromise) await this.fetchPromise;

    await this.loadConfig();

    return this.config!;
  }

  async getConfigByKey(key: keyof Config): Promise<any | undefined> {
    const config = await this.getConfig() || {};

    return config[key];
  }

  private async loadConfig(): Promise<void> {
    const fetchPromise: Promise<void> = new Promise(async (resolve, reject) => {
      try {
        const firebaseConfig = getRemoteConfig(this.firebaseAppService.getFirebaseApp());
        firebaseConfig.settings.minimumFetchIntervalMillis = Number(REMOTE_CONFIG_FETCH_INTERVAL);
        await fetchAndActivate(firebaseConfig);

        this.config = Object.assign(
          convertConfigValuesToPrimitives(getAll(firebaseConfig)),
          this.firebaseAppService.getConfig(),
        );

        resolve();
      } catch (e: any) {
        reject(e);
      } finally {
        this.fetchPromise = null;
      }
    });

    this.fetchPromise = fetchPromise;
    return fetchPromise;
  }
}
