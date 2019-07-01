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

importScripts('shunting-yard.js', 'worker-message-handler.js');

const TRUE = 1n, FALSE = 0n;

Token.Functions = {
  max: {
    f: (...[a, b]) => a > b ? a : b,
    n: 2
  },
  min: {
    f: (...[a, b]) => a < b ? a : b,
    n: 2
  },
  gcd: {
    f: (...[a, b]) => {
      if (a === 0n || b === 0n) {
        return 0n;
      }
      while (b !== 0n) {
        [a, b] = [b, a % b];
      }
      return a;
    },
    n: 2
  },
  lcm: {
    f: (...[a, b]) => {
      if (a === 0n || b === 0n) {
        return 0n;
      }
      return a * b / Token.Functions.gcd.f(a, b);
    },
    n: 2
  },
  sign: {
    f: (...[a]) => a < 0n ? -1n : 1n,
    n: 1
  },
  sqrt: {
    f: (...[a]) => {
      if (a < 0n) {
        throw 'cannot calculate square root of negative numbers';
      }
      else if (a < 2n) {
        return a;
      }
      let shift = 2n;
      let nShifted = a >> shift;
      while (nShifted !== 0n && nShifted !== a) {
        shift += 2n;
        nShifted = a >> shift;
      }
      shift -= 2n;
      let result = 0n;
      while (shift >= 0n) {
        result <<= 1n;
        const candidateResult = result + 1n;
        if ((candidateResult * candidateResult) <= (a >> shift)) {
          result = candidateResult;
        }
        shift -= 2n;
      }
      return result;
    },
    n: 1
  },
};


class Calculator {
  constructor() {
    this.variables = {};
  }

  calculate(expr) {
    const { tokens, error } = tokenize(expr);
    if (error) {
      return { error: error };
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
                : this.variables[token.value];
                if (typeof value === 'bigint') {
                  args.unshift(value);
                }
                else {
                  return { error: `undefined variable '${token.value}'` };
                }
              }
              else {
                return { error: 'illegal token' };
              }
            }
            return args;
          }.bind(this))(s, n);
          if (args instanceof Array) {
            try {
              const r = f(...args);
              s.push(new Token(Token.Type.Literal, r));
            }
            catch (e) {
              return { error: e };
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
                s.top.value = -s.top.value;
                break;
              case Token.Type.Variable:
                s.top.value = -this.variables[s.top.value];
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
            if (bToken.type === Token.Type.Variable && !this.variables.hasOwnProperty(bToken.value)) {
              return { error: `undefined variable '${bToken.value}'` };
            }
            const a = (aToken.type === Token.Type.Literal)
              ? aToken.value
              : this.variables[aToken.value];
            const b = (bToken.type === Token.Type.Literal)
              ? bToken.value
              : this.variables[bToken.value];
            let r;
            try {
              switch (t.value) {
                case '=': this.variables[aToken.value] = b; break;
                case '+=': this.variables[aToken.value] = a + b; break;
                case '-=': this.variables[aToken.value] = a - b; break;
                case '/=': this.variables[aToken.value] = a / b; break;
                case '%=': this.variables[aToken.value] = a % b; break;
                case '*=': this.variables[aToken.value] = a * b; break;
                case '<<=': this.variables[aToken.value] = a << b; break;
                case '>>=': this.variables[aToken.value] = a >> b; break;
                case '&=': this.variables[aToken.value] = a & b; break;
                case '|=': this.variables[aToken.value] = a | b; break;
                case '^=': this.variables[aToken.value] = a ^ b; break;
                case '+': r = a + b; break;
                case '-': r = a - b; break;
                case '*': r = a * b; break;
                case '**': r = a ** b; break;
                case '/': r = a / b; break;
                case '%': r = a % b; break;
                case '^': r = a ^ b; break;
                case '|': r = a | b; break;
                case '&': r = a & b; break;
                case '<<': r = a << b; break;
                case '>>': r = a >> b; break;
                case '<': r = a < b ? TRUE : FALSE; break;
                case '>': r = a > b ? TRUE : FALSE; break;
                case '<=': r = a <= b ? TRUE : FALSE; break;
                case '>=': r = a >= b ? TRUE : FALSE; break;
                case '==': r = a == b ? TRUE : FALSE; break;
                case '!=': r = a != b ? TRUE : FALSE; break;
                case ',': break;
                default: return { error: `unknown operator: ${t.value}` };
              }
            }
            catch (e) {
              return { error: `${e.name}: ${e.message || ''}` };
            }
            if (typeof r === 'bigint') {
              s.push(new Token(Token.Type.Literal, r));
            }
          }
        }
      }
      if (s.length === 1) {
        if (s.top.type === Token.Type.Variable) {
          if (this.variables.hasOwnProperty(s.top.value)) {
            return { result: this.variables[s.top.value] };
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
