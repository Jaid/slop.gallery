import type {DisposableResource} from '../disposeResource.ts'

import {useEffect, useMemo} from 'react'

import disposeResource from '../disposeResource.ts'
import RetainedLifetime from '../RetainedLifetime.ts'

/** One owner per memoized resource. StrictMode effect replay is not a final unmount. */
export default function useDisposable<T extends DisposableResource | undefined>(resource: T) {
  const lifetime = useMemo(() => (resource === undefined ? undefined : new RetainedLifetime(() => disposeResource(resource))), [resource])
  useEffect(() => {
    if (!lifetime) {
      return
    }
    const lease = lifetime.retain()
    return () => lease[Symbol.dispose]()
  }, [lifetime])
  return resource
}
