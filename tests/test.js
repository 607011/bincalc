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

const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

vm.runInThisContext(fs.readFileSync('../shunting-yard.js'))

it('testing Stack', () => {
  let stack = new Stack()
  stack.push('foo')
  assert.ok(stack.length === 1)
  assert.ok(stack.top === 'foo')
  assert.ok(stack.pop() === 'foo')
  assert.ok(stack.length === 0)
})

it('testing tokenizer', () => {
  const tokenized = tokenize('(1+2)*3**4-5')
  const expectedTokens = [
    new Token(5, '('),
    new Token(1, 1n),
    new Token(2, '+'),
    new Token(1, 2n),
    new Token(6, ')'),
    new Token(2, '*'),
    new Token(1, 3n),
    new Token(2, '**'),
    new Token(1, 4n),
    new Token(2, '-'),
    new Token(1, 5n)
  ]
  assert.ok(tokenized.tokens.every((element, idx) => element.equals(expectedTokens[idx])))
})

it('testing shunting-yard', () => {
  const tokenized = tokenize('(1+2)*3**4-5')
  const expectedRPN = [
    new Token(1, 1n),
    new Token(1, 2n),
    new Token(2, '+'),
    new Token(1, 3n),
    new Token(1, 4n),
    new Token(2, '**'),
    new Token(2, '*'),
    new Token(1, 5n),
    new Token(2, '-')
  ]
  assert.ok(shuntingYard(tokenized.tokens).stack.every((element, idx) => element.equals(expectedRPN[idx])))
})
