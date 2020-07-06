<script>
  import { onDestroy } from 'svelte';

  export let ch;

  function decodeValue(val) {
    return Array.from(val).toString();
  }

  let readResult;
  async function onReadValue() {
    readResult = await ch.readValue();
    Object.assign(window, { readResult });
  }

  async function onWriteValue() {}

  async function onStartNotify() {
    ch.addEventListener('characteristicvaluechanged', onChValueChaged);
    await ch.startNotifications();
  }

  function onChValueChaged(e) {
    console.log(e);
  }

  onDestroy(() => {
    ch.removeEventListener('characteristicvaluechanged', onChValueChaged);
  });

  let notificationLog = '';
</script>

<form on:submit|preventDefault={onReadValue}>
  <button type="submit">Read value</button>
  <input type="text" value={readResult} readonly />
</form>

<form on:submit|preventDefault={onStartNotify}>
  <button type="submit">Start notify</button>
  <textarea readonly bind:value={notificationLog} />
</form>
