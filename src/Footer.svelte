<script>
  import { fade } from 'svelte/transition';
  let fvisible = true;
  const THRESHOLD = 1;
  function onScroll() {
    if (window.scrollY > THRESHOLD && fvisible) {
      fvisible = false;
    } else if (window.scrollY <= THRESHOLD && !fvisible) {
      fvisible = true;
    }
  }
</script>

<style>
  .footer {
    background: #fff;
    position: fixed;
    bottom: 0px;
    border-top: 1px solid #000;
    padding: 10px;
    left: 0;
    right: 0;
  }
</style>

<svelte:window on:scroll={onScroll} />
{#if fvisible}
  <div transition:fade class="footer">
    Made by
    <a href="https://kraftwerk28.pp.ua" target="_blank">@kraftwerk28</a>
  </div>
{/if}
