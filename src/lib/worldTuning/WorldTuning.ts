import type TuningModule from './base/TuningModule.ts'
import type {TuningEntry, TuningSource} from './base/TuningModule.ts'
import type {ToldValue, TuningValue, TuningValues} from './controls.ts'

/** values by their keys by the id of their module, like `{view: {fov: 50}}` */
export type TuningChanges = Record<string, Record<string, TuningValue>>

/** values by their keys by the id of their module as the tools tell and take them, like `{studio: {lightColor: {hue: 265, saturation: 53, lightness: 76}}}` */
export type ToldChanges = Record<string, Record<string, ToldValue>>

/** what a change did to one value, as the tools tell it */
export type TuningChange = {
  from: ToldValue
  key: string
  module: string
  to: ToldValue
}

/** a value of the world tuning as the `get_world_tuning` WebMCP tool tells it */
export type TuningControlDump = {
  /** left out while it does something; false while its group is switched off or it doesn’t apply to the other values */
  applies?: false
  /** the part of its group it is in */
  caption?: string
  /** its group box */
  group: string
  /** the value the page started with, left out while it still has it */
  initial?: ToldValue
  integer?: true
  key: string
  /** what kind of control it has: switch for a group’s heading that switches it to `on` or `off` */
  kind: 'color' | 'range' | 'select' | 'switch' | 'toggle'
  label: string
  max?: number
  min?: number
  /** the value a checkbox switches it off to */
  off?: TuningValue
  /** the value a switch switches it on to */
  on?: TuningValue
  options?: Array<{
    label: string
    value: TuningValue
  }>
  /** whether it shows as a percentage of 1 */
  percent?: true
  /** whether changing it builds something anew, which takes a moment */
  rebuilds?: true
  /** whether changing it reloads the page */
  reloads?: true
  step?: number
  unit?: string
  value: ToldValue
}

export type TuningModuleDump = {
  controls: Array<TuningControlDump>
  /** what the panel says in place of the controls while they aren’t shown */
  hint?: string
  id: string
  /** whether the panel shows the controls right now, as they apply, like the render pipeline’s in heavy graphics */
  shown: boolean
  title: string
}

/** Whether a value’s group is switched on, or has no switch. */
const isGroupOn = <Values extends TuningValues>({group: {toggle}}: TuningEntry<Values>, values: Values) => {
  if (toggle === undefined) {
    return true
  }
  return typeof toggle === 'object' ? values[toggle.key] !== toggle.off : values[toggle] === true
}
function describeEntry<Values extends TuningValues>(module: TuningModule<Values>, key: string, entry: TuningEntry<Values>, values: Values): TuningControlDump {
  const {caption, control, group, switch: valueSwitch} = entry
  const value = values[key]
  const initial = module.initial[key]
  const applies = control ? isGroupOn(entry, values) && (control.when?.(values) ?? true) : true
  const described: TuningControlDump = {
    key,
    group: group.title,
    ...caption ? {caption} : {},
    label: control?.label ?? group.title,
    kind: control?.kind ?? (valueSwitch ? 'switch' : 'toggle'),
    value: module.tell(key, value),
    ...value === initial ? {} : {initial: module.tell(key, initial)},
    ...applies ? {} : {applies: false},
    ...module.rebuilds(key) ? {rebuilds: true} : {},
    ...module.reloads(key) ? {reloads: true} : {},
  }
  if (!control && valueSwitch) {
    return {
      ...described,
      on: valueSwitch.fallback,
      off: valueSwitch.off,
    }
  }
  const off = valueSwitch ? {off: valueSwitch.off} : {}
  if (control?.kind === 'range') {
    return {
      ...described,
      min: control.min,
      max: control.max,
      step: control.step,
      ...control.integer ? {integer: true} : {},
      ...control.percent ? {percent: true} : {},
      ...control.unit ? {unit: control.unit} : {},
      ...off,
    }
  }
  if (control?.kind === 'select') {
    return {
      ...described,
      options: control.options.map(([optionValue, label]) => ({
        value: optionValue,
        label,
      })),
      ...off,
    }
  }
  return {
    ...described,
    ...off,
  }
}

/** Every module of the world tuning this page has, which the panel shows group by group and the WebMCP tools and the telemetry address by their ids. */
export default class WorldTuning {
  constructor(readonly modules: ReadonlyArray<TuningModule>) {
    const ids = new Set(modules.map(module => module.id))
    if (ids.size !== modules.length) {
      throw new Error('Every module of the world tuning needs an id of its own.')
    }
  }

  /** The values that differ from the ones the page started with, by module, leaving out unchanged modules. */
  changes(): TuningChanges {
    return Object.fromEntries(this.modules.map(module => [module.id, module.changes()] as const).filter(([, changes]) => Object.keys(changes).length > 0)) as TuningChanges
  }

  /** Every module with every value it shows in the panel, as the `get_world_tuning` tool tells them. */
  describe(): Array<TuningModuleDump> {
    return this.modules.map(module => {
      const values = module.get()
      const shown = module.isShown()
      return {
        id: module.id,
        title: module.title,
        shown,
        ...!shown && module.hint ? {hint: module.hint} : {},
        controls: [...module.entries].map(([key, entry]) => describeEntry(module, key, entry, values)),
      }
    })
  }

  module(id: string) {
    return this.modules.find(module => module.id === id)
  }

  /** Brings back every value the page started with. */
  reset(source: TuningSource = 'code') {
    for (const module of this.modules) {
      module.reset(undefined, source)
    }
  }

  /**
   * Sets values of any of the modules as the tools give them, null bringing back the one the page started with. Every value is checked first, so one the module doesn’t take sets none, with a TypeError saying what it takes.
   * Returns every value that changed, as the tools tell it.
   */
  set(changes: Readonly<Record<string, Readonly<Record<string, unknown>>>>, source: TuningSource = 'code'): Array<TuningChange> {
    const plans = Object.entries(changes).map(([id, values]) => {
      const module = this.module(id)
      if (!module) {
        throw new TypeError(`This page tunes no “${id}”. Its modules: ${this.modules.map(candidate => candidate.id).join(', ')}.`)
      }
      const resets = Object.keys(values).filter(key => values[key] === null)
      for (const key of resets) {
        module.entry(key)
      }
      const assigned = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null).map(([key, value]) => [key, module.validate(key, value)]))
      return {
        assigned,
        module,
        resets,
      }
    })
    const changed: Array<TuningChange> = []
    for (const {assigned, module, resets} of plans) {
      const before = module.get()
      if (resets.length > 0) {
        module.reset(resets, source)
      }
      if (Object.keys(assigned).length > 0) {
        module.set(assigned, source)
      }
      const after = module.get()
      for (const key of [...resets, ...Object.keys(assigned)]) {
        if (before[key] !== after[key]) {
          changed.push({
            module: module.id,
            key,
            from: module.tell(key, before[key]),
            to: module.tell(key, after[key]),
          })
        }
      }
    }
    return changed
  }

  /** Calls the listener whenever a value of any module changes, returning how to stop. */
  subscribe(listener: () => void) {
    const unsubscribers = this.modules.map(module => module.subscribe(listener))
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    }
  }

  /** {@link changes} as the tools tell and take them, which the panel’s Copy button copies. */
  toldChanges(): ToldChanges {
    return Object.fromEntries(Object.entries(this.changes()).map(([id, values]) => {
      const module = this.module(id)!
      return [id, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, module.tell(key, value)]))]
    }))
  }

  /** Every module’s values by its id. */
  values(): Record<string, TuningValues> {
    return Object.fromEntries(this.modules.map(module => [module.id, module.get()]))
  }
}
