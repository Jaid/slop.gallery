import type {TuningControl, TuningGroup, TuningSwitch, TuningValue, TuningValues} from '../controls.ts'
import type {StoreApi, UseBoundStore} from 'zustand'

import {create} from 'zustand'

/** what changed a world tuning value: the panel, a key of the game, like Numpad + for the field of view, a WebMCP tool, or the code itself */
export type TuningSource = 'code' | 'key' | 'panel' | 'webmcp'

/** what changed a world tuning value last, which its telemetry reports */
export const lastTuningSource: {current: TuningSource} = {current: 'code'}

/** Where a value of a module shows in the panel: its group, its control if it has one besides the group’s heading, and the checkbox that switches it off, if any. */
export type TuningEntry<Values> = {
  /** the caption of the part of its group it is in */
  caption?: string
  control?: TuningControl<Values>
  group: TuningGroup<Values>
  switch?: TuningSwitch
}

const colorPattern = /^#[\da-f]{6}$/iu
const describeValue = (value: TuningValue) => (typeof value === 'string' ? `“${value}”` : String(value))

/**
 * A part of the world tuning: values that change how the world shows, the group boxes the panel shows them in and how they apply, which only does with `?development`.
 * Its values stay in effect while the panel is hidden. They start from {@link initial}, the values the page starts with, which the panel resets to and marks every value that left.
 */
export default abstract class TuningModule<Values extends TuningValues = TuningValues> {
  /** the group boxes the panel shows the values in, in order */
  abstract readonly groups: ReadonlyArray<TuningGroup<Values>>
  /** what the panel says in place of the groups while {@link isShown} is false, if anything */
  readonly hint: string | undefined = undefined
  /** short and unique, which names the module’s values in the tools and the telemetry */
  abstract readonly id: string
  /** the values the page starts with */
  readonly initial: Values
  readonly store: UseBoundStore<StoreApi<Values>>
  abstract readonly title: string
  private entryIndex: ReadonlyMap<string, TuningEntry<Values>> | undefined
  private initialParkedValues: Partial<Values> | undefined
  private parkedStore: UseBoundStore<StoreApi<Partial<Values>>> | undefined

  /** @param store where the values live, a store of their own by default, for consumers that can’t import the module */
  constructor(initial: Values, store: UseBoundStore<StoreApi<Values>> = create<Values>(() => initial)) {
    this.initial = initial
    this.store = store
  }

  /** every value the panel shows by its key, in the order it shows them */
  get entries(): ReadonlyMap<string, TuningEntry<Values>> {
    if (!this.entryIndex) {
      const entries = new Map<string, TuningEntry<Values>>
      for (const group of this.groups) {
        if (!(group.available ?? true)) {
          continue
        }
        const {toggle} = group
        if (toggle !== undefined) {
          entries.set(typeof toggle === 'object' ? toggle.key : toggle, {
            group,
            ...typeof toggle === 'object' ? {switch: toggle} : {},
          })
        }
        let caption: string | undefined
        for (const control of group.controls) {
          caption = control.caption ?? caption
          const off = control.off ? {
            ...control.off,
            key: control.key,
          } : entries.get(control.key)?.switch
          entries.set(control.key, {
            caption,
            control,
            group,
            ...off ? {switch: off} : {},
          })
        }
      }
      this.entryIndex = entries
    }
    return this.entryIndex
  }

  /** the values a checkbox switched off as the page started, which come back once it switches them on */
  get initialParked(): Partial<Values> {
    this.initialParkedValues ??= this.partial(this.switches.filter(({key, off}) => this.initial[key] === off).map(({fallback, key}) => [key, fallback]))
    return this.initialParkedValues
  }

  /** the values that checkboxes switched off keep, which come back once they switch them on again */
  get parked(): UseBoundStore<StoreApi<Partial<Values>>> {
    this.parkedStore ??= create<Partial<Values>>(() => this.initialParked)
    return this.parkedStore
  }

  /** every checkbox that switches a value off without losing it */
  get switches(): Array<TuningSwitch> {
    return this.entries.values().flatMap(({switch: valueSwitch}) => (valueSwitch ? [valueSwitch] : [])).toArray()
  }

  /** The values that differ from the ones the page started with. */
  changes(): Partial<Values> {
    const values = this.get()
    return this.partial(Object.entries(values).filter(([key, value]) => value !== this.initial[key]))
  }

  get(): Values {
    return this.store.getState()
  }

  /** Whether the value differs from the one the page started with, or, switched off, keeps another one. */
  isChanged(key: string, values: Partial<Values> = this.get(), parked = this.parked.getState()) {
    return values[key] !== this.initial[key] || parked[key] !== this.initialParked[key]
  }

  /** Whether the panel shows the groups right now, rather than the {@link hint}, like the render pipeline’s only in heavy graphics. */
  isShown() {
    return true
  }

