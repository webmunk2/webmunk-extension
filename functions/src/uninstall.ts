import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export const uninstall = onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://fto2001.github.io');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { prolificId } = req.body;

  if (!prolificId) {
    res.status(400).json({ error: 'Missing prolificId' });
    return;
  }

  (async () => {
    try {
      const userRef = db.collection('uninstalls').doc(prolificId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        res.status(403).json({ error: 'Already uninstalled' });
        return;
      }

      const user = {
        prolificId,
        timestamp: new Date().toISOString()
      };

      await userRef.set(user);

      res.status(200).json(user);
    } catch (err) {
      res.status(500).json({ error: 'Internal error' });
    }
  })();
});
