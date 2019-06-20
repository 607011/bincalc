// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

'use strict';

importScripts('jsbi.js', 'stack.js', 'token.js', 'worker-message-handler.js');

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
