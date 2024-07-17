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

vm.runInThisContext(fs.readFileSync('../numbercruncher.js'))

it('testing Stack', () => {
  let stack = new Stack()
  stack.push('foo')
  assert.ok(stack.length === 1)
  assert.ok(stack.top === 'foo')
  assert.ok(stack.pop() === 'foo')
  assert.ok(stack.length === 0)
})

it('testing tokenizer', () => {
  const tokenized = ShuntingYard.tokenize('(1+2)*3**4-5')
  const expectedTokens = [
    new Token(Token.Type.LeftParenthesis, '('),
    new Token(Token.Type.Literal, 1n),
    new Token(Token.Type.Operator, '+'),
    new Token(Token.Type.Literal, 2n),
    new Token(Token.Type.RightParenthesis, ')'),
    new Token(Token.Type.Operator, '*'),
    new Token(Token.Type.Literal, 3n),
    new Token(Token.Type.Operator, '**'),
    new Token(Token.Type.Literal, 4n),
    new Token(Token.Type.Operator, '-'),
    new Token(Token.Type.Literal, 5n)
  ]
  assert.ok(tokenized.tokens.every((element, idx) => element.equals(expectedTokens[idx])))
})

it('testing shunting-yard', () => {
  const tokenized = ShuntingYard.tokenize('(1+2)*3**4-5')
  const expectedRPN = [
    new Token(Token.Type.Literal, 1n),
    new Token(Token.Type.Literal, 2n),
    new Token(Token.Type.Operator, '+'),
    new Token(Token.Type.Literal, 3n),
    new Token(Token.Type.Literal, 4n),
    new Token(Token.Type.Operator, '**'),
    new Token(Token.Type.Operator, '*'),
    new Token(Token.Type.Literal, 5n),
    new Token(Token.Type.Operator, '-')
  ]
  const rpnTokens = ShuntingYard.shunt(tokenized.tokens);
  assert.ok(rpnTokens.values().every((element, idx) => element.equals(expectedRPN[idx])))
})
