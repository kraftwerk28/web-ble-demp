<script>
  import Warning from './Warning.svelte';
  import MessageLog, { log } from './MessageLog.svelte';
  import * as c from './constants';
  import Characteristic from './Characteristic.svelte';
  import Footer from './Footer.svelte';

  let serviceList = [];
  let characteristicsList = [];
  let device;
  let gattServer;
  let service;
  let characteristic;
  let connectState = 'disconnected';
  let selectedServiceUUID;
  let selectedCharacteristicUUID;

  const bleOptions = {
    acceptAllDevices: true,
    optionalServices: c.ALL_SERVICES.map((s) => s.uuid),
  };

  async function interact() {
    gattServer = await device.gatt.connect();
    console.log('GATT server:', gattServer);
    const services = await gattServer.getPrimaryServices();
    console.log('Services list:', services);
    connectState = 'connected';
    serviceList = services
      .map((s) => {
        const n = parseInt(s.uuid.split('-').shift(), 16);
        const matched = c.ALL_SERVICES.find((s) => s.uuid === n);
        return matched;
      })
      .filter((s) => s);
    characteristicsList = c.CHARACTERISTICS;
  }

  function updateService(uuid) {
    if (!gattServer || !uuid) return;
    gattServer
      .getPrimaryService(uuid)
      .then((s) => {
        console.log('Service:', s);
        service = s;
        if (selectedCharacteristicUUID) {
          selectedCharacteristicUUID = undefined;
          characteristic = null;
        }
      })
      .catch(log);
  }
  function updateCharacteristic(uuid) {
    if (!gattServer || !service || !uuid) return;
    service
      .getCharacteristic(uuid)
      .then((ch) => {
        console.log('Characteristic', ch);
        characteristic = ch;
      })
      .catch(log);
  }

  $: updateService(selectedServiceUUID);
  $: updateCharacteristic(selectedCharacteristicUUID);

  function reqConnect() {
    navigator.bluetooth.requestDevice(bleOptions).then(
      (d) => {
        console.log('Device:', d);
        device = d;
        connectState = 'connecting';
        device.addEventListener('gattserverdisconnected', () => {
          log('Disconnected', 'warn');
          reset();
        });
        return interact();
      },
      (err) => {
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
    selectedCharacteristicUUID = selectedServiceUUID = undefined;
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

    <select bind:value={selectedServiceUUID}>
      <option selected disabled value={undefined}>Select service...</option>
      {#if serviceList.length}
        {#each serviceList as service}
          <option value={service.uuid}>{service.readableName}</option>
        {/each}
      {/if}
    </select>

    <select bind:value={selectedCharacteristicUUID}>
      <option selected disabled value={undefined}>
        Select characteristic...
      </option>
      {#if characteristicsList.length && selectedServiceUUID}
        {#each characteristicsList as ch}
          <option value={ch.uuid}>{ch.readableName}</option>
        {/each}
      {/if}
    </select>

    <br />
    {#if device && connectState === 'connected'}
      <h3>Device: {device.name} ({device.id})</h3>
    {/if}

    <br />
    <span>
      {'Selected service:'}
      {selectedServiceUUID ? `0x${selectedServiceUUID.toString('16')}` : 'none'}
    </span>
    <br />
    <span>
      {'Selected characteristic:'}
      {selectedCharacteristicUUID ? `0x${selectedCharacteristicUUID.toString('16')}` : 'none'}
    </span>

  </div>

  <div>
    <Characteristic ch={characteristic} />
  </div>

</div>

<hr />
<MessageLog />
<Footer />
