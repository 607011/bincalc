// Copyright (c) 2019 Oliver Lau <ola@ct.de>, Heise Medien GmbH & Co. KG

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
