// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

'use strict';

importScripts('jsbi.js');

Array.prototype.last = function() { return this[this.length - 1] };

const LEFT = -1, RIGHT = +1;
const TRUE = JSBI.BigInt(1), FALSE = JSBI.BigInt(0);

class Stack {
  constructor() {
    this._stack = [];
    this._nextIndex = 0;
  }
  push(value) {
    this._stack.push(value);
  }
  pop() {
    return this._stack.pop();
  }
  get top() {
    return this._stack[this._stack.length - 1];
  }
  set top(v) {
    this._stack[this._stack.length - 1] = v;
  }
  get length() {
    return this._stack.length;
  }
  [Symbol.iterator]() {
    return {
      next: () => {
        if (this._nextIndex < this.length) {
          return { value: this._stack[this._nextIndex++], done: false };
        }
        this._nextIndex = 0;
        return { done: true };
      }
    }
  }
}

class Token {
  constructor(type, value) {
    this._type = type;
    this._value = value;
  }
  get type() { return this._type; }
  get value() { return this._value; }
  set type(t) { this._type = t; }
  set value(v) { this._value = v; }
  get precedence() { return Token.Operator[this.value].prec; }
  get associativity() { return Token.Operator[this.value].assoc; }
}

Token.Type = (types => {
  let obj = {};
  for (const i in types) {
    obj[types[i]] = +i + 1;
  }
  return obj;
})(['Literal', 'Operator', 'Function', 'Variable', 'LeftParenthesis', 'RightParenthesis']);

Token.BasePrefix = { 2: '0b', 8: '0o', 10: '', 16: '0x' };

Token.Operators = ['~=', '~', '&=', '^=', '/=', '%=', '+=', '-=', '<<=', '>>=', '^', '&', '|', '+', '-', '**', '*', '/', '%', '<<', '>>', '==', '!=', '<=', '>=', '>', '<', '=', ','];

Token.Symbols = { UnaryMinus: '\u{2212}' };

