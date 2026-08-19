type QueueJob<T> = {
  cancelled: boolean
  controller: AbortController
  resolve: (value: T) => void
  reject: (reason: unknown) => void
  run: (signal: AbortSignal) => Promise<T>
}

export type QueuedRender<T> = {
  cancel: () => void
  promise: Promise<T>
}

function abortError() {
  const error = new Error('PDF render cancelled')
  error.name = 'AbortError'
  return error
}

export class PdfRenderQueue {
  private readonly pending: QueueJob<unknown>[] = []
  private active = 0
  private readonly limit: number

  constructor(limit = 2) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('PDF render queue limit must be at least 1')
    this.limit = limit
  }

  schedule<T>(run: (signal: AbortSignal) => Promise<T>): QueuedRender<T> {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    const job: QueueJob<T> = { cancelled: false, controller: new AbortController(), resolve, reject, run }

    this.pending.push(job as QueueJob<unknown>)
    this.pump()

    return {
      promise,
      cancel: () => {
        if (job.cancelled) return
        job.cancelled = true
        job.controller.abort()
        const queuedIndex = this.pending.indexOf(job as QueueJob<unknown>)
        if (queuedIndex >= 0) {
          this.pending.splice(queuedIndex, 1)
          job.reject(abortError())
        }
      },
    }
  }

  private pump() {
    while (this.active < this.limit && this.pending.length) {
      const job = this.pending.shift()!
      if (job.cancelled) continue
      this.active += 1
      void job.run(job.controller.signal).then(
        (value) => job.cancelled ? job.reject(abortError()) : job.resolve(value),
        (reason) => job.reject(reason),
      ).finally(() => {
        this.active -= 1
        this.pump()
      })
    }
  }
}

export const sharedPdfRenderQueue = new PdfRenderQueue(2)
