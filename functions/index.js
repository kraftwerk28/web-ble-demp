const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
admin.initializeApp();
const db = admin.firestore();

async function getDevicesUnique() {
  const list = await db.collection('devices').get();
  const devices = new Map();
  list.forEach((doc) => {
    const device = doc.data();
    if (devices.has(device.name)) {
      const d = devices.get(device.name);
      device.services.forEach((s) => {
        d.services.set(s.uuid, s);
      });
    } else {
      const services = new Map(device.services.map((s) => [s.uuid, s]));
      devices.set(device.name, { ...device, services });
    }
  });
  return Array.from(devices.values()).map((device) => ({
    ...device,
    services: Array.from(device.services.values()),
  }));
}

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function add_device(req, res) {
  if (req.method !== 'POST' || !req.body) return res.status(400).end();
  await db.collection('devices').add({
    ...req.body,
    timestamp: admin.firestore.Timestamp.now(),
  });
  res.status(204).end();
}

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function list_devices(req, res) {
  const list = await db.collection('devices').get();
  const response = [];
  list.forEach((doc) => {
    const device = doc.data();
    response.push(device);
  });
  res.send(response);
}

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function list_devices_simple(req, res) {
  res.send(await getDevicesUnique());
}

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function list_devides_table(req, res) {
  const list = await db
    .collection('devices')
    .orderBy('timestamp', 'desc')
    .get();
  const tableHead = ['id', 'name', 'services', 'timestamp'];
  const rows = [];
  // let lastID = null;
  list.forEach((doc) => {
    const device = doc.data();
    // if (device.id === lastID) {
    //   return;
    // } else {
    //   lastID = device.id;
    // }
    const cells = [
      device.id,
      device.name,
      device.services.map((service) => service.name).join(', '),
      new Date(device.timestamp._seconds * 1e3).toLocaleString('uk-UA'),
    ];
    const tRow = `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    rows.push(tRow);
  });
  const html = `
  <html>
    <head>
      <style>
        th, td { border: 1px solid black; padding: 5px; }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>
      <table>
        <tr>${tableHead
          .map((header) => '<th>' + header + '</th>')
          .join('')}</tr>
        ${rows.join('')}
      </table>
    </body>
  </html>
  `.trim();
  res.contentType('html').send(html);
}

// Assigning functions for exporting
[add_device, list_devices, list_devices_simple, list_devides_table].forEach(
  (fn) => {
    exports[fn.name] = functions.https.onRequest((req, res) =>
      cors(req, res, fn.bind(null, req, res))
    );
  }
);
