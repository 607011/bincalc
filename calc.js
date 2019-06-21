// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

(function (window) {
  'use strict';

  let inputPaneEl = null;
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
  let workerFile = 'numbercruncher-bigint.js';

  let formulaChanged = () => {
    if (isCalculating) {
      numberCruncher.terminate();
      initWorker();
    }
    msgEl.innerHTML = 'Calculating&nbsp;&hellip;';
    msgEl.classList.remove('hide');
    msgEl.classList.remove('error');
    outputPaneEl.classList.add('greyout');
    loaderIconEl.classList.remove('hidden');
    const expressions = inputPaneEl.innerText.split('\n');
    t0 = Date.now();
    isCalculating = true;
    numberCruncher.postMessage({
      expressions: expressions,
      base: base
    });
    fitOutputPane();
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
    exprEl.innerHTML = `${result.expression} &rarr; `;
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
      outputPaneEl.classList.remove('greyout');
      results = msg.data.results;
      msgEl.innerHTML = '';
      const dtPost = Date.now() - t0 - msg.data.dtCalc - msg.data.dtRender;
      if (results && results.length > 0) {
        outputPaneEl.innerHTML = '';
        for (const result of results) {
          outputPaneEl.appendChild(visualResultFrom(result))
        }
        msgEl.innerHTML = `${msToStr(msg.data.dtCalc)} to calculate,
          ${msToStr(dtPost)} to transfer,
          ${msToStr(msg.data.dtRender)} to convert to base ${base}.`;
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

  let initWorker = () => {
    numberCruncher = new Worker(workerFile);
    numberCruncher.onmessage = numberCruncherReady;
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

  let onKeyUp = event => {
    switch (event.key) {
      case 'F1':
        toggleHelp();
        break;
      case 'Escape':
        terminateWorker();
        break;
    }
  };

  let fitOutputPane = () => {
    const h = document.getElementById('header').offsetHeight
      + document.getElementById('msg-container').offsetHeight
      + document.getElementById('input-pane').offsetHeight
      + document.getElementById('base-selector').offsetHeight
      + document.getElementById('footer').offsetHeight
      + 8 * 4 - 1;
    outputPaneEl.style.height = `${window.innerHeight - h}px`;
  };

  let onResize = () => {
    fitOutputPane();
  };

  let init = () => {
    try {
      let x = BigInt(0);
    }
    catch (e) {
      workerFile = 'numbercruncher-jsbi.js';
      console.log('BigInt not supported. Falling back to JSBI.');
    }
    overlayEl = document.getElementById('overlay');
    loaderIconEl = document.getElementById('loader-icon');
    inputPaneEl = document.getElementById('input-pane');
    inputPaneEl.addEventListener('input', formulaChanged);
    outputPaneEl = document.getElementById('output-pane');
    msgEl = document.getElementById('msg');
    msgEl.innerHTML = '';
    baseFormEl = document.getElementById('base-form');
    document.getElementById(`base-${base}`).checked = true;
    baseFormEl.addEventListener('change', baseChanged);
    initWorker();
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    fetch('help.html')
      .then(response => {
        response.body.getReader().read()
        .then(html => {
          overlayEl.innerHTML = new TextDecoder('utf-8').decode(html.value);
        });
        document.getElementById('help-button').addEventListener('click', toggleHelp);
      });
    fitOutputPane();
  };

  window.addEventListener('load', init);
})(window);
