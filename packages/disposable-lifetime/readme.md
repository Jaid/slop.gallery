# disposable-lifetime

Reference-counted ownership with effect-replay-safe final disposal. The core owns a disposer callback and returns standard JavaScript `Disposable` leases; it has no React or renderer dependency.

`retain()` returns an idempotent lease implementing `[Symbol.dispose]()`. Final disposal is queued for the next microtask: a synchronous release–retain sequence (such as React StrictMode effect replay) keeps the resource alive. Multiple leases are supported; the disposer runs exactly once after the final release. Retaining an already disposed lifetime throws.

```ts
import RetainedLifetime from 'disposable-lifetime'

const lifetime = new RetainedLifetime(() => resource.dispose())

{
  using lease = lifetime.retain()
  // Use the resource.
}
```

A lease can also be released explicitly with `lease[Symbol.dispose]()`.

## React

```tsx
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

const texture = useDisposable(useMemo(() => createTexture(), []))
```

The hook returns the same resource and owns its final disposal, including dependency replacement. Native `Disposable` resources are released through `[Symbol.dispose]()`; Three-style resources with a synchronous `.dispose()` method are adapted automatically. Give each memoized resource one owning hook. Do not also dispose it from another effect or renderer auto-disposal. This is for resources that already exist during render; asynchronously prepared resources should instead be created and owned inside their effect, with cancellation for late results.

Pass `undefined` when there is nothing to own. Replacing a resource with `undefined` still releases it. Disposal is terminal: the microtask grace period is not a cache or a timeout-based eviction policy.
