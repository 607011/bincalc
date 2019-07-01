// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

(function (window) {
  'use strict';

  let inputPaneEl = null;
  let msgEl = null;
  let msgContainerEl = null;
  let overlayEl = null;
  let outputPaneEl = null;
  let loaderIconEl = null;
  let baseFormEl = null;
  let base = localStorage.getItem('base') || 2;
  let results = [];
  let numberCruncher = null;
  let t0Post = 0;
  let isCalculating = false;
  let workerFile = 'numbercruncher-bigint.js';

  const formulaChanged = () => {
    if (isCalculating) {
      numberCruncher.terminate();
      initWorker();
    }
    msgEl.innerHTML = 'Calculating&nbsp;&hellip;';
    msgContainerEl.classList.remove('error');
    outputPaneEl.classList.add('greyout');
    loaderIconEl.classList.remove('hidden');
    const expressions = inputPaneEl.innerText.split('\n');
    t0Post = Date.now();
    isCalculating = true;
    numberCruncher.postMessage({
      expressions: expressions,
      base: base
    });
    fitOutputPane();
  };

  const baseChanged = event => {
    base = parseInt(event.target.value);
    localStorage.setItem('base', base);
    formulaChanged();
  };

  const msToStr = ms => {
    if (ms < 1) {
      return `&lt;1ms`;
    }
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`
    }
    return `${(1e-3 * ms).toFixed(1)}s`;
  };

  const visualResultFrom = result => {
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

  const numberCruncherReady = msg => {
    isCalculating = false;
    if (msg.data.error) {
      msgEl.innerHTML = msg.data.error;
      msgContainerEl.classList.add('error');
      loaderIconEl.classList.add('hidden');
    }
    else if (msg.data.results) {
      msgContainerEl.classList.remove('error');
      outputPaneEl.classList.remove('greyout');
      results = msg.data.results;
      msgEl.innerHTML = '';
      const dtPost = Date.now() - t0Post - msg.data.dtCalc - msg.data.dtRender;
      outputPaneEl.innerHTML = '';
      if (results && results.length > 0) {
        for (const result of results) {
          outputPaneEl.appendChild(visualResultFrom(result))
        }
        msgEl.innerHTML = `${msToStr(msg.data.dtCalc)} to calculate,
          ${msToStr(dtPost)} to transfer,
          ${msToStr(msg.data.dtRender)} to convert to base ${base}.`;
      }
      loaderIconEl.classList.add('hidden');
    }
  };

  const overlayKeyDown = event => {
    if (event.key === 'Escape') {
      overlayEl.classList.add('hidden');
    }
  };

  const initWorker = () => {
    numberCruncher = new Worker(workerFile);
    numberCruncher.onmessage = numberCruncherReady;
  };

  const terminateWorker = () => {
    if (isCalculating) {
      isCalculating = false;
      numberCruncher.terminate();
      numberCruncher = new Worker('numbercruncher.js');
      loaderIconEl.classList.add('hidden');
    }
  };

  const toggleHelp = () => {
    if (overlayEl.classList.contains('hidden')) {
      overlayEl.classList.remove('hidden');
      document.getElementById('help-back').addEventListener('click', () => {
        overlayEl.classList.add('hidden');
        window.removeEventListener('keydown', overlayKeyDown, { once: true, capture: true });
      }, { once: true, capture: true });
      window.addEventListener('keydown', overlayKeyDown, { once: true, capture: true });
    }
    else {
      overlayEl.classList.add('hidden');
    }
  };

  const onKeyUp = event => {
    switch (event.key) {
      case 'F1':
        toggleHelp();
        break;
      case 'Escape':
        terminateWorker();
        break;
    }
  };

  const onKeyDown = event => {
    switch (event.key) {
      case 'v':
        if (typeof navigator.clipboard.readText === 'function' && (event.metaKey || event.ctrlKey)) {
          navigator.clipboard.readText()
            .then(clipboardText => {
              document.execCommand('insertText', false, clipboardText);
            });
          event.stopPropagation();
          event.preventDefault();
        }
        break;
      default:
        break;
    }
    return false;
  };

  const fitOutputPane = () => {
    const h = document.getElementById('header').offsetHeight
      + document.getElementById('msg-container').offsetHeight
      + document.getElementById('input-pane').offsetHeight
      + document.getElementById('base-selector').offsetHeight
      + document.getElementById('footer').offsetHeight
      + 8 * 4 - 1;
    outputPaneEl.style.height = `${window.innerHeight - h}px`;
  };

  const onResize = () => {
    fitOutputPane();
  };

  const init = () => {
    try {
      const x = BigInt(0);
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
    msgContainerEl = document.getElementById('msg-container');
    msgEl = document.getElementById('msg');
    msgEl.innerHTML = '';
    baseFormEl = document.getElementById('base-form');
    document.getElementById(`base-${base}`).checked = true;
    baseFormEl.addEventListener('change', baseChanged);
    initWorker();
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('keydown', onKeyDown);
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
    if (typeof navigator.clipboard.readText === 'undefined') {
      inputPaneEl.addEventListener('paste', event => {
        const clipboardData = event.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('Text');
        const parser = new DOMParser().parseFromString(pastedData, 'text/html');
        const clipboardText = parser.body.textContent || '';
        document.execCommand('insertText', false, clipboardText);
        event.preventDefault();
        event.stopPropagation();
      });
    }
  };
  window.addEventListener('load', init);
})(window);
