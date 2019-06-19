// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

(function (window) {
  'use strict';

  let inEl = null;
  let outEl = null;
  let msgEl = null;
  let loaderIconEl = null;
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
    loaderIconEl.classList.remove('hidden');
    const expressions = inEl.value.split('\n');
    t0 = Date.now();
    isCalculating = true;
    numberCruncher.postMessage(expressions);
  };

  let baseChanged = event => {
    base = parseInt(event.target.value);
    localStorage.setItem('base', base);
    outEl.innerText = results.map(result => result.toString(base)).join('\n');
  };

  let msToStr = ms => {
    if (ms < 1) {
      return `&lt;1ms`;
    }
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`
    }
    return `${(1e-3 * ms).toFixed(1)}s`;
  };

  let numberCruncherReady = msg => {
    isCalculating = false;
    if (msg.data.error) {
      msgEl.innerHTML = msg.data.error;
      msgEl.classList.add('error');
      loaderIconEl.classList.add('hidden');
    }
    else {
      msgEl.innerHTML = '';
      results = msg.data.results;
      const dtPost = Date.now() - t0 - msg.data.dt;
      if (results && results.length > 0) {
        const t0Render = Date.now();
        const textResult = results.map(result => result.toString(base)).join('\n');
        const dtRender = Date.now() - t0Render;
        outEl.innerText = textResult;
        msgEl.innerHTML = `${msToStr(msg.data.dt)} to calculate, ${msToStr(dtPost)} to transfer, ${msToStr(dtRender)} to convert to base ${base}.`;
        msgEl.classList.add('hide');
        loaderIconEl.classList.add('hidden');
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
      loaderIconEl.classList.add('hide');
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
    loaderIconEl = document.getElementById('loader-icon');
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
