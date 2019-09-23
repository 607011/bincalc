// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG
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

importScripts('jsbi.js', 'shunting-yard.js', 'worker-message-handler.js');

const TRUE = JSBI.BigInt(1), FALSE = JSBI.BigInt(0);

Token.Functions = {
  max: {
    f: (...[a, b]) => JSBI.greaterThan(a, b) ? a : b,
    n: 2
  },
  min: {
    f: (...[a, b]) => JSBI.lessThan(a, b) ? a : b,
    n: 2
  },
  popcnt: {
    f: (...[a]) => {
      let popcnt = JSBI.__zero();
      const One = JSBI.BigInt(1);
      while (a > JSBI.__zero()) {
        if ((a & One) === One) {
          ++popcnt;
        }
        a = JSBI.signedRightShift(a, One);
      }
      return popcnt;
    },
    n: 1
  },
  gcd: {
    f: (...[a, b]) => {
      if (JSBI.equal(a, JSBI.__zero()) || JSBI.equal(b, JSBI.__zero())) {
        return JSBI.__zero();
      }
      while (!JSBI.equal(b, JSBI.__zero())) {
        [a, b] = [b, JSBI.remainder(a, b)];
      }
      return a;
    },
    n: 2
  },
  lcm: {
    f: (...[a, b]) => {
      if (JSBI.equal(a, JSBI.__zero()) || JSBI.equal(b, JSBI.__zero())) {
        return JSBI.__zero();
      }
      return JSBI.divide(JSBI.multiply(a, b), Token.Functions.gcd.f(a, b));
    },
    n: 2
  },
  sign: {
    f: (...[a]) => JSBI.lessThan(a, JSBI.__zero()) ? JSBI.BigInt(-1) : JSBI.BigInt(1),
    n: 1
  },
  sqrt: {
    f: (...[a]) => {
      const One = JSBI.BigInt(1);
      const Two = JSBI.BigInt(2);
      if (JSBI.lessThan(a, JSBI.__zero())) {
        throw 'cannot calculate square root of negative numbers';
      }
      else if (JSBI.lessThan(a, Two)) {
        return a;
      }
      let shift = Two;
      let nShifted = JSBI.signedRightShift(a, shift);
      while (!JSBI.equal(nShifted, JSBI.__zero()) && !JSBI.equal(nShifted, a)) {
        shift = JSBI.add(shift, Two);
        nShifted = JSBI.signedRightShift(a, shift);
      }
      shift = JSBI.subtract(shift, Two);
      let result = JSBI.__zero();
      while (JSBI.greaterThanOrEqual(shift, JSBI.__zero())) {
        result = JSBI.leftShift(result, One);
        const candidateResult = JSBI.add(result, One);
        if (JSBI.lessThanOrEqual(JSBI.multiply(candidateResult, candidateResult), JSBI.signedRightShift(a, shift))) {
          result = candidateResult;
        }
        shift = JSBI.subtract(shift, Two);
      }
      return result;
    },
    n: 1
  },
};


class Calculator {

  constructor() {
    this._variables = {};
  }

  get variables() {
    return this._variables;
  }

