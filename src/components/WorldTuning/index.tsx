import type TuningModule from '#src/lib/worldTuning/base/TuningModule.ts'
import type {TuningControl, TuningGroup, TuningRange, TuningValue} from '#src/lib/worldTuning/controls.ts'
import type {Channels} from 'okhsl'
import type {ReactNode} from 'react'

import Branch from 'branch-component'
import hsl from 'okhsl'
import {useEffect, useState} from 'react'

import {notify} from '#src/lib/gallery.ts'
import {tuningHex} from '#src/lib/worldTuning/color.ts'
import worldTuning from '#src/lib/worldTuning/index.ts'
import {useWorldTuningPanel} from '#src/lib/worldTuning/panel.ts'
import {changeWorldTuning, discardTuningBuffer, useTuningBuffer} from '#src/lib/worldTuning/tuningBuffer.ts'

import css from './style.module.sass'

/** Keeps the second click of a double-click from reaching the label’s control, so double-clicking a checkbox’s label resets it instead of switching it twice. */
const ignoreRepeatedClick = (event: React.MouseEvent) => {
  if (event.detail > 1) {
    event.preventDefault()
  }
}
type Values = Record<string, TuningValue>

const formatNumber = (control: TuningRange<Values>, value: number) => (control.percent ? `${Number((value * 100).toFixed(1))}%` : `${Number(value.toFixed(3))}${control.unit ?? ''}`)
const copyChanges = () => {
  const changes = worldTuning.toldChanges()
  if (Object.keys(changes).length === 0) {
    notify('Nothing is tuned yet.')
    return
  }
  // The very values the set_world_tuning tool takes.
  navigator.clipboard.writeText(JSON.stringify(changes)).then(() => notify('Copied the tuned values.')).catch(() => notify('The clipboard refused the tuned values.'))
}

/** The panel G shows with `?development`, or `?world_tuning` from the start, a column left of the canvas: every module of the world tuning in its group boxes, which change the world live. */
export default function WorldTuning() {
  useEffect(() => {
    // Holding Space over the panel shows the frame from before the latest tweak; it is caught before the focused control or the game sees it.
    const show = (event: KeyboardEvent) => {
      if (event.code === 'Space' && useWorldTuningPanel.getState().hovered) {
        event.preventDefault()
        event.stopPropagation()
        useTuningBuffer.setState({showing: true})
      }
    }
    const hide = (event: KeyboardEvent) => {
      if (event.code === 'Space' && useTuningBuffer.getState().showing) {
        event.preventDefault()
        event.stopPropagation()
        useTuningBuffer.setState({showing: false})
      }
    }
    const release = () => useTuningBuffer.setState({showing: false})
    addEventListener('keydown', show, {capture: true})
    addEventListener('keyup', hide, {capture: true})
    addEventListener('blur', release)
    return () => {
      removeEventListener('keydown', show, {capture: true})
      removeEventListener('keyup', hide, {capture: true})
      removeEventListener('blur', release)
      // G hid the panel.
      discardTuningBuffer()
    }
  }, [])
  return <aside
    className={css.container} aria-label='World tuning' onPointerEnter={() => useWorldTuningPanel.setState({hovered: true})} onPointerLeave={() => {
      useWorldTuningPanel.setState({hovered: false})
      useTuningBuffer.setState({showing: false})
    }}
  >
    <div className={css.heading}>
      <h2>World tuning</h2>
      <button title='Copies the values that differ from the start as JSON, which the set_world_tuning tool takes' type='button' onClick={copyChanges}>Copy</button>
      <button type='button' onClick={() => changeWorldTuning(() => worldTuning.reset('panel'))}>Reset</button>
    </div>
    <p className={css.hint}>Pause to tune. The menu hides while the pointer is over the panel. Double-click a label to reset it. Hold Space to see the frame from before the latest change.</p>
    {worldTuning.modules.map(module => <ModuleGroups key={module.id} module={module} />)}
  </aside>
}

