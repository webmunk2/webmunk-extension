export const WEBMUNK_URL = process.env?.WEBMUNK_URL;
export const UNINSTALL_URL = process.env?.UNINSTALL_URL;
export const JITSU_WRITE_KEY = process.env?.JITSU_WRITE_KEY;
export const JITSU_INGEST_URL = process.env?.JITSU_INGEST_URL;
export const FIREBASE_CONFIG = {
  apiKey: process.env?.FIREBASE_API_KEY,
  authDomain: `${process.env?.FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env?.FIREBASE_PROJECT_ID,
  storageBucket: `${process.env?.FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: process.env?.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env?.FIREBASE_APP_ID,
};
export const FIREBASE_BUCKET_URL = process.env?.FIREBASE_BUCKET_URL;
// 1 week
export const DELAY_BETWEEN_SURVEY = process.env?.DELAY_BETWEEN_SURVEY;
// 2 weeks
export const DELAY_WHILE_AD_BLOCKER = process.env?.DELAY_WHILE_AD_BLOCKER;
// 2 days
export const DELAY_BETWEEN_AD_PERSONALIZATION = process.env?.DELAY_BETWEEN_AD_PERSONALIZATION;
// 1 days
export const DELAY_BETWEEN_REMOVE_NOTIFICATION = process.env?.DELAY_BETWEEN_REMOVE_NOTIFICATION;
// 5 minutes
export const DELAY_BETWEEN_FILL_OUT_NOTIFICATION = process.env?.DELAY_BETWEEN_FILL_OUT_NOTIFICATION;
// 1 hour
export const REMOTE_CONFIG_FETCH_INTERVAL = process.env?.REMOTE_CONFIG_FETCH_INTERVAL;
// 1 hour
export const USER_FETCH_INTERVAL = process.env?.USER_FETCH_INTERVAL;
// 1 day
export const DELAY_BETWEEN_EXCLUDED_VISITED_DOMAINS = process.env?.DELAY_BETWEEN_EXCLUDED_VISITED_DOMAINS;
// 10 minutes
export const DELAY_BETWEEN_AD_RATING_POPUP = process.env?.DELAY_BETWEEN_AD_RATING_POPUP;