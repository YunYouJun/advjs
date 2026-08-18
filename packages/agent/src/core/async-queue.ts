interface PendingRead<T> {
  resolve: (result: IteratorResult<T>) => void
  reject: (error: unknown) => void
}

export class AsyncQueue<T> implements AsyncIterable<T> {
  readonly #items: T[] = []
  readonly #pending: PendingRead<T>[] = []
  #closed = false
  #failure: unknown

  push(item: T): void {
    if (this.#closed)
      return
    const pending = this.#pending.shift()
    if (pending)
      pending.resolve({ done: false, value: item })
    else
      this.#items.push(item)
  }

  close(): void {
    if (this.#closed)
      return
    this.#closed = true
    for (const pending of this.#pending.splice(0))
      pending.resolve({ done: true, value: undefined })
  }

  fail(error: unknown): void {
    if (this.#closed)
      return
    this.#closed = true
    this.#failure = error
    for (const pending of this.#pending.splice(0))
      pending.reject(error)
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.#items.shift()
        if (item !== undefined)
          return Promise.resolve({ done: false, value: item })
        if (this.#failure !== undefined)
          return Promise.reject(this.#failure)
        if (this.#closed)
          return Promise.resolve({ done: true, value: undefined })
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.#pending.push({ resolve, reject })
        })
      },
    }
  }
}
