const onValues: ReadonlySet<unknown> = new Set([true, '', 'true'])

/** whether a permalink flag is on: bare, like `?albedo`, or `true` */
export default function isFlagOn(value: unknown) {
  return onValues.has(value)
}
