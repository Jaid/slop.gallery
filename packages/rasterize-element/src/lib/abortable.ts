/** Settles like `promise`, or rejects with the signal’s reason as soon as it aborts. */
export default async function abortable<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return promise
  }
  signal.throwIfAborted()
  const aborted = Promise.withResolvers<never>()
  const onAbort = () => aborted.reject(signal.reason)
  signal.addEventListener('abort', onAbort, {once: true})
  try {
    return await Promise.race([promise, aborted.promise])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
