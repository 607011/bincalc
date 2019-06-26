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

// Set or get the last element in an array.
Object.defineProperty(Array.prototype, 'last', {
  get: function() { return this[this.length-1]; },
  set: function(v) { this[this.length-1] = v; },
});

// Stack represents a classic stack from which you can pop items
// or push items onto it.
class Stack {
  constructor() {
    this._stack = [];
    this._nextIndex = 0;
  }
  push(value) { this._stack.push(value); }
  pop() { return this._stack.pop(); }
  get top() { return this._stack.last; }
  set top(v) { this._stack.last = v; }
  get length() { return this._stack.length; }
  get stack() { return this._stack; }
  [Symbol.iterator]() {
    return {
      next: () => {
        if (this._nextIndex < this.length) {
          return {
            value: this._stack[this._nextIndex++],
            done: false
          };
        }
        this._nextIndex = 0;
        return {
          done: true
        };
      }
    }
  }
}

// LEFT and RIGHT are constants to determine whether a token
// in an expression is left- or right-associative.
const LEFT = -1, RIGHT = +1;

// Token represents an operator, variable or constant value.
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
  equals(other) {
    return this._type === other.type
      && this._value === other.value;
  }
}

// Token.Type is an object containing the name of a token (key)
// with an associated value.
Token.Type = (types => {
  let obj = {};
  for (const i in types) {
    obj[types[i]] = +i + 1;
  }
  return obj;
})(['Literal', 'Operator', 'Function', 'Variable', 'LeftParenthesis', 'RightParenthesis']);

Token.BasePrefix = { 2: '0b', 8: '0o', 10: '', 16: '0x' };

// Token.Operators contains the list of valid operators.
Token.Operators = ['~=', '~', '&=', '^=', '/=', '%=', '+=', '-=', '<<=', '>>=', '^', '&', '|', '+', '-', '**', '*', '/', '%', '<<', '>>', '==', '!=', '<=', '>=', '>', '<', '=', ','];

// There are special operators which are not recognized by the
// tokenizer but later on must represent a symbol with a new meaning.
// Currently, only the unary minus belongs to these operators.
Token.Symbols = { UnaryMinus: '\u{2212}' };

// Token.Operator defines the precedence and associativity of
// all valid operators
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

// Depending on whether BigInt or JSBI.BigInt is supported there are
// predefined functions you can use within Arbitrary Precision Calculator.
// The actual implementations are defined in the respective
// numbercruncher-*.js files.
Token.Functions = {
  max: null,
  min: null,
  gcd: null,
  lcm: null,
  sign: null,
  sqrt: null,
};

// All functions defined in Token.Functions have the highest precedence
// of -1 and are right-associative.
Object.keys(Token.Functions).forEach(f => {
  Token.Operator[f] = { prec: -1, assoc: RIGHT };
});

// To discover the type of each token found in the expression
// regex's are used
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

// tokenize() parses the expression into tokens of type Token.
let tokenize = expr => {
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
              if (typeof JSBI !== 'function') {
                value = BigInt(Token.BasePrefix[t.base] + symbol);
              }
              else {
                value = JSBI.BigInt(Token.BasePrefix[t.base] + symbol);
              }
            }
            catch (e) {
              return { error: e };
            }
            break;
          default:
            if (symbol === '-'
              &&
              (
                tokens.length === 0 ||
                tokens.last.type === Token.Type.LeftParenthesis ||
                Token.Operators.indexOf(tokens.last.value) >= 0
              )
            ) {
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
      return { error: `invalid expression: ${expr}` };
    }
  }
  return { tokens: tokens };
}

// The Shunting-Yard algorithm takes a list of tokens and rearranges them
// into an array with the tokens in Reverse Polish Notation.
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
