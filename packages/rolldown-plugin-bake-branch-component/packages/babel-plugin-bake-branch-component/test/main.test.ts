import {describe, expect, test} from 'bun:test'

import {transformSync} from '@babel/core'

import bakeBranchComponent from '../src/main.ts'

const compile = (source: string) => transformSync(source, {
  babelrc: false,
  configFile: false,
  parserOpts: {plugins: ['jsx', 'typescript']},
  plugins: [bakeBranchComponent],
})?.code ?? ''
describe('Branch compilation', () => {
  test('compiles scalar conditions and removes the runtime import', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = <Branch if={visible} not={disabled}><Thing /></Branch>
    `)
    expect(code).not.toContain('branch-component')
    expect(code).toContain('visible && !disabled ? <Thing /> : null')
  })
  test('compiles collection conditions with the documented Boolean semantics', () => {
    const code = compile(`
      import B from 'branch-component'
      const view = <B some={some} none={none} all={all}>ready</B>
    `)
    expect(code).toContain('some?.some(Boolean) && !none?.some(Boolean) && all?.every(Boolean) ? "ready" : null')
  })
  test('makes selected outputs lazy while preserving function-as-component output semantics', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = <Branch if={ready} then={Success} else={fallback()} />
    `)
    expect(code).not.toContain('branch-component')
    expect(code).toContain('ready ? _renderBranchOutput(Success) : _renderBranchOutput(fallback())')
    expect(code).toContain('typeof _output === "function" ? _createElement(_output) : _output ?? null')
  })
  test('reuses an existing React createElement import', () => {
    const code = compile(`
      import {createElement as h} from 'react'
      import Branch from 'branch-component'
      const view = <Branch if={ready} then={Success} />
    `)
    expect(code.match(/from ["']react["']/g)).toHaveLength(1)
    expect(code).toContain('typeof _output === "function" ? h(_output) : _output ?? null')
    expect(code).not.toContain('_createElement')
  })
  test('renders then before children in a fragment', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = <Branch if={ready} then={Header}><Content /></Branch>
    `)
    expect(code).toContain('ready ? <>{_renderBranchOutput(Header)}<Content /></> : null')
  })
  test('forwards className to the selected output', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = <Branch if={ready} className={[classes.item, maybe ? classes.active : undefined, null]} then={Success} else={<Fallback className='fallback' />} />
    `)
    expect(code).not.toContain('branch-component')
    expect(code).toContain("_applyBranchClassName([classes.item, maybe ? classes.active : undefined, null], ready ? _renderBranchOutput(Success) : _renderBranchOutput(<Fallback className='fallback' />))")
    expect(code).toContain('const _classNames = (Array.isArray(_className) ? _className : [_className]).filter(_value => _value !== void 0 && _value !== null)')
    expect(code).toContain('const _normalizedClassName = _classNames.join(" ")')
    expect(code).toContain('className: [_output.props.className, _normalizedClassName].filter(Boolean).join(" ")')
  })
  test('forwards className through multiple children', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = <Branch if={ready} className='branch'><Content className='own' /><Other /></Branch>
    `)
    expect(code).toContain("_applyBranchClassName('branch', ready ? [<Content className='own' />, <Other />] : null)")
    expect(code).toContain('Array.isArray(_output)')
    expect(code).toContain('_output.type === _Fragment')
  })
  test('compiles nested branches from the inside out', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = <Branch if={outer}><Branch if={inner}><Thing /></Branch></Branch>
    `)
    expect(code).not.toContain('<Branch')
    expect(code).toContain('outer ? inner ? <Thing /> : null : null')
  })
  test('does not rewrite a shadowed Branch binding', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const render = Branch => <Branch if={visible} />
      const view = <Branch if={visible}><Thing /></Branch>
    `)
    expect(code).not.toContain('branch-component')
    expect(code).toContain('Branch => <Branch if={visible} />')
    expect(code).toContain('const view = visible ? <Thing /> : null')
  })
  test('keeps the key of a Branch in a list on a fragment around its output', () => {
    const code = compile(`
      import Branch from 'branch-component'
      const view = items.map(item => <Branch key={item.id} if={item.ready} else={<Pending />}><Thing /></Branch>)
      const nested = <List><Branch key='only' if={ready}><Thing /></Branch></List>
    `)
    expect(code).not.toContain('branch-component')
    expect(code.match(/from ["']react["']/g)).toHaveLength(1)
    expect(code).toContain('item => <_Fragment key={item.id}>{item.ready ? <Thing /> : _renderBranchOutput(<Pending />)}</_Fragment>')
    expect(code).toContain("<List><_Fragment key={'only'}>{ready ? <Thing /> : null}</_Fragment></List>")
  })
  test('rejects spread attributes', () => {
    expect(() => compile(`
      import Branch from 'branch-component'
      const view = <Branch {...props}><Thing /></Branch>
    `)).toThrow('Branch does not support spread attributes when compiled.')
  })
})
