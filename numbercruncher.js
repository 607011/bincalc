// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

'use strict';

importScripts('token.js', 'stack.js', 'shunting-yard.js', 'worker-message-handler.js');

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


let variables = {};
let results = [];


let tokenize = str => {
  let expr = str.replace(/\s+/g, '');
  let tokens = [];
  while (expr.length > 0) {
    let found = false;
    for (let i = 0; i < Token.Types.length && !found; ++i) {
      let t = Token.Types[i];
      let m = expr.match(t.regex);
      if (m && m.length > 0) {
        let symbol = m[1];
        let len = m[0].length;
        let value;
        switch (t.type) {
          case Token.Type.Literal:
            try {
              value = BigInt(Token.BasePrefix[t.base] + symbol);
            }
            catch (e) {
              return { error: e };
            }
            break;
          default:
            if (symbol === '-' && (tokens.length === 0 || tokens.last().type === Token.Type.LeftParenthesis || (tokens.last().value in Token.Operators))) {
              symbol = Token.Symbols.UnaryMinus;
            }
            value = symbol;
            break;
        }
        tokens.push(new Token(t.type, value));
        expr = expr.substring(len);
        found = true;
      }
    }
    if (!found) {
      return { error: `invalid expression: ${str}` };
    }
  }
  return { tokens: tokens };
}

let calculate = (expr) => {
  let { tokens, error } = tokenize(expr);
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
              : variables[token.value];
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
        })(s, n);
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
              s.top.value = -variables[s.top.value];
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
          if (bToken.type === Token.Type.Variable && !variables.hasOwnProperty(bToken.value)) {
            return { error: `undefined variable '${bToken.value}'` };
          }
          let a = (aToken.type === Token.Type.Literal)
            ? aToken.value
            : variables[aToken.value];
          let b = (bToken.type === Token.Type.Literal)
            ? bToken.value
            : variables[bToken.value];
          let r;
          try {
            switch (t.value) {
              case '=': variables[aToken.value] = b; break;
              case '+=': variables[aToken.value] = a + b; break;
              case '-=': variables[aToken.value] = a - b; break;
              case '/=': variables[aToken.value] = a / b; break;
              case '%=': variables[aToken.value] = a % b; break;
              case '*=': variables[aToken.value] = a * b; break;
              case '<<=': variables[aToken.value] = a << b; break;
              case '>>=': variables[aToken.value] = a >> b; break;
              case '&=': variables[aToken.value] = a & b; break;
              case '|=': variables[aToken.value] = a | b; break;
              case '^=': variables[aToken.value] = a ^ b; break;
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
            return { error: `invalid expression (${e.name}) ${e.message || ''}` };
          }
          if (typeof r === 'bigint') {
            s.push(new Token(Token.Type.Literal, r));
          }
        }
      }
    }
    if (s.length === 1) {
      if (s.top.type === Token.Type.Variable) {
        if (variables.hasOwnProperty(s.top.value)) {
          return { result: variables[s.top.value] };
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
};
