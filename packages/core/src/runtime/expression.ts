import type {
  JsonObject,
  RuntimeBinaryOperator,
  RuntimeExpression,
} from '@advjs/types'

type TokenKind = 'number' | 'string' | 'identifier' | 'operator' | 'eof'

interface Token {
  kind: TokenKind
  value: string
  offset: number
}

const blockedPathSegments = new Set(['__proto__', 'prototype', 'constructor'])
const binaryPrecedence: Array<RuntimeBinaryOperator[]> = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
]

export class RuntimeExpressionError extends Error {
  readonly code = 'ADV_RUNTIME_INVALID_EXPRESSION'

  constructor(message: string) {
    super(`ADV_RUNTIME_INVALID_EXPRESSION: ${message}`)
    this.name = 'RuntimeExpressionError'
  }
}

function syntax(message: string, offset: number): never {
  throw new RuntimeExpressionError(`${message} at offset ${offset}`)
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let offset = 0
  while (offset < source.length) {
    if (/\s/u.test(source[offset])) {
      offset++
      continue
    }

    const start = offset
    const pair = source.slice(offset, offset + 2)
    if (['&&', '||', '==', '!=', '<=', '>='].includes(pair)) {
      tokens.push({ kind: 'operator', value: pair, offset })
      offset += 2
      continue
    }

    const character = source[offset]
    if ('!<>+-*/%()'.includes(character)) {
      tokens.push({ kind: 'operator', value: character, offset })
      offset++
      continue
    }

    if (character === '"') {
      offset++
      let escaped = false
      while (offset < source.length) {
        const current = source[offset]
        offset++
        if (!escaped && current === '"')
          break
        escaped = !escaped && current === '\\'
      }
      const raw = source.slice(start, offset)
      try {
        const value = JSON.parse(raw)
        if (typeof value !== 'string')
          syntax('Invalid string literal', start)
        tokens.push({ kind: 'string', value, offset: start })
      }
      catch {
        syntax('Invalid string literal', start)
      }
      continue
    }

    const number = source.slice(offset).match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/iu)?.[0]
    if (number) {
      tokens.push({ kind: 'number', value: number, offset })
      offset += number.length
      continue
    }

    const identifier = source.slice(offset).match(/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/u)?.[0]
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier, offset })
      offset += identifier.length
      continue
    }

    syntax(`Unexpected token ${JSON.stringify(character)}`, offset)
  }
  tokens.push({ kind: 'eof', value: '', offset })
  return tokens
}

