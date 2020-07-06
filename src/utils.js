const genuuid = (function*() {
  let c = 0;
  while (true) {
    yield c++;
  }
})();

const textDecoder = new TextDecoder('utf-8');

export function uuid() {
  return genuuid.next().value;
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
