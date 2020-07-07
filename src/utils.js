import { ALL_SERVICES } from './constants';

const genuuid = (function* () {
  let c = 0;
  while (true) {
    yield c++;
  }
})();

const textDecoder = new TextDecoder('utf-8');

export function uuid() {
  return genuuid.next().value;
}

export function parseBLEUUID(uuid) {
  return parseInt(uuid.split('-').shift(), 16);
}

export function decodeTextValue(data) {
  return textDecoder.decode(data);
}

export function decodeDataView(dv) {
  const arr = [];
  for (let i = 0; i < dv.byteLength; i++) {
    arr.push(dv.getUint8(i));
  }
  return arr;
}

const FBAPI =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:5001/ble-gatt/us-central1'
    : 'https://us-central1-ble-gatt.cloudfunctions.net';

export async function registerDevice(device, services) {
  const data = {
    id: device.id,
    name: device.name,
    services: services.map((s) => {
      const p = ALL_SERVICES.find((it) => it.uuid === parseBLEUUID(s.uuid));
      return {
        uuid: s.uuid,
        name: p.name,
        readableName: p.readableName,
      };
    }),
  };
  return fetch(new URL(FBAPI + '/add_device'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
