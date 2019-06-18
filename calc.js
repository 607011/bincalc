// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

(function (window) {
  'use strict';

  let inEl = null;
  let outEl = null;
  let msgEl = null;
  let baseFormEl = null;
  let base = localStorage.getItem('base') || 2;
  let results = [];
  let numberCruncher = null;
  let overlayEl = null;
  let t0 = 0;
  let isCalculating = false;

  let formulaChanged = () => {
    msgEl.innerHTML = 'Calculating&nbsp;&hellip;';
    msgEl.classList.remove('hide');
    msgEl.classList.remove('error');
    const expressions = inEl.value.split('\n');
    t0 = performance.now();
    isCalculating = true;
    numberCruncher.postMessage(expressions);
  };

  let baseChanged = event => {
    base = parseInt(event.target.value);
    localStorage.setItem('base', base);
    outEl.innerText = results.map(result => result.toString(base)).join('\n');
  };

  let numberCruncherReady = msg => {
    isCalculating = false;
    if (msg.data.error) {
      msgEl.innerHTML = msg.data.error;
      msgEl.classList.add('error');
    }
    else {
      msgEl.innerHTML = '';
      results = msg.data.results;
      const dtPost = 1e-3 * (performance.now() - t0);
      if (results && results.length > 0) {
        const t0Render = performance.now();
        const textResult = results.map(result => result.toString(base)).join('\n');
        outEl.innerText = textResult;
        const dtRender = 1e-3 * (performance.now() - t0Render);
        msgEl.innerHTML = `${msg.data.dt.toFixed(4)} seconds to calculate, ${dtPost.toFixed(4)} seconds to transfer, ${dtRender.toFixed(4)} seconds to convert to base ${base}.`;
        msgEl.classList.add('hide');
      }
    }
  };

  let overlayKeyDown = event => {
    if (event.key === 'Escape') {
      overlayEl.classList.add('hidden');
    }
  };

  let terminateWorker = () => {
    if (isCalculating) {
      isCalculating = false;
      numberCruncher.terminate();
      numberCruncher = new Worker('numbercruncher.js');
      msgEl.classList.add('hide');
    }
  };

  let toggleHelp = () => {
    if (overlayEl.classList.contains('hidden')) {
      overlayEl.classList.remove('hidden');
      document.getElementById('help-back').addEventListener('click', () => {
        overlayEl.classList.add('hidden');
        window.removeEventListener('keydown', overlayKeyDown, {once: true, capture: true});
      }, {once: true, capture: true});
      window.addEventListener('keydown', overlayKeyDown, {once: true, capture: true});
    }
    else {
      overlayEl.classList.add('hidden');
    }
  };

  let init = () => {
    overlayEl = document.getElementById('overlay');
    try {
      let x = BigInt(0);
    }
    catch (e) {
      fetch('unsupported.html')
      .then(response => {
        response.body.getReader().read().then(html => {
          overlayEl.innerHTML = new TextDecoder("utf-8").decode(html.value);
          overlayEl.classList.remove('hidden');
        });
      });
      return;
    }
    inEl = document.getElementById('input');
    inEl.addEventListener('input', formulaChanged);
    outEl = document.getElementById('output');
    msgEl = document.getElementById('msg');
    baseFormEl = document.getElementById('base-form');
    document.getElementById(`base-${base}`).checked = true;
    baseFormEl.addEventListener('change', baseChanged);
    numberCruncher = new Worker('numbercruncher.js');
    numberCruncher.onmessage = numberCruncherReady;
    window.addEventListener('keyup', event => {
      switch (event.key) {
        case 'F1':
          toggleHelp();
          break;
        case 'Escape':
          terminateWorker();
          break;
      }

    });
    fetch('help.html')
      .then(response => {
        response.body.getReader().read().then(html => {
          overlayEl.innerHTML = new TextDecoder("utf-8").decode(html.value);
        });
        document.getElementById('help-button').addEventListener('click', toggleHelp);
      });
  };

  window.addEventListener('load', init);
})(window);
