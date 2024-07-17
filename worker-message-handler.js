// Copyright (c) 2019-2024 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at
// your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see http://www.gnu.org/licenses/.

'use strict';

self.importScripts('./numbercruncher.js')

self.onmessage = function(event) {
    let dtCalc = 0;
    let dtRender = 0;
    const expressions = event.data.expressions;
    const base = event.data.base;
    let errorFound = false;
    let results = [];
    const calculator = new Calculator();
    for (const expression of expressions) {
        postMessage({ log: expression });
        const calcT0 = Date.now();
        const expr = expression.replace(/\s+/g, '');
        const { result, error } = calculator.calculate(expr);
        dtCalc += Date.now() - calcT0;
        if (error) {
            errorFound = true;
            postMessage({ error: error.message || error });
            break;
        }
        if (typeof result === 'bigint' || result instanceof Array) {
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
            variables: calculator.variables,
            dtCalc: dtCalc,
            dtRender: dtRender,
        });
    }
};
