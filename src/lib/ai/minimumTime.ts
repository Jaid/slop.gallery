import {delay} from 'es-toolkit'

/**
 * The answer of `request`, which started right before, held back until at least `seconds` have passed (see `?request_minimum_time`).
 * A failure comes through at once, and an abort of `signal` ends the wait.
 */
export default async function withMinimumTime<T>(request: Promise<T>, seconds: number, signal?: AbortSignal): Promise<T> {
  if (seconds <= 0) {
    return request
  }
  const [answer] = await Promise.all([request, delay(seconds * 1000, {signal})])
  return answer
}
