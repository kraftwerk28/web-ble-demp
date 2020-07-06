import * as c from './constants.js';

const $ = document.querySelector.bind(document);
function decodeValue(uint8arr) {
  return new TextDecoder('utf-8').decode(uint8arr);
}

function setList(list, target, onCreateListItem, elementToText) {
  target.innerHtml = '';
  list.forEach((el, i, self) => {
    const text = typeof elementToText === 'function'
      ? elementToText(el, i, self) : el;
    let elem;
    if (typeof onCreateListItem === 'function') {
      elem = onCreateListItem(el, i, self);
    } else {
      elem = document.createElement('li');
      elem.textContent = text;
    }
    target.appendChild(elem);
  });
}

function setServiceList(list) {
  setList(
    list.map(s => {
      const n = parseInt(s.uuid.split('-').shift(), 16);
      const matched = Object.entries(c.ALL_SERVICES).find(([, v]) => v === n);
      return matched ? matched[0] : undefined;
    }),
    $('#services'),
    (uuid) => {
      const opt = document.createElement('option');
      opt.textContent = uuid;
      if (uuid) {
        opt.setAttribute('value', uuid);
      } else {
        opt.disabled = true;
      }
      return opt;
    },
  )
}

function onLoad() {
  // navigator.serviceWorker.register('/sw.js');
  $('#services').addEventListener('change', e => console.log(e));
  $('#characteristics').addEventListener('change', e => console.log(e));


  function reqConnect() {
    navigator.bluetooth
      .requestDevice(bleOptions)
      .then(d => {
        console.log('Device:', d);
        device = d;
        return interact();
      })
      .catch(console.error);
  }

  $('#request').addEventListener('click', reqConnect);
  window.addEventListener('keydown', e => {
    if (e.key === 'c') reqConnect();
  });

  $('#disconnect').addEventListener('click', () => {
    device.gatt.disconnect();
    console.log('GATT Disconnected.')
  });
}

window.addEventListener('load', onLoad);