function ModuleGroups({module}: {module: TuningModule}) {
  return <Branch if={module.useShown()} else={<Branch if={module.hint}><p className={css.hint}>{module.hint}</p></Branch>}>{module.groups.filter(group => group.available ?? true).map(group => <GroupBox key={group.title} group={group} module={module} />)}</Branch>
}
function GroupBox({group, module}: {
  group: TuningGroup<Values>
  module: TuningModule
}) {
  const {toggle} = group
  const enabled = module.useValues(values => {
    if (toggle === undefined) {
      return true
    }
    return typeof toggle === 'object' ? values[toggle.key] !== toggle.off : values[toggle] === true
  })
  const toggleKey = typeof toggle === 'object' ? toggle.key : toggle
  const keys = [...new Set([...toggleKey === undefined ? [] : [toggleKey], ...group.controls.map(control => control.key)])]
  const parked = module.parked()
  const changed = module.useValues(values => keys.some(key => module.isChanged(key, values, parked)))
  const parameters = module.useValues(values => group.parameters?.(values))
  const onToggle = (on: boolean) => changeWorldTuning(() => {
    if (typeof toggle === 'object') {
      module.switch(toggle, on, 'panel')
    } else {
      module.set({[toggle!]: on}, 'panel')
    }
  })
  return <fieldset className={css.section}>
    <legend data-changed={changed || undefined} onClick={ignoreRepeatedClick} onDoubleClick={() => changeWorldTuning(() => module.reset(keys, 'panel'))}><Branch if={toggle} else={group.title}><label><input checked={enabled} type='checkbox' onChange={event => onToggle(event.currentTarget.checked)} /> {group.title}</label></Branch></legend>
    {group.controls.map(control => <ControlRow key={control.key} control={control} disabled={!enabled} module={module} />)}
    <Branch if={group.note}><p className={css.hint}>{group.note}</p></Branch>
    <Branch if={parameters}><input className={css.parameter} aria-label={`${group.title} URL parameters`} readOnly value={parameters} onFocus={event => event.currentTarget.select()} /></Branch>
  </fieldset>
}
function ControlRow({control, disabled, module}: {
  control: TuningControl<Values>
  disabled: boolean
  module: TuningModule
}) {
  const {key} = control
  const current = module.useValues(values => values[key])
  const parked = module.parked(state => state[key])
  const applies = module.useValues(values => control.when?.(values) ?? true)
  // A switched-off value, by its own checkbox or its group’s, shows the value it keeps.
  const entry = module.entries.get(key)
  const valueSwitch = entry?.switch
  const isOff = current === valueSwitch?.off
  const value = isOff ? parked ?? valueSwitch.fallback : current
  const changed = module.isChanged(key, {[key]: current}, {[key]: parked})
  const set = (next: TuningValue) => changeWorldTuning(() => module.set({[key]: next}, 'panel'))
  const switchOn = (on: boolean) => changeWorldTuning(() => module.switch(valueSwitch!, on, 'panel'))
  const id = `tuning-${module.id}-${key}`
  const label = <span data-changed={changed || undefined} onClick={ignoreRepeatedClick} onDoubleClick={() => changeWorldTuning(() => module.reset([key], 'panel'))}>
    <Branch if={control.off}><input aria-label={`${control.label} on`} checked={!isOff} disabled={disabled} type='checkbox' onChange={event => switchOn(event.currentTarget.checked)} /></Branch>
    {control.label}
  </span>
  const inactive = disabled || !applies || control.off !== undefined && isOff
  const row = (() => {
    switch (control.kind) {
      case 'toggle': {
        return <label className={css.toggle}>{label}<input id={id} checked={value as boolean} disabled={inactive} type='checkbox' onChange={event => set(event.currentTarget.checked)} /></label>
      }
      case 'select': {
        const index = control.options.findIndex(([option]) => option === value)
        return <label className={css.row}>{label}<select id={id} disabled={inactive} value={index} onChange={event => set(control.options[Number(event.currentTarget.value)][0])}>{control.options.map(([, optionLabel], optionIndex) => <option key={optionLabel} value={optionIndex}>{optionLabel}</option>)}</select></label>
      }
      case 'color': {
        // Named with its part of the group, as a group may hold several colors, like a light’s each.
        return <ColorSliders id={id} disabled={inactive} label={label} name={entry?.caption ? `${entry.caption} ${control.label.toLowerCase()}` : control.label} value={value as string} onChange={set} />
      }
      case 'range': {
        return <label className={css.row}>
          {label}
          <input id={id} disabled={inactive} max={control.max} min={control.min} step={control.step} type='range' value={value as number} onChange={event => set(Number(event.currentTarget.value))} />
          <output htmlFor={id}>{formatNumber(control, value as number)}</output>
        </label>
      }
    }
  })()
  return <>
    <Branch if={control.caption}><h3 className={css.caption}>{control.caption}</h3></Branch>
    {row}
  </>
}
/** the axes of an OkHSL color, as its sliders show them: hue in degrees, saturation and lightness in percent */
const hslAxes = [
  {
    label: 'Hue',
    max: 360,
    unit: '°',
  },
  {
    label: 'Saturation',
    max: 100,
    unit: '%',
  },
  {
    label: 'Lightness',
    max: 100,
    unit: '%',
  },
] as const
/** how many colors a slider’s track runs through, every 30° round the hue and every 25% along the others */
const trackStops = [13, 5, 5] as const
/** The OkHSL color of #rrggbb, in whole degrees and percent. */
const readHsl = (hex: string): Channels => {
  const [hue, saturation, lightness] = hsl.fromHex(hex)
  return [hue, saturation, lightness]
}
/** The color with the axis moved to the amount. */
const withAxis = (channels: Channels, axis: number, amount: number): Channels => {
  const moved: Channels = [...channels]
  moved[axis] = amount
  return moved
}
/** The track of the slider of the axis: the colors it moves through, the color’s other axes kept. */
const track = (channels: Channels, axis: number) => {
  const count = trackStops[axis]
  const stops = Array.from({length: count}, (_, index) => hsl.css(withAxis(channels, axis, index / (count - 1) * hslAxes[axis].max)))
  return `linear-gradient(to right, ${stops.join(', ')})`
}
/**
 * A color of the world tuning as three sliders, its OkHSL hue, saturation and lightness, each over a track of the colors it moves through, under a swatch of it with its #rrggbb, which is what it sets.
 * The sliders keep what they were moved to as long as the value is one they set, which holds the hue of a gray, which #rrggbb has none of, and doesn’t round the other axes anew; any other value, like a reset or a tool’s, moves them to its own.
 */
