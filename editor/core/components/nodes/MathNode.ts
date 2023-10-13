import { NodeInterface, NumberInterface, SelectInterface, defineNode } from 'baklavajs'

export default defineNode({
  type: 'MathNode',
  inputs: {
    number1: () => new NumberInterface('Number', 1),
    number2: () => new NumberInterface('Number', 10),
    operation: () => new SelectInterface('Operation', 'Add', ['Add', 'Subtract']).setPort(false),
  },
  outputs: {
    output: () => new NodeInterface('Output', 0),
  },
  calculate({ number1, number2, operation }) {
    let output
    if (operation === 'Add')
      output = number1 + number2

    else if (operation === 'Subtract')
      output = number1 - number2

    else
      throw new Error(`Unknown operation: ${operation}`)

    return { output }
  },
})
