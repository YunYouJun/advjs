import { describe, expect, it } from 'vitest'
import {
  evaluateRuntimeExpression,
  parseRuntimeExpression,
  RuntimeExpressionError,
} from '../../src/runtime'

describe('runtime expressions', () => {
  it('parses precedence and evaluates variable paths deterministically', () => {
    const expression = parseRuntimeExpression(
      'observation.count >= 2 && (matched || level + 1 == 3)',
    )

    expect(JSON.parse(JSON.stringify(expression))).toEqual(expression)
    expect(evaluateRuntimeExpression(expression, {
      observation: { count: 2 },
      matched: false,
      level: 2,
    })).toBe(true)
  })

  it('supports JSON literals and unary/arithmetic operators', () => {
    expect(evaluateRuntimeExpression(
      parseRuntimeExpression('!disabled && score * 2 - 1 >= 5'),
      { disabled: false, score: 3 },
    )).toBe(true)
    expect(evaluateRuntimeExpression(
      parseRuntimeExpression('label == "hamster" || value == null'),
      { label: 'hamster', value: null },
    )).toBe(true)
  })

  it.each([
    'window.alert(1)',
    'value = 1',
    'constructor.value',
    '__proto__.polluted',
    'items[0]',
  ])('rejects unsafe syntax: %s', (source) => {
    expect(() => parseRuntimeExpression(source)).toThrow(RuntimeExpressionError)
  })

  it('rejects non-finite arithmetic results', () => {
    expect(() => evaluateRuntimeExpression(
      parseRuntimeExpression('1 / 0'),
      {},
    )).toThrow(/finite number/)
  })
})
