// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

(function (window) {
  'use strict';

  let inEl = null;
  let msgEl = null;
  let overlayEl = null;
  let outputPaneEl = null;
  let loaderIconEl = null;
  let baseFormEl = null;
  let base = localStorage.getItem('base') || 2;
  let results = [];
  let numberCruncher = null;
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
    numberCruncher.postMessage({
      expressions: expressions,
      base: base
    });
  };

  let baseChanged = event => {
    base = parseInt(event.target.value);
    localStorage.setItem('base', base);
    formulaChanged();
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

  let visualResultFrom = result => {
    const containerEl = document.createElement('div');
    containerEl.classList.add('result-container');
    const exprEl = document.createElement('span');
    exprEl.classList.add('expression');
    exprEl.innerHTML = `${result.expression} → `;
    const resultEl = document.createElement('span');
    resultEl.classList.add('result');
    resultEl.innerHTML = result.result;
    containerEl.appendChild(exprEl);
    containerEl.appendChild(resultEl);
    return containerEl;
  };

  let numberCruncherReady = msg => {
    isCalculating = false;
    if (msg.data.error) {
      msgEl.innerHTML = msg.data.error;
      msgEl.classList.add('error');
      loaderIconEl.classList.add('hidden');
    }
    else if (msg.data.results) {
      results = msg.data.results;
      msgEl.innerHTML = '';
      const dtPost = Date.now() - t0 - msg.data.dtCalc - msg.data.dtRender;
      if (results && results.length > 0) {
        outputPaneEl.innerHTML = '';
        for (const result of results) {
          outputPaneEl.appendChild(visualResultFrom(result))
        }
        msgEl.innerHTML = `${msToStr(msg.data.dtCalc)} to calculate, ${msToStr(dtPost)} to transfer, ${msToStr(msg.data.dtRender)} to convert to base ${base}.`;
        msgEl.classList.add('hide');
      }
      loaderIconEl.classList.add('hidden');
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
    let workerFile = 'numbercruncher-bigint.js';
    try {
      let x = BigInt(0);
    }
    catch (e) {
      workerFile = 'numbercruncher-jsbi.js';
      console.log('BigInt not supported. Falling back to JSBI.');
    }
    overlayEl = document.getElementById('overlay');
    loaderIconEl = document.getElementById('loader-icon');
    inEl = document.getElementById('input');
    inEl.addEventListener('input', formulaChanged);
    outputPaneEl = document.getElementById('output-pane');
    msgEl = document.getElementById('msg');
    baseFormEl = document.getElementById('base-form');
    document.getElementById(`base-${base}`).checked = true;
    baseFormEl.addEventListener('change', baseChanged);
    numberCruncher = new Worker(workerFile);
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
          overlayEl.innerHTML = new TextDecoder('utf-8').decode(html.value);
        });
        document.getElementById('help-button').addEventListener('click', toggleHelp);
      });
  };

  window.addEventListener('load', init);
})(window);
