import { initializeApp, type FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth/web-extension';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FIREBASE_CONFIG, USER_FETCH_INTERVAL, FIREBASE_BUCKET_URL } from '../config';
import { User } from '../types';

export class FirebaseAppService {
  private readonly firebaseApp = initializeApp(FIREBASE_CONFIG);
  private readonly firestore = getFirestore(this.firebaseApp);
  private readonly storage = getStorage(this.firebaseApp, FIREBASE_BUCKET_URL);
  private readonly auth = getAuth(this.firebaseApp);
  private readonly functions = getFunctions();

  private user: User | null = null;
  private fetchPromise: Promise<void> | null = null;
  private userFetchTimestamp: number | null = null;

  public getConfig(): FirebaseOptions {
    return FIREBASE_CONFIG;
  }

  public getFirebaseApp(): FirebaseApp {
    return this.firebaseApp;
  }

  public async login(prolificId?: string): Promise<User | undefined> {
    try {
      await signInAnonymously(this.auth);

      if (!prolificId) {
        const result = await chrome.storage.local.get('user');
        this.user = result.user as User;
        return this.user;
      }

      const userId = prolificId || this.user?.prolificId;

      const signIn = httpsCallable<{ prolificId: string }, User>(this.functions, 'signIn');
      const response = await signIn({ prolificId: userId! });

      this.user = response.data as User;
      this.userFetchTimestamp = Date.now();
      await chrome.storage.local.set({ user: this.user });

      return this.user;
    } catch (e: any) {
      if (e.code.includes('already-exists')) {
        throw new Error(e.message);
      }

      console.log(e);
    }
  }

  public async getUser(): Promise<User> {
    if (!this.user) {
      const result = await chrome.storage.local.get('user');
      this.user = result.user as User;
    }

    // return user from cache if userFetchTimestamp and not expired
    if (this.userFetchTimestamp && (Date.now() - this.userFetchTimestamp) < USER_FETCH_INTERVAL) {
      return this.user;
    }

    // re-fetch user otherwise
    if (this.fetchPromise) {
      await this.fetchPromise;
    } else {
      await this.fetchUser(this.user?.prolificId);
    }

    return this.user;
  }

  private async fetchUser(prolificId: string): Promise<void> {
    if (!prolificId) return;

    const fetchPromise: Promise<void> = new Promise(async (resolve, reject) => {
      try {
        const userRef = doc(this.firestore, 'users', prolificId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          this.user = userSnap.data() as unknown as User;
          this.userFetchTimestamp = Date.now();
        } else {
          this.user = null;
        }

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

  public async uploadScreenshotToFirebase(blob: Blob, eventName: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const userId = this.user?.prolificId;
      const imageRef = ref(this.storage, `screenshots/${eventName}_${userId}_${timestamp}.jpg`);
      const snapshot = await uploadBytes(imageRef, blob);

      const downloadURL = await getDownloadURL(snapshot.ref);

      return downloadURL;
    } catch (error: any) {
      throw new Error(`Upload failed: ${error?.message}`);
    }
  }
}
