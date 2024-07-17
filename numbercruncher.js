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


// Set or get the last element in an array.
Object.defineProperty(Array.prototype, 'last', {
    get: function () { return this[this.length - 1]; },
    set: function (v) { this[this.length - 1] = v; },
});

class Stack {
    constructor() {
        this._stack = new Array();
        this._nextIndex = 0;
    }
    push(value) { this._stack.push(value); }
    pop() { return this._stack.pop(); }
    get top() { return this._stack.last; }
    notEmpty() { return this._stack.length > 0; }
    set top(v) { this._stack.last = v; }
    get length() { return this._stack.length; }
    get stack() { return this._stack; }
}

class Queue {
    constructor() {
        this._queue = new Array();
        this._nextIndex = 0;
    }
    push(value) { this._queue.push(value); }
    pop() { return this._queue.pop(); }
    get length() { return this._queue.length; }
    get top() { return this._queue.last; }
    values() { return this._queue; }
    [Symbol.iterator]() {
        return {
            next: () => {
                if (this._nextIndex < this.length) {
                    return {
                        value: this._queue[this._nextIndex++],
                        done: false,
                    };
                }
                this._nextIndex = 0;
                return {
                    done: true,
                };
            }
        }
    }
}

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
    get precedence() { return Token.OperatorPrecAssoc[this.value].prec; }
    get associativity() { return Token.OperatorPrecAssoc[this.value].assoc; }
    equals(other) {
        return this._type === other.type
            && this._value === other.value;
    }
}

// Token.Type is an object containing the name of a token (key)
// with an associated value.
Token.Type = Object.freeze({
    Literal: Symbol('Literal'),
    Operator: Symbol('Operator'),
    Function: Symbol('Function'),
    Variable: Symbol('Variable'),
    LeftParenthesis: Symbol('LeftParenthesis'),
    RightParenthesis: Symbol('RightParenthesis'),
});

Token.BasePrefix = Object.freeze({ 2: '0b', 8: '0o', 10: '', 16: '0x' });

// Token.Operators contains the list of valid operators.
Token.Operators = Object.freeze([
    '~=', '~', '&=', '^=', '/=', '%=', '+=', '-=', '<<=', '>>=',
    '^', '&', '|', '+', '-',
    '**', '*', '/', '%',
    '<<', '>>',
    '==', '!=', '<=', '>=',
    '>', '<', '=', ',']);

// There are special operators which are not recognized by the
// tokenizer but later on represent a symbol with a new meaning.
// Currently, only the unary minus belongs to these operators.
Token.Symbols = Object.freeze({ UnaryMinus: '\u{2212}' });

const ASSOC = Object.freeze({
    LEFT: -1,
    RIGHT: +1,
});

// Token.Operator defines the precedence and associativity of
// all operators recognized by the calculator.
Token.OperatorPrecAssoc = {
    '\u2212': { prec: -3, assoc: ASSOC.RIGHT }, // unary minus
    '~': { prec: -3, assoc: ASSOC.RIGHT },
    '**': { prec: -4, assoc: ASSOC.RIGHT },
    '*': { prec: -5, assoc: ASSOC.LEFT },
    '/': { prec: -5, assoc: ASSOC.LEFT },
    '%': { prec: -5, assoc: ASSOC.LEFT },
    '+': { prec: -6, assoc: ASSOC.LEFT },
    '-': { prec: -6, assoc: ASSOC.LEFT },
    '<<': { prec: -7, assoc: ASSOC.LEFT },
    '>>': { prec: -7, assoc: ASSOC.LEFT },
    '<': { prec: -9, assoc: ASSOC.LEFT },
    '>': { prec: -9, assoc: ASSOC.LEFT },
    '==': { prec: -9, assoc: ASSOC.LEFT },
    '!=': { prec: -9, assoc: ASSOC.LEFT },
    '<=': { prec: -9, assoc: ASSOC.LEFT },
    '>=': { prec: -9, assoc: ASSOC.LEFT },
    '&': { prec: -11, assoc: ASSOC.LEFT },
    '^': { prec: -12, assoc: ASSOC.LEFT },
    '|': { prec: -13, assoc: ASSOC.LEFT },
    '=': { prec: -16, assoc: ASSOC.RIGHT },
    '&=': { prec: -16, assoc: ASSOC.RIGHT },
    '^=': { prec: -16, assoc: ASSOC.RIGHT },
    '|=': { prec: -16, assoc: ASSOC.RIGHT },
    '+=': { prec: -16, assoc: ASSOC.RIGHT },
    '-=': { prec: -16, assoc: ASSOC.RIGHT },
    '*=': { prec: -16, assoc: ASSOC.RIGHT },
    '/=': { prec: -16, assoc: ASSOC.RIGHT },
    '%=': { prec: -16, assoc: ASSOC.RIGHT },
    ',': { prec: -17, assoc: ASSOC.LEFT },
};

const AvailableFunctions = {
    max: {
        f: (...[a, b]) => a > b ? a : b,
        n: 2,
    },
    min: {
        f: (...[a, b]) => a < b ? a : b,
        n: 2,
    },
    popcnt: {
        f: (...[a]) => {
            let popcnt = 0n;
            while (a > 0n) {
                if ((a & 1n) === 1n) {
                    ++popcnt;
                }
                a >>= 1n;
            }
            return popcnt;
        },
        n: 1,
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
        n: 2,
    },
    lcm: {
        f: (...[a, b]) => {
            if (a === 0n || b === 0n) {
                return 0n;
            }
            return a * b / AvailableFunctions.gcd.f(a, b);
        },
        n: 2,
    },
    sign: {
        f: (...[a]) => a < 0n ? -1n : 1n,
        n: 1,
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
        n: 1,
    },
};

