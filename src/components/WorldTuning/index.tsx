import type TuningModule from '#src/lib/worldTuning/base/TuningModule.ts'
import type {TuningControl, TuningGroup, TuningRange, TuningValue} from '#src/lib/worldTuning/controls.ts'

import Branch from 'branch-component'
import {useEffect} from 'react'

import {notify} from '#src/lib/gallery.ts'
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

const formatNumber = (control: TuningRange<Values>, value: number) => (control.percent ? `${Math.round(value * 100)}%` : `${Number(value.toFixed(3))}${control.unit ?? ''}`)
const copyChanges = () => {
  const changes = worldTuning.changes()
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
  const valueSwitch = module.entries.get(key)?.switch
  const isOff = current === valueSwitch?.off
  const value = isOff ? parked ?? valueSwitch.fallback : current
  const changed = module.isChanged(key, {[key]: current}, {[key]: parked})
  const set = (next: TuningValue) => changeWorldTuning(() => module.set({[key]: next}, 'panel'))
  const id = `tuning-${module.id}-${key}`
  const label = <span data-changed={changed || undefined} onClick={ignoreRepeatedClick} onDoubleClick={() => changeWorldTuning(() => module.reset([key], 'panel'))}>
    <Branch if={control.off}><input aria-label={`${control.label} on`} checked={!isOff} disabled={disabled} type='checkbox' onChange={event => changeWorldTuning(() => module.switch(valueSwitch!, event.currentTarget.checked, 'panel'))} /></Branch>
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
        return <label className={css.row}>{label}<input id={id} disabled={inactive} type='color' value={value as string} onChange={event => set(event.currentTarget.value)} /><output htmlFor={id}>{value as string}</output></label>
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
