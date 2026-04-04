/**
 * Lightweight builder for assembling multi-section system prompts.
 * Replaces the repetitive `parts.push()` + `parts.join('\n')` pattern
 * found across multiple stores.
 */
export class PromptBuilder {
  private parts: string[] = []

  /** Add a single line (or empty line when called with no argument). */
  line(text = ''): this {
    this.parts.push(text)
    return this
  }

  /** Add a section with a header and content, separated by blank lines. */
  section(header: string, content: string): this {
    this.parts.push('', header, '', content)
    return this
  }

  /** Conditionally add a section. */
  sectionIf(condition: unknown, header: string, content: string | (() => string)): this {
    if (condition) {
      this.section(header, typeof content === 'function' ? content() : content)
    }
    return this
  }

  /** Conditionally add a pre-formatted block (e.g. memoryPrompt, statePrompt). */
  blockIf(condition: unknown, content: string): this {
    if (condition) {
      this.parts.push('', content)
    }
    return this
  }

  /** Add multiple lines at once. */
  items(lines: string[]): this {
    this.parts.push(...lines)
    return this
  }

  /** Join all parts with newlines. */
  build(): string {
    return this.parts.join('\n')
  }
}
