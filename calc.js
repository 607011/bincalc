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

  let formulaChanged = () => {
    msgEl.innerHTML = 'Calculating&nbsp;&hellip;';
    msgEl.classList.remove('hide');
    msgEl.classList.remove('error');
    const expressions = inEl.value.split('\n');
    numberCruncher.postMessage(expressions);
  };

  let displayResults = () => {
    outEl.value = results.map(result => result.toString(base)).join('\n');
  };

  let baseChanged = event => {
    base = parseInt(event.target.value);
    localStorage.setItem('base', base);
    displayResults();
  };

  let numberCruncherReady = msg => {
    if (msg.data.error) {
      msgEl.innerHTML = msg.data.error;
      msgEl.classList.add('error');
    }
    else {
      msgEl.innerHTML = '';
      results = msg.data.results;
      if (results && results.length > 0) {
        msgEl.innerHTML = `Calculation took ${msg.data.dt.toFixed(4)} seconds`;
        msgEl.classList.add('hide');
      }
      displayResults();
    }
  };

  let overlayKeyDown = event => {
    if (event.key === 'Escape') {
      overlayEl.classList.add('hidden');
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
    baseFormEl.addEventListener('change', baseChanged);
    document.getElementById(`base-${base}`).checked = true;
    numberCruncher = new Worker('numbercruncher.js');
    numberCruncher.onmessage = numberCruncherReady;
    window.addEventListener('keyup', event => {
      if (event.key === 'F1') {
        toggleHelp();
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