function ColorSliders({disabled, id, label, name, onChange, value}: {
  disabled: boolean
  id: string
  label: ReactNode
  /** what the color is called, which its sliders are labeled by */
  name: string
  onChange: (hex: string) => void
  value: string
}) {
  const [color, setColor] = useState(() => ({
    hsl: readHsl(value),
    /** what the sliders set that has yet to arrive, in order, as a change of the panel waits for the frame before it */
    pending: [] as ReadonlyArray<string>,
    value,
  }))
  if (value !== color.value) {
    const arrived = color.pending.indexOf(value)
    setColor(arrived === -1 ? {
      hsl: readHsl(value),
      pending: [],
      value,
    } : {
      ...color,
      pending: color.pending.slice(arrived + 1),
      value,
    })
  }
  const move = (axis: number, amount: number) => {
    const channels = withAxis(color.hsl, axis, amount)
    const hex = tuningHex(channels)
    setColor({
      hsl: channels,
      pending: [...color.pending, hex],
      value: color.value,
    })
    onChange(hex)
  }
  return <div className={css.color} aria-label={name} role='group'>
    <div className={css.row}>
      {label}
      <span className={css.swatch} style={{background: value}} />
      <output htmlFor={hslAxes.map(axis => `${id}-${axis.label.toLowerCase()}`).join(' ')}>{value}</output>
    </div>
    {hslAxes.map(({label: axisLabel, max, unit}, axis) => {
      const axisId = `${id}-${axisLabel.toLowerCase()}`
      return <label key={axisLabel} className={css.row}>
        <span className={css.axis}>{axisLabel}</span>
        <input id={axisId} aria-label={`${name} ${axisLabel.toLowerCase()}`} disabled={disabled} max={max} min={0} step={1} style={{background: track(color.hsl, axis)}} type='range' value={color.hsl[axis]} onChange={event => move(axis, Number(event.currentTarget.value))} />
        <output htmlFor={axisId}>{color.hsl[axis]}{unit}</output>
      </label>
    })}
  </div>
}