Token.Functions = {
  max: {
    f: (...[a, b]) => JSBI.greaterThan(a, b) ? a : b,
    n: 2
  },
  min: {
    f: (...[a, b]) => JSBI.lessThan(a, b) ? a : b,
    n: 2
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
        shift += Two;
        nShifted = JSBI.signedRightShift(a, shift);
      }
      shift -= Two;
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

Token.Operator = {
  '\u2212': { prec: -3, assoc: RIGHT }, // unary minus
  '~': { prec: -3, assoc: RIGHT },
  '**': { prec: -4, assoc: RIGHT },
  '*': { prec: -5, assoc: LEFT },
  '/': { prec: -5, assoc: LEFT },
  '%': { prec: -5, assoc: LEFT },
  '+': { prec: -6, assoc: LEFT },
  '-': { prec: -6, assoc: LEFT },
  '<<': { prec: -7, assoc: LEFT },
  '>>': { prec: -7, assoc: LEFT },
  '<': { prec: -9, assoc: LEFT },
  '>': { prec: -9, assoc: LEFT },
  '==': { prec: -9, assoc: LEFT },
  '!=': { prec: -9, assoc: LEFT },
  '<=': { prec: -9, assoc: LEFT },
  '>=': { prec: -9, assoc: LEFT },
  '&': { prec: -11, assoc: LEFT },
  '^': { prec: -12, assoc: LEFT },
  '|': { prec: -13, assoc: LEFT },
  '=': { prec: -16, assoc: RIGHT },
  '&=': { prec: -16, assoc: RIGHT },
  '^=': { prec: -16, assoc: RIGHT },
  '|=': { prec: -16, assoc: RIGHT },
  '+=': { prec: -16, assoc: RIGHT },
  '-=': { prec: -16, assoc: RIGHT },
  '*=': { prec: -16, assoc: RIGHT },
  '/=': { prec: -16, assoc: RIGHT },
  '%=': { prec: -16, assoc: RIGHT },
  ',': { prec: -17, assoc: LEFT },
};

Object.keys(Token.Functions).forEach(f => {
  Token.Operator[f] = { prec: -1, assoc: RIGHT };
});

Token.Types = [
  { regex: new RegExp(`^(${Object.keys(Token.Functions).join('|')})`), type: Token.Type.Function, name: 'function' },
  { regex: new RegExp(`^(${Token.Operators.map(o => o.replace(/[\|\-\/\*\+\^\$]/g, '\\$&')).join('|')})`), type: Token.Type.Operator, name: 'operator' },
  { regex: /^b([01]+)/, type: Token.Type.Literal, base: 2, name: 'binary' },
  { regex: /^o([0-7]+)/, type: Token.Type.Literal, base: 8, name: 'octal' },
  { regex: /^([0-9]+)/, type: Token.Type.Literal, base: 10, name: 'decimal' },
  { regex: /^x([0-9a-fA-F]+)/, type: Token.Type.Literal, base: 16, name: 'hexadecimal' },
  { regex: /^([a-zA-Z_]+)/, type: Token.Type.Variable, name: 'variable' },
  { regex: /^(\()/, type: Token.Type.LeftParenthesis, name: 'left parenthesis' },
  { regex: /^(\))/, type: Token.Type.RightParenthesis, name: 'right parenthesis' },
];


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
              value = JSBI.BigInt(Token.BasePrefix[t.base] + symbol);
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

let shuntingYard = tokens => {
  let ops = new Stack();
  let queue = new Stack();
  for (const token of tokens) {
    switch (token.type) {
      case Token.Type.Literal:
      // fall-through
      case Token.Type.Variable:
        queue.push(token);
        break;
      case Token.Type.Function:
      // TODO
      case Token.Type.Operator:
        while (ops.top &&
          (ops.top.type !== Token.Type.LeftParenthesis)
          &&
          (
            (ops.top.precedence > token.precedence)
            ||
            (ops.top.precedence === token.precedence && ops.top.associativity === LEFT)
          )
        ) {
          queue.push(ops.pop());
        }
        if (token.value !== ',') {
          ops.push(token);
        }
        break;
      case Token.Type.LeftParenthesis:
        ops.push(token);
        break;
      case Token.Type.RightParenthesis:
        while (ops.top && ops.top.type !== Token.Type.LeftParenthesis) {
          queue.push(ops.pop());
        }
        if (ops.top.type === Token.Type.LeftParenthesis) {
          ops.pop();
        }
        break;
      default:
        break;
    }
  }
  while (ops.length > 0) {
    queue.push(ops.pop());
  }
  return queue;
}

let calculate = expr => {
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
              s.top.value = JSBI.unaryMinus(s.top.value);
              break;
            case Token.Type.Variable:
              s.top.value = JSBI.unaryMinus(variables[s.top.value]);
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
              case '+=': variables[aToken.value] = JSBI.add(a, b); break;
              case '-=': variables[aToken.value] = JSBI.subtract(a, b); break;
              case '/=': variables[aToken.value] = JSBI.divide(a, b); break;
              case '%=': variables[aToken.value] = JSBI.remainder(a, b); break;
              case '*=': variables[aToken.value] = JSBI.multiply(a, b); break;
              case '<<=': variables[aToken.value] = JSBI.leftShift(a, b); break;
              case '>>=': variables[aToken.value] = JSBI.signedRightShift(a, b); break;
              case '&=': variables[aToken.value] = JSBI.bitwiseAnd(a, b); break;
              case '|=': variables[aToken.value] = JSBI.bitwiseOr(a, b); break;
              case '^=': variables[aToken.value] = JSBI.bitwiseXor(a, b); break;
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
    const { result, error } = calculate(expr, base);
    dtCalc += Date.now() - calcT0;
    if (error) {
      errorFound = true;
      console.error(error.message);
      postMessage({ error: error.message || error });
      break;
    }
    if (result instanceof Array) {
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
