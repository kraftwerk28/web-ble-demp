<script context="module">
  import { writable } from 'svelte/store';
  import { uuid } from './utils';
  let msgLog = writable([]);

  export function log(payload, type = 'info') {
    let e;
    if (payload instanceof Error) {
      let text = '';
      if (payload.type) text += payload.text + ': ';
      text += payload.message;
      e = {
        text,
        type: 'error',
        id: uuid(),
      };
    } else {
      e = { text: payload, type, id: uuid() };
    }
    msgLog.update((m) => [...m, e]);
  }
</script>

<script>
  import { slide } from 'svelte/transition';

  function removeAt(index) {
    return () => {
      msgLog.update((m) => {
        m.splice(index, 1);
        return [...m];
      });
    };
  }
</script>

<style>
  .message-log {
    margin: auto;
    width: 55%;
  }
  @media screen and (max-width: 920px) {
    .message-log {
      margin: auto;
      width: unset;
    }
  }
  .message-log ol {
    padding: 0;
  }
  .message-log li {
    display: block;
    border-radius: 4px;
    padding: 5px;
    margin: 2px;
    border: 1px solid rgba(0 0 0 / 0.4);
    cursor: pointer;
    text-align: left;
  }
  .message-log .message-info {
    background: rgba(0 0 255 / 0.2);
  }
  .message-log .message-error {
    background: rgba(255 0 0 / 0.2);
  }
  .message-log .message-warn {
    background: rgba(255 255 0 / 0.2);
  }
</style>

<div class="message-log">
  <h3>
    <button on:click={() => msgLog.set([])}>❌</button>
    Message log:
  </h3>
  <ol>
    {#each $msgLog as msg, i (msg.id)}
      <li
        transition:slide={{ duration: 100 }}
        on:click={removeAt(i)}
        class={`message-${msg.type}`}>
        {msg.id}{'. '}{msg.text}
      </li>
    {/each}

  </ol>
</div>
