const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
admin.initializeApp();
const db = admin.firestore();

exports.add_device = functions.https.onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST' || !req.body) return res.status(400).end();
    await db.collection('devices').add({
      ...req.body,
      timestamp: admin.firestore.Timestamp.now(),
    });
    res.status(204).end();
  })
);