  calculate(expr) {
    const { tokens, error } = tokenize(expr);
    if (error) {
      return { error };
    }
    if (tokens) {
      const s = new Stack();
      const rpnTokens = shuntingYard(tokens);
      for (const t of rpnTokens) {
        if (t.type === Token.Type.Literal || t.type === Token.Type.Variable) {
          s.push(t);
        }
        else if (t.type === Token.Type.Function) {
          const n = Token.Functions[t.value].n;
          const f = Token.Functions[t.value].f;
          if (s.length < n) {
            return { result: undefined };
          }
          const args = (function(s, n) {
            let args = [];
            for (let i = 0; i < n; ++i) {
              const token = s.pop();
              if (token instanceof Token) {
                const value = (token.type === Token.Type.Literal)
                ? token.value
                : this._variables[token.value];
                if (value instanceof Array) {
                  args.unshift(value);
                }
                else {
                  return { error: `***undefined variable '${token.value}'` };
                }
              }
              else {
                return { error: 'illegal token' };
              }
            }
            return args;
          })(s, n);
          if (args instanceof Array) {
            try {
              const r = f(...args);
              s.push(new Token(Token.Type.Literal, r));
            }
            catch (error) {
              return { error };
            }
          }
          else {
            return { error: args.error };
          }
        }
        else if (t.type === Token.Type.Operator && t.value === Token.Symbols.UnaryMinus) {
          if (s.top) {
            switch (s.top.type) {
              case Token.Type.Literal:
                s.top.value = JSBI.unaryMinus(s.top.value);
                break;
              case Token.Type.Variable:
                s.top.value = JSBI.unaryMinus(this._variables[s.top.value]);
                s.top.type = Token.Type.Literal;
                break;
              default:
                break;
            }
          }
        }
        else {
          const bToken = s.pop();
          const aToken = s.pop();
          if (aToken instanceof Token && bToken instanceof Token) {
            if (bToken.type === Token.Type.Variable && !this._variables.hasOwnProperty(bToken.value)) {
              return { error: `undefined variable '${bToken.value}'` };
            }
            const a = (aToken.type === Token.Type.Literal)
              ? aToken.value
              : this._variables[aToken.value];
            const b = (bToken.type === Token.Type.Literal)
              ? bToken.value
              : this._variables[bToken.value];
            let r;
            try {
              switch (t.value) {
                case '=': this._variables[aToken.value] = b; break;
                case '+=': this._variables[aToken.value] = JSBI.add(a, b); break;
                case '-=': this._variables[aToken.value] = JSBI.subtract(a, b); break;
                case '/=': this._variables[aToken.value] = JSBI.divide(a, b); break;
                case '%=': this._variables[aToken.value] = JSBI.remainder(a, b); break;
                case '*=': this._variables[aToken.value] = JSBI.multiply(a, b); break;
                case '<<=': this._variables[aToken.value] = JSBI.leftShift(a, b); break;
                case '>>=': this._variables[aToken.value] = JSBI.signedRightShift(a, b); break;
                case '&=': this._variables[aToken.value] = JSBI.bitwiseAnd(a, b); break;
                case '|=': this._variables[aToken.value] = JSBI.bitwiseOr(a, b); break;
                case '^=': this._variables[aToken.value] = JSBI.bitwiseXor(a, b); break;
                case '+': r = JSBI.add(a, b); break;
                case '-': r = JSBI.subtract(a, b); break;
                case '*': r = JSBI.multiply(a, b); break;
                case '**': r = JSBI.exponentiate(a, b); break;
                case '/': r = JSBI.divide(a, b); break;
                case '%': r = JSBI.remainder(a, b); break;
                case '^': r = JSBI.bitwiseXor(a, b); break;
                case '|': r = JSBI.bitwiseOr(a, b); break;
                case '&': r = JSBI.bitwiseAnd(a, b); break;
                case '<<': r = JSBI.leftShift(a, b); break;
                case '>>': r = JSBI.signedRightShift(a, b); break;
                case '<': r = JSBI.lessThan(a, b) ? TRUE : FALSE; break;
                case '>': r = JSBI.greaterThan(a, b) ? TRUE : FALSE; break;
                case '<=': r = JSBI.lessThanOrEqual(a, b) ? TRUE : FALSE; break;
                case '>=': r = JSBI.greaterThanOrEqual(a, b) ? TRUE : FALSE; break;
                case '==': r = JSBI.equal(a, b) ? TRUE : FALSE; break;
                case '!=': r = JSBI.equal(a, b) ? FALSE : TRUE; break;
                case ',': break;
                default: return { error: `unknown operator: ${t.value}` };
              }
            }
            catch (e) {
              return { error: `invalid expression (${e.name}) ${e.message || ''}` };
            }
            if (r instanceof Array) {
              s.push(new Token(Token.Type.Literal, r));
            }
          }
        }
      }
      if (s.length === 1) {
        if (s.top.type === Token.Type.Variable) {
          if (this._variables.hasOwnProperty(s.top.value)) {
            return { result: this._variables[s.top.value] };
          }
          else {
            return { error: `undefined variable '${s.top.value}'` }
          }
        }
        return { result: s.top.value };
      }
      else {
        return { result: undefined };
      }
    }
    return { error: 'invalid expression' };
  }
}
