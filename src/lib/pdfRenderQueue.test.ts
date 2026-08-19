import { describe, expect, it, vi } from 'vitest'
import { PdfRenderQueue } from './pdfRenderQueue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('PdfRenderQueue', () => {
  it('limits active renders and starts pending work in order', async () => {
    const queue = new PdfRenderQueue(2)
    const first = deferred<void>()
    const second = deferred<void>()
    const started: number[] = []
    const one = queue.schedule(async () => { started.push(1); await first.promise })
    const two = queue.schedule(async () => { started.push(2); await second.promise })
    const three = queue.schedule(async () => { started.push(3) })

    expect(started).toEqual([1, 2])
    first.resolve()
    await one.promise
    await vi.waitFor(() => expect(started).toEqual([1, 2, 3]))
    second.resolve()
    await Promise.all([two.promise, three.promise])
  })

  it('removes a queued render before it starts', async () => {
    const queue = new PdfRenderQueue(1)
    const gate = deferred<void>()
    const first = queue.schedule(async () => gate.promise)
    const later = queue.schedule(async () => undefined)
    later.cancel()

    await expect(later.promise).rejects.toMatchObject({ name: 'AbortError' })
    gate.resolve()
    await first.promise
  })

  it('aborts an active render without allowing its result to resolve', async () => {
    const queue = new PdfRenderQueue(1)
    const gate = deferred<void>()
    const task = queue.schedule(async (signal) => {
      await gate.promise
      expect(signal.aborted).toBe(true)
    })
    task.cancel()
    gate.resolve()
    await expect(task.promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
