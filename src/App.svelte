<script>
  import Warning from './Warning.svelte';
  import MessageLog, { log } from './MessageLog.svelte';
  import * as c from './constants';
  import Characteristic from './Characteristic.svelte';
  import Footer from './Footer.svelte';
  import * as utils from './utils';

  let serviceList = [];
  let characteristicsList = [];
  let device;
  let gattServer;
  let service;
  let characteristic;
  let connectState = 'disconnected';
  let selectedServiceName;
  let selectedCharacteristicName;

  const bleOptions = {
    acceptAllDevices: true,
    optionalServices: c.ALL_SERVICES.map(s => s.uuid)
  };

  async function interact() {
    gattServer = await device.gatt.connect();
    console.log('GATT server:', gattServer);
    const services = await gattServer.getPrimaryServices();
    console.log('Services list:', services);
    connectState = 'connected';
    serviceList = services
      .map(s => {
        const n = utils.parseBLEUUID(s.uuid);
        const matched = c.ALL_SERVICES.find(s => s.uuid === n);
        return matched;
      })
      .filter(s => s);
    characteristicsList = c.CHARACTERISTICS;
    await utils.registerDevice(device, services).catch(log);
  }

  function updateService(e) {
    const name = e.target.value;
    if (!gattServer || !name) return;
    const uuid = c.ALL_SERVICES.find(s => s.readableName === name).uuid;
    gattServer
      .getPrimaryService(uuid)
      .then(s => {
        console.log('Service:', s);
        service = s;
        if (selectedCharacteristicName) {
          selectedCharacteristicName = undefined;
          characteristic = null;
        }
      })
      .catch(log);
  }

  function updateCharacteristic(e) {
    const name = e.target.value;
    if (!gattServer || !service || !name) return;
    const uuid = c.CHARACTERISTICS.find(c => c.readableName === name).uuid;
    service
      .getCharacteristic(uuid)
      .then(ch => {
        console.log('Characteristic', ch);
        characteristic = ch;
      })
      .catch(log);
  }

  function reqConnect() {
    navigator.bluetooth.requestDevice(bleOptions).then(
      d => {
        console.log('Device:', d);
        device = d;
        connectState = 'connecting';
        device.addEventListener('gattserverdisconnected', () => {
          log('Disconnected', 'warn');
          reset();
        });
        return interact();
      },
      err => {
        log(err);
        reset();
      }
    );
  }

  function manipulateConnection() {
    if (!navigator.bluetooth) {
      log("Your device doesn't support BLE API.", 'error');
    }
    if (connectState === 'disconnected') {
      reqConnect();
    } else if (connectState === 'connected') {
      device.gatt.disconnect();
      reset();
    }
  }

  function reset() {
    gattServer = null;
    service = null;
    characteristic = null;
    connectState = 'disconnected';
    serviceList = [];
    characteristicsList = [];
    selectedCharacteristicName = selectedServiceName = undefined;
  }
</script>

<style>
  .connected {
    color: rgb(0 185 0);
  }
  .connecting {
    color: rgb(150 0 255);
  }
  .failed {
    color: #f00;
  }
  .double-side {
    display: flex;
    flex-flow: row wrap;
  }
  .double-side > div:nth-child(1) {
    border-right: 1px solid #000;
    border-bottom: none;
  }
  @media screen and (max-width: 800px) {
    .double-side > div:nth-child(1) {
      border-right: none;
      border-bottom: 1px solid #000;
    }
  }
  .double-side > div {
    flex: 1 1 400px;
  }
</style>

<Warning />

<h3
  class:connected={connectState === 'connected'}
  class:connecting={connectState === 'connecting'}
  class:failed={connectState === 'failed'}>
  Status: {connectState}
</h3>

<div class="double-side">
  <div>
    <button
      disabled={connectState === 'connecting'}
      on:click={manipulateConnection}>

      {#if connectState === 'disconnected'}
        Connect
      {:else if connectState === 'connecting'}
        Connecting...
      {:else if connectState === 'connected'}Disconnect{:else}Failed{/if}
    </button>

    <input
      list="services"
      disabled={connectState !== 'connected'}
      placeholder="Choose service"
      on:change={updateService}
      bind:value={selectedServiceName} />

    <datalist id="services">
      {#if serviceList.length}
        {#each serviceList as service}
          <option value={service.readableName} />
        {/each}
      {/if}
    </datalist>

    <input
      list="characteristics"
      disabled={connectState !== 'connected'}
      placeholder="Choose characteristic"
      bind:value={selectedCharacteristicName}
      on:change={updateCharacteristic} />

    <datalist id="characteristics">
      <option selected disabled value={undefined}>
        Select characteristic...
      </option>
      {#if characteristicsList.length && service}
        {#each characteristicsList as ch}
          <option value={ch.readableName} />
        {/each}
      {/if}
    </datalist>

    <br />
    {#if device && connectState === 'connected'}
      <h3>Device: {device.name} ({device.id})</h3>
    {/if}

  </div>

  <div>
    <Characteristic ch={characteristic} />
  </div>

</div>

<hr />
<MessageLog />
<Footer />
