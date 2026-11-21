// Export effort separately so authoring fixtures can trade compression time for iteration speed.
export const jxlEffort = 10
export const jxlBrotliEffort = 11
export const lossyJxlOptions = (distance = 1, effort = jxlEffort) => ['--effort', String(effort), '--brotli_effort', String(jxlBrotliEffort), '--distance', String(distance), '--keep_invisible', '0'] as const