// All functions defined in AvailableFunctions have the highest precedence
// of -1 and are right-associative.
Object.keys(AvailableFunctions).forEach(f => {
    Token.OperatorPrecAssoc[f] = { prec: -1, assoc: ASSOC.RIGHT };
});
Object.freeze(Token.OperatorPrecAssoc);


// To discover the type of each token found in the expression
// regex's are used.
Token.Types = Object.freeze([
    { regex: new RegExp(`^(${Object.keys(AvailableFunctions).join('|')})`), type: Token.Type.Function, name: 'function' },
    { regex: new RegExp(`^(${Token.Operators.map(o => o.replace(/[\|\-\/\*\+\^\$]/g, '\\$&')).join('|')})`), type: Token.Type.Operator, name: 'operator' },
    { regex: /^b([01]+)/, type: Token.Type.Literal, base: 2, name: 'binary' },
    { regex: /^o([0-7]+)/, type: Token.Type.Literal, base: 8, name: 'octal' },
    { regex: /^([0-9]+)/, type: Token.Type.Literal, base: 10, name: 'decimal' },
    { regex: /^x([0-9a-fA-F]+)/, type: Token.Type.Literal, base: 16, name: 'hexadecimal' },
    { regex: /^([a-zA-Z_][a-zA-Z0-9_]*)/, type: Token.Type.Variable, name: 'variable' },
    { regex: /^(\()/, type: Token.Type.LeftParenthesis, name: 'left parenthesis' },
    { regex: /^(\))/, type: Token.Type.RightParenthesis, name: 'right parenthesis' },
]);


class ShuntingYard {
    // tokenize() parses the expression into tokens of type Token.
    static tokenize(expr) {
        let tokens = [];
        while (expr.length > 0) {
            let found = false;
            for (let i = 0; i < Token.Types.length && !found; ++i) {
                const t = Token.Types[i];
                const m = expr.match(t.regex);
                if (m && m.length > 0) {
                    const len = m[0].length;
                    let symbol = m[1];
                    let value;
                    switch (t.type) {
                        case Token.Type.Literal:
                            try {
                                value = BigInt(Token.BasePrefix[t.base] + symbol);
                            }
                            catch (error) {
                                return { error };
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
        return { tokens };
    }

    // The Shunting-Yard algorithm takes a list of tokens and rearranges them
    // into an array with the tokens in Reverse Polish Notation.
    static shunt(tokens) {
        const ops = new Stack();
        const queue = new Queue();
        for (const token of tokens) {
            switch (token.type) {
                case Token.Type.Literal:
                // fall-through
                case Token.Type.Variable:
                    queue.push(token);
                    break;
                case Token.Type.LeftParenthesis:
                    ops.push(token);
                    break;
                case Token.Type.RightParenthesis:
                    while (ops.notEmpty() && ops.top.type !== Token.Type.LeftParenthesis) {
                        queue.push(ops.pop());
                    }
                    if (ops.top.type === Token.Type.LeftParenthesis) {
                        ops.pop();
                    }
                    break;
                case Token.Type.Function:
                // TODO
                case Token.Type.Operator:
                    while (ops.notEmpty() &&
                        (ops.top.type !== Token.Type.LeftParenthesis)
                        &&
                        (
                            (ops.top.precedence > token.precedence)
                            ||
                            (ops.top.precedence === token.precedence && ops.top.associativity === ASSOC.LEFT)
                        )
                    ) {
                        queue.push(ops.pop());
                    }
                    if (token.value !== ',') {
                        ops.push(token);
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
};


class Calculator {
    constructor() {
        this.variables = {};
    }

    static TRUE = 1n;
    static FALSE = 0n;

    calculate(expr) {
        const { tokens, error } = ShuntingYard.tokenize(expr);
        if (error) {
            return { error: error };
        }
        if (tokens.length === 0) {
            return { error: 'invalid expression' };
        }
        const rpnTokens = ShuntingYard.shunt(tokens);
        const s = new Queue();
        for (const t of rpnTokens) {
            if (t.type === Token.Type.Literal || t.type === Token.Type.Variable) {
                s.push(t);
            }
            else if (t.type === Token.Type.Function) {
                const n = AvailableFunctions[t.value].n;
                const f = AvailableFunctions[t.value].f;
                if (s.length < n) {
                    return { result: undefined };
                }
                const args = (function (s, n) {
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
                if (s.notEmpty()) {
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
                            case '<': r = a < b ? Calculator.TRUE : Calculator.FALSE; break;
                            case '>': r = a > b ? Calculator.TRUE : Calculator.FALSE; break;
                            case '<=': r = a <= b ? Calculator.TRUE : Calculator.FALSE; break;
                            case '>=': r = a >= b ? Calculator.TRUE : Calculator.FALSE; break;
                            case '==': r = a == b ? Calculator.TRUE : Calculator.FALSE; break;
                            case '!=': r = a != b ? Calculator.TRUE : Calculator.FALSE; break;
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
}
