const assert = require('assert')

const fs = require('fs')
const vm = require('vm')

vm.runInThisContext(fs.readFileSync('../stack.js'))

it('testing Stack', () => {
  let stack = new Stack()
  stack.push('foo')
  assert.ok(stack.length === 1)
  assert.ok(stack.top === 'foo')
  assert.ok(stack.pop() === 'foo')
  assert.ok(stack.length === 0)
})

vm.runInThisContext(fs.readFileSync('../token.js'))

it('testing Token', () => {
  const tokens = tokenize('1+2*3**4-5').tokens
  const expected = [
    new Token(1, 1n),
    new Token(2, '+'),
    new Token(1, 2n),
    new Token(2, '*'),
    new Token(1, 3n),
    new Token(2, '**'),
    new Token(1, 4n),
    new Token(2, '-'),
    new Token(1, 5n)
  ]
  assert.ok(
    tokens.every((element, idx) => {
      return element.equals(expected[idx])
    })
  )
})