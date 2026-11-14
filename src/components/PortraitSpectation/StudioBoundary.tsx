import type {PropsWithChildren} from 'react'

import Branch from 'branch-component'
import {Component} from 'react'

/** A studio failure must leave the world and the menu usable. Remount to retry on the next work. */
export default class StudioBoundary extends Component<PropsWithChildren<{portraitId: string}>, {
  failed: boolean
  portraitId?: string
}> {
  static getDerivedStateFromError() {
    return {failed: true}
  }
  static getDerivedStateFromProps({portraitId}: {portraitId: string}, state: {portraitId?: string}) {
    return portraitId === state.portraitId ? null : {
      portraitId,
      failed: false,
    }
  }
  state = {
    failed: false,
    portraitId: this.props.portraitId,
  }
  componentDidCatch(error: Error) {
    console.warn('The portrait studio could not render.', error)
  }
  render() {
    return <Branch if={this.state.failed} else={this.props.children}><p role='status'>The 3D preview is unavailable. You can still read this work’s details or return to the menu.</p></Branch>
  }
}
