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

it('testing shunting-yard', () => {
  const tokenized = tokenize('(1+2)*3**4-5')
  const expected = [
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
  assert.ok(
    tokenized.tokens.every((element, idx) => {
      return element.equals(expected[idx])
    })
  )
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
  assert.ok(
    shuntingYard(tokenized.tokens).stack.every((element, idx) => {
      return element.equals(expectedRPN[idx])
    })
  )
})