  /** Whether changing the value builds something anew, like the passes of the render pipeline, which takes a moment and its telemetry notes. */
  rebuilds(_key: string) {
    return false
  }

  /** Whether changing the value reloads the page, which only builds what it shapes as it loads. */
  reloads(key: string) {
    return this.entries.get(key)?.control?.reloads ?? false
  }

  /** Brings back the values the page started with, of the keys or all of them. */
  reset(keys: ReadonlyArray<string> = this.entries.keys().toArray(), source: TuningSource = 'code') {
    const {initialParked} = this
    const parked = this.partial([...Object.entries(this.parked.getState()).filter(([key]) => !keys.includes(key)), ...keys.filter(key => key in initialParked).map(key => [key, initialParked[key]!] as const)])
    this.set(this.partial(keys.map(key => [key, this.initial[key]])), source, parked)
  }

  /** Changes the values, and with `parked`, the ones that switched-off values keep; without, a value switched off keeps the one it had, like its checkbox does. */
  set(values: Partial<Values>, source: TuningSource = 'code', parked?: Partial<Values>) {
    lastTuningSource.current = source
    if (!parked) {
      const current = this.get()
      const kept = Object.entries(values).filter(([key, value]) => {
        const off = this.entries.get(key)?.switch?.off
        return off !== undefined && value === off && current[key] !== off
      }).map(([key]) => [key, current[key]] as const)
      if (kept.length > 0) {
        parked = this.partial([...Object.entries(this.parked.getState()), ...kept])
      }
    }
    if (parked) {
      this.parked.setState(parked, true)
    }
    this.store.setState(values)
  }

  subscribe(listener: (values: Values, previous: Values) => void) {
    return this.store.subscribe(listener)
  }

  /** Switches a value off, keeping it, or back on to the kept one. */
  switch({fallback, key, off}: TuningSwitch, on: boolean, source: TuningSource = 'code') {
    const kept = this.parked.getState()[key]
    const others = Object.entries(this.parked.getState()).filter(([candidate]) => candidate !== key)
    if (on) {
      this.set(this.partial([[key, kept ?? fallback]]), source, this.partial(others))
    } else {
      this.set(this.partial([[key, off]]), source, this.partial([...others, [key, this.get()[key]]]))
    }
  }

  /** {@link isShown} as React state. */
  useShown() {
    return true
  }

  /** The values, or what the selector picks from them, as React state. */
  useValues<Picked = Values>(selector: (values: Values) => Picked = values => values as unknown as Picked): Picked {
    return this.store(selector)
  }

  /** The value as the key’s control takes it, or a TypeError saying what it takes. */
  validate(key: string, value: unknown): TuningValue {
    const entry = this.entries.get(key)
    if (!entry) {
      throw new TypeError(`${this.title} has no value “${key}”. Its values: ${this.entries.keys().toArray().join(', ')}.`)
    }
    const {control, switch: valueSwitch} = entry
    if (valueSwitch && value === valueSwitch.off) {
      return valueSwitch.off
    }
    const name = `${this.id}.${key}`
    if (!control) {
      if (valueSwitch) {
        if (value === valueSwitch.fallback) {
          return valueSwitch.fallback
        }
        throw new TypeError(`${name} is ${describeValue(valueSwitch.fallback)} when on or ${describeValue(valueSwitch.off)} when off.`)
      }
      if (typeof value !== 'boolean') {
        throw new TypeError(`${name} switches its group on or off, so it is true or false.`)
      }
      return value
    }
    switch (control.kind) {
      case 'toggle': {
        if (typeof value !== 'boolean') {
          throw new TypeError(`${name} is true or false.`)
        }
        return value
      }
      case 'color': {
        if (typeof value !== 'string' || !colorPattern.test(value)) {
          throw new TypeError(`${name} is a color as #rrggbb.`)
        }
        return value.toLowerCase()
      }
      case 'select': {
        const option = control.options.find(([candidate]) => candidate === value)
        if (!option) {
          throw new TypeError(`${name} is one of ${control.options.map(([candidate, label]) => (String(candidate) === label ? describeValue(candidate) : `${describeValue(candidate)} (${label})`)).join(', ')}.`)
        }
        return option[0]
      }
      case 'range': {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max || control.integer && !Number.isInteger(value)) {
          throw new TypeError(`${name} is a${control.integer ? 'n integer' : ' number'} from ${control.min} to ${control.max}${valueSwitch ? `, or ${describeValue(valueSwitch.off)} for off` : ''}.`)
        }
        return value
      }
    }
  }

  /** Values of the module, from their keys and values. */
  private partial(entries: ReadonlyArray<readonly [string, TuningValue | undefined]>): Partial<Values> {
    return Object.fromEntries(entries) as unknown as Partial<Values>
  }
}