class ExpressionParser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): RuntimeExpression {
    const expression = this.parsePrecedence(0)
    const token = this.peek()
    if (token.kind !== 'eof')
      syntax(`Unexpected token ${JSON.stringify(token.value)}`, token.offset)
    return expression
  }

  private peek(): Token {
    return this.tokens[this.index]
  }

  private take(): Token {
    return this.tokens[this.index++]
  }

  private parsePrecedence(level: number): RuntimeExpression {
    if (level >= binaryPrecedence.length)
      return this.parseUnary()
    let left = this.parsePrecedence(level + 1)
    while (binaryPrecedence[level].includes(this.peek().value as RuntimeBinaryOperator)) {
      const operator = this.take().value as RuntimeBinaryOperator
      left = {
        type: 'binary',
        operator,
        left,
        right: this.parsePrecedence(level + 1),
      }
    }
    return left
  }

  private parseUnary(): RuntimeExpression {
    const token = this.peek()
    if (token.value === '!' || token.value === '-') {
      this.take()
      return { type: 'unary', operator: token.value, argument: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): RuntimeExpression {
    const token = this.take()
    if (token.value === '(') {
      const expression = this.parsePrecedence(0)
      const close = this.take()
      if (close.value !== ')')
        syntax('Expected closing parenthesis', close.offset)
      return expression
    }
    if (token.kind === 'number') {
      const value = Number(token.value)
      if (!Number.isFinite(value))
        syntax('Number must be finite', token.offset)
      return { type: 'literal', value }
    }
    if (token.kind === 'string')
      return { type: 'literal', value: token.value }
    if (token.kind === 'identifier') {
      if (token.value === 'true' || token.value === 'false')
        return { type: 'literal', value: token.value === 'true' }
      if (token.value === 'null')
        return { type: 'literal', value: null }
      const path = token.value.split('.')
      if (path.some(segment => blockedPathSegments.has(segment)))
        syntax('Unsafe variable path', token.offset)
      return { type: 'variable', path }
    }
    syntax('Expected a literal, variable, or parenthesized expression', token.offset)
  }
}

export function parseRuntimeExpression(source: string): RuntimeExpression {
  if (!source.trim())
    throw new RuntimeExpressionError('Expression cannot be empty')
  return new ExpressionParser(tokenize(source)).parse()
}

function numeric(value: unknown, operator: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new RuntimeExpressionError(`${operator} requires finite numbers`)
  return value
}

function comparable(left: unknown, right: unknown, operator: string): [number | string, number | string] {
  if (typeof left === 'number' && typeof right === 'number')
    return [left, right]
  if (typeof left === 'string' && typeof right === 'string')
    return [left, right]
  throw new RuntimeExpressionError(`${operator} requires two numbers or two strings`)
}

function finiteResult(value: number, operator: string): number {
  if (!Number.isFinite(value))
    throw new RuntimeExpressionError(`${operator} must produce a finite number`)
  return value
}

export function evaluateRuntimeExpression(
  expression: RuntimeExpression,
  variables: Readonly<JsonObject>,
): unknown {
  if (expression.type === 'literal')
    return structuredClone(expression.value)
  if (expression.type === 'variable') {
    let value: unknown = variables
    for (const segment of expression.path) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined
      value = (value as JsonObject)[segment]
    }
    return value
  }
  if (expression.type === 'unary') {
    const value = evaluateRuntimeExpression(expression.argument, variables)
    return expression.operator === '!' ? !value : -numeric(value, '-')
  }

  if (expression.operator === '&&') {
    return Boolean(evaluateRuntimeExpression(expression.left, variables))
      && Boolean(evaluateRuntimeExpression(expression.right, variables))
  }
  if (expression.operator === '||') {
    return Boolean(evaluateRuntimeExpression(expression.left, variables))
      || Boolean(evaluateRuntimeExpression(expression.right, variables))
  }

  const left = evaluateRuntimeExpression(expression.left, variables)
  const right = evaluateRuntimeExpression(expression.right, variables)
  if (expression.operator === '==')
    return Object.is(left, right)
  if (expression.operator === '!=')
    return !Object.is(left, right)
  if (['<', '<=', '>', '>='].includes(expression.operator)) {
    const [comparableLeft, comparableRight] = comparable(left, right, expression.operator)
    if (expression.operator === '<')
      return comparableLeft < comparableRight
    if (expression.operator === '<=')
      return comparableLeft <= comparableRight
    if (expression.operator === '>')
      return comparableLeft > comparableRight
    return comparableLeft >= comparableRight
  }

  const numericLeft = numeric(left, expression.operator)
  const numericRight = numeric(right, expression.operator)
  if (expression.operator === '+')
    return finiteResult(numericLeft + numericRight, expression.operator)
  if (expression.operator === '-')
    return finiteResult(numericLeft - numericRight, expression.operator)
  if (expression.operator === '*')
    return finiteResult(numericLeft * numericRight, expression.operator)
  if (expression.operator === '/')
    return finiteResult(numericLeft / numericRight, expression.operator)
  return finiteResult(numericLeft % numericRight, expression.operator)
}

export function runtimeConditionMatches(
  expression: RuntimeExpression | undefined,
  variables: Readonly<JsonObject>,
): boolean {
  return expression ? Boolean(evaluateRuntimeExpression(expression, variables)) : true
}
