// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

'use strict';

Object.defineProperty(Array.prototype, 'last', {
  get: function() { return this[this.length-1]; },
  set: function(v) { this[this.length-1] = v; },
});

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
