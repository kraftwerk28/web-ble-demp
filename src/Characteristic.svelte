<script>
  import { onDestroy } from 'svelte';
  import { log } from './MessageLog.svelte';
  import { decodeDataView } from './utils';

  export let ch;

  let readResult;
  let writeValue = '';
  let isNotifying = false;
  function onReadValue() {
    ch.readValue()
      .then((readResult) => {
        Object.assign(window, { readResult });
        log(decodeDataView(readResult));
      })
      .catch(log);
  }

  async function onWriteValue() {
    const arr = writeValue.split(',').map((v) => +v.trim());
    if (arr.some((v) => isNaN(v))) {
      log('Bad list supplied.', 'error');
      return;
    }
    const typedArr = Uint8Array.from(arr);
    ch.writeValue(typedArr)
      .then(() => {
        writeValue = '';
      })
      .catch(log);
  }

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
  {#if ch.properties.read}
    <form on:submit|preventDefault={onReadValue}>
      <button type="submit">Read value</button>
      <input placeholder="none" type="text" value={readResult || ''} readonly />
    </form>
  {/if}

  {#if ch.properties.write || ch.properties.writeWithoutResponse || ch.properties.writeAuxilaries}
    <form on:submit|preventDefault={onWriteValue}>
      <button type="submit">Write value</button>
      <input
        placeholder="Comma-separated list of values..."
        type="text"
        bind:value={writeValue} />
    </form>
  {/if}

  {#if ch.properties.notify || ch.properties.indicate}
    <form on:submit|preventDefault={onToggleNotify}>
      <button type="submit">
        {!isNotifying ? 'Start notify' : 'Stop notifications'}
      </button>
    </form>
  {/if}
{/if}
