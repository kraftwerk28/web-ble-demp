import App from './App.svelte';

window.addEventListener('DOMContentLoaded', function() {
  new App({
    target: document.querySelector('#root'),
  });
});

// Must register serviceWorker...
