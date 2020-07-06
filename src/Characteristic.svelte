<script>
  import { onDestroy } from 'svelte';
  import { log } from './MessageLog.svelte';
  import { decodeDataView } from './utils';

  export let ch;

  function decodeValue(val) {
    return Array.from(val).toString();
  }

  let readResult;
  let isNotifying = false;
  function onReadValue() {
    ch.readValue()
      .then((readResult) => {
        Object.assign(window, { readResult });
        log(decodeDataView(readResult));
      })
      .catch(log);
  }

  async function onWriteValue() {}

  async function onToggleNotify() {
    if (isNotifying) {
      ch.removeEventListener('characteristicvaluechanged', onChValueChaged);
      ch.stopNotifications().then(() => (isNotifying = false));
    } else {
      ch.addEventListener('characteristicvaluechanged', onChValueChaged);
      ch.startNotifications().then(() => (isNotifying = true));
    }
  }

  function onChValueChaged(e) {
    log(decodeDataView(e.target.value));
  }

  onDestroy(() => {
    ch.removeEventListener('characteristicvaluechanged', onChValueChaged);
  });
</script>

<h3>Current characteristic:</h3>
{#if ch}
  <form on:submit|preventDefault={onReadValue}>
    <button type="submit">Read value</button>
    <input type="text" value={readResult || ''} readonly />
  </form>

  <form on:submit|preventDefault={onToggleNotify}>
    <button type="submit">
      {!isNotifying ? 'Start notify' : 'Stop notifications'}
    </button>
  </form>
{/if}
