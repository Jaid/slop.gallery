// Babel wraps Error.prepareStackTrace in a formatter of its own on its first transform, after which Bun throws on every Error.captureStackTrace of an object that only inherits from Error (oven-sh/bun#41151), like the error types of follow-redirects, which Vite creates once a test loads it.
const prepareStackTrace = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace')?.value as typeof Error.prepareStackTrace
Object.defineProperty(Error, 'prepareStackTrace', {
  configurable: true,
  get: () => prepareStackTrace,
  set: () => {},
})
