// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

'use strict';

// ensure that JSBI is defined when using the message handler in browsers with BigInt support
if (typeof JSBI !== 'function') {
  self.JSBI = self;
}

onmessage = event => {
  let dtCalc = 0;
  let dtRender = 0;
  const expressions = event.data.expressions;
  const base = event.data.base;
  let errorFound = false;
  let results = [];
  let calculator = new Calculator();
  for (const expression of expressions) {
    const calcT0 = Date.now();
    const expr = expression.replace(/\s+/g, '');
    const { result, error } = calculator.calculate(expr);
    dtCalc += Date.now() - calcT0;
    if (error) {
      errorFound = true;
      postMessage({ error: error.message || error });
      break;
    }
    if (typeof result === 'bigint' || result instanceof JSBI) {
      const renderT0 = Date.now();
      results.push({
        expression: expr,
        result: result.toString(base),
      });
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
