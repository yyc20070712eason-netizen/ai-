import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true })

class TestResizeObserver {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback([{
      target,
      contentRect: { x: 0, y: 0, top: 0, left: 0, bottom: 768, right: 1024, width: 1024, height: 768, toJSON: () => ({}) },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    }], this as unknown as ResizeObserver)
  }
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver, writable: true })

const nativeRect = Element.prototype.getBoundingClientRect
Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
  if (this instanceof HTMLElement && (this.classList.contains('react-flow') || this.classList.contains('knowledge-tree__canvas'))) {
    return { x: 0, y: 0, top: 0, left: 0, bottom: 768, right: 1024, width: 1024, height: 768, toJSON: () => ({}) }
  }
  return nativeRect.call(this)
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
}
