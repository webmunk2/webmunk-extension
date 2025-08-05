import { initializeApp } from 'firebase-admin/app';
initializeApp();

export { signIn } from './signIn';
export { uninstall } from './uninstall';
export { analyzeScreenshot } from './analyzeScreenshot';