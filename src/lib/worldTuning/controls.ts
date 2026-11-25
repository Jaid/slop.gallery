/** a value of the world tuning: what a control shows and sets */
export type TuningValue = boolean | number | string

/** a color as the tools tell and take it, which a module holds as packed sRGB: its OkHSL hue in degrees, saturation and lightness in percent */
export type TuningColor = {
  hue: number
  lightness: number
  saturation: number
}

/** a value as the tools tell and take it, and the panel’s Copy button copies it: a color as its {@link TuningColor}, anything else as the module holds it */
export type ToldValue = TuningColor | TuningValue

/** every value of a tuning module by its key */
export type TuningValues = Record<string, TuningValue>

/** the keys of the values of the type */
export type TuningKey<Values, Type = TuningValue> = {[Key in keyof Values & string]: Values[Key] extends Type ? Key : never}[keyof Values & string]

/** A checkbox that switches a value to `off` without losing it, which the module keeps to bring back when it switches on again. */
export type TuningSwitch = {
  /** the value to switch on to when the module starts with it off */
  fallback: TuningValue
  key: string
  off: TuningValue
}

export type TuningRange<Values> = ControlBase<Values> & {
  /** whether only whole numbers make sense */
  integer?: boolean
  kind: 'range'
  max: number
  min: number
  /** whether it shows as a percentage */
  percent?: boolean
  step: number
  /** what it shows after the number, like ° or m */
  unit?: string
}

/** an option of a select: the value and what it reads */
export type TuningOption = readonly [value: TuningValue, label: string]

export type TuningControl<Values> = ControlBase<Values> & ({
  /** a packed sRGB color, which the tools tell and take as its {@link TuningColor} */
  kind: 'color'
} | {
  kind: 'select'
  options: ReadonlyArray<TuningOption>
} | {
  kind: 'toggle'
}) | TuningRange<Values>

/** A group box of the panel: a few controls under a heading, which may switch them all on and off. */
export type TuningGroup<Values> = {
  /** whether the page has the group, like one tuning what only some worlds have, true by default */
  available?: boolean
  controls: ReadonlyArray<TuningControl<Values>>
  /** a line under its controls */
  note?: string
  /** URL parameters that start a page with its values, which it shows to copy */
  // eslint-disable-next-line typescript/method-signature-style -- a method’s parameter is bivariant, so a module of some values is a module of values
  parameters?(values: Values): string
  title: string
  /** the value its heading switches on and off, or switches off without losing */
  toggle?: TuningSwitch | string
}

// Controls and groups name their values by plain keys, so a module of any values is a module of values; the factories of `tuningControls` check the keys against the values.
type ControlBase<Values> = {
  /** a small heading over the control, which starts a part of its group */
  caption?: string
  key: string
  label: string
  /** the value a checkbox in front of the label switches it to */
  off?: Omit<TuningSwitch, 'key'>
  /** whether changing it reloads the page, as it shapes what the page only builds as it loads */
  reloads?: boolean
  /** whether the control does anything with the module’s current values, beyond its group being switched on */
  // eslint-disable-next-line typescript/method-signature-style -- a method’s parameter is bivariant, so a module of some values is a module of values
  when?(values: Values): boolean
}

type Extras<Values> = Omit<ControlBase<Values>, 'key' | 'label'>

/** The factories of the controls and groups of a module with the values, which check their keys against them. */
export function tuningControls<Values>() {
  const range = (key: TuningKey<Values, number>, label: string, min: number, max: number, step: number, extras: Extras<Values> & Pick<TuningRange<Values>, 'integer' | 'percent' | 'unit'> = {}): TuningControl<Values> => ({
    key,
    kind: 'range',
    label,
    max,
    min,
    step,
    ...extras,
  })
  return {
    color: (key: TuningKey<Values, number>, label: string, extras: Extras<Values> = {}): TuningControl<Values> => ({
      key,
      kind: 'color',
      label,
      ...extras,
    }),
    /** a group whose heading switches the value of the key on and off, or switches it off without losing it */
    group: (group: Omit<TuningGroup<Values>, 'toggle'> & {toggle?: Omit<TuningSwitch, 'key'> & {key: TuningKey<Values>} | TuningKey<Values, boolean>}): TuningGroup<Values> => group,
    /** a range of a fraction or factor, shown as a percentage */
    percent: (key: TuningKey<Values, number>, label: string, min: number, max: number, step: number, extras: Extras<Values> = {}) => range(key, label, min, max, step, {
      percent: true,
      ...extras,
    }),
    range,
    select: (key: TuningKey<Values>, label: string, options: ReadonlyArray<TuningOption>, extras: Extras<Values> = {}): TuningControl<Values> => ({
      key,
      kind: 'select',
      label,
      options,
      ...extras,
    }),
    toggle: (key: TuningKey<Values, boolean>, label: string, extras: Extras<Values> = {}): TuningControl<Values> => ({
      key,
      kind: 'toggle',
      label,
      ...extras,
    }),
  }
}

/** Options of the values as percentages, like 50% for 0.5. */
export const scaleOptions = (values: ReadonlyArray<number>): Array<TuningOption> => values.map(value => [value, `${value * 100}%`])

/** Options that read as their values. */
export const plainOptions = (values: ReadonlyArray<number | string>): Array<TuningOption> => values.map(value => [value, String(value)])
