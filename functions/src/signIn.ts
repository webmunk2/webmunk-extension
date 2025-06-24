import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

const db = getFirestore();

export const signIn = onCall<{ prolificId: string }>(async (request) => {
  const sessionUid = request.auth?.uid;
  const { prolificId } = request.data;

  if (!sessionUid || !prolificId) {
    throw new HttpsError('invalid-argument', 'Invalid arguments: Uid and prolificId are required.');
  }

  try {
    const userRef = db.collection('users').doc(prolificId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      throw new HttpsError('already-exists', 'This Prolific ID is already in use. Please enter a different one.');
    }

    const user = {
      sessionUid,
      prolificId,
      uid: uuidv4(),
      active: true
    };

    await userRef.set(user);

    return user;
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Unexpected error during sign-in.');
  }
});
