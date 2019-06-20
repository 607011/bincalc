// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

'use strict';

onmessage = event => {
  let dtCalc = 0;
  let dtRender = 0;
  const expressions = event.data.expressions;
  const base = event.data.base;
  let errorFound = false;
  let results = [];
  variables = {};
  for (const expr of expressions) {
    const calcT0 = Date.now();
    const { result, error } = calculate(expr);
    dtCalc += Date.now() - calcT0;
    if (error) {
      errorFound = true;
      console.error(error.message);
      postMessage({ error: error.message || error });
      break;
    }
    if (result instanceof Array || typeof result === 'bigint') {
      const renderT0 = Date.now();
      results.push(result.toString(base));
      dtRender += Date.now() - renderT0;
    }
  }
  if (!errorFound) {
    postMessage({
      results: results,
      dtCalc: dtCalc,
      dtRender: dtRender,
    });
  }
}
