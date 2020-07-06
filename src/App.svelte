<script>
  import * as c from './constants';
  import Characteristic from './Characteristic.svelte';

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
    connectState = 'connected';
    console.log('GATT server:', gattServer);
    const services = await gattServer.getPrimaryServices();
    console.log('Services list:', services);
    serviceList = services
      .map((s) => {
        const n = parseInt(s.uuid.split('-').shift(), 16);
        const matched = c.ALL_SERVICES.find((s) => s.uuid === n);
        return matched;
      })
      .filter((s) => s);
    characteristicsList = c.CHARACTERISTICS;

    /* const service = await server.getPrimaryService( */
    /*   c.ALL_SERVICES['Heart Rate'] */
    /* ); */
    /* console.log('Service:', service); */

    /* const ch = await service.getCharacteristic('heart_rate_measurement'); */
    /* // console.log('Characteristic:', ch); */
    /* // console.log(`Characteristic value:`, decodeValue(await ch.readValue())); */
    /* // const desc = await ch.getDescriptor('gatt.client_characteristic_configuration'); */
    /* // console.log('Descriptor:', desc); */
    /* // console.log(await desc.readValue()); */
    /* // await desc.writeValue(Uint8Array.of(1)); */
    /* await ch.startNotifications(); */
    /* ch.addEventListener('characteristicvaluechanged', (e) => { */
    /*   console.log('Battery level:', e.target.value.getUint8(1)); */
    /* }); */
  }

  $: {
    if (gattServer && selectedServiceUUID) {
      gattServer
        .getPrimaryService(selectedServiceUUID)
        .then((s) => (service = s));
    }
  }

  $: {
    if (gattServer && service && selectedCharacteristicUUID) {
      service
        .getCharacteristic(selectedCharacteristicUUID)
        .then((ch) => (characteristic = ch));
    }
  }

  function reqConnect() {
    navigator.bluetooth.requestDevice(bleOptions).then(
      (d) => {
        console.log('Device:', d);
        device = d;
        connectState = 'connecting';
        device.addEventListener(
          'gattserverdisconnected',
          () => (connectState = 'disconnected')
        );
        return interact();
      },
      () => {
        connectState = 'failed';
      }
    );
  }

  function manipulateConnection() {
    if (connectState === 'disconnected') {
      reqConnect();
    } else if (connectState === 'connected') {
      device.gatt.disconnect();
      connectState = 'disconnected';
      serviceList = [];
      characteristicsList = [];
    }
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
</style>

<h3
  class:connected={connectState === 'connected'}
  class:connecting={connectState === 'connecting'}
  class:failed={connectState === 'failed'}>
  Status: {connectState}
</h3>

<button
  disabled={connectState === 'connecting'}
  on:click={manipulateConnection}>

  {#if connectState === 'disconnected'}
    Connect
  {:else if connectState === 'connecting'}
    Connecting...
  {:else if connectState === 'connected'}Disconnect{:else}Failed{/if}
</button>

{#if serviceList.length}
  <select bind:value={selectedServiceUUID}>
    <option selected disabled value={undefined}>Select service...</option>
    {#each serviceList as service}
      <option value={service.uuid}>{service.readableName}</option>
    {/each}
  </select>
{/if}

{#if characteristicsList.length && selectedServiceUUID}
  <select bind:value={selectedCharacteristicUUID}>
    <option selected disabled value={undefined}>
      Select characteristic...
    </option>
    {#each characteristicsList as ch}
      <option value={ch.uuid}>{ch.readableName}</option>
    {/each}
  </select>
{/if}

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

<br />
{#if characteristic}
  <Characteristic ch={characteristic} />
{/if}
