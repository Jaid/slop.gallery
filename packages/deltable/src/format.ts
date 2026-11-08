/** a number with a real minus, its thousands split by narrow no-break spaces from 10 000 on */
export const formatCount = (count: number) => {
  const [integer, fraction = ''] = String(Math.abs(count)).split('.')
  const grouped = integer.length > 4 ? integer.replaceAll(/\B(?=(?:\d{3})+$)/g, '\u{202F}') : integer
  return `${count < 0 ? '−' : ''}${grouped}${fraction && `.${fraction}`}`
}

/** a change of a count, signed with a real minus, and empty for none */
export const formatDelta = (delta: number) => {
  if (delta === 0) {
    return ''
  }
  return `${delta > 0 ? '+' : '−'}${formatCount(Math.abs(delta))}`
}
