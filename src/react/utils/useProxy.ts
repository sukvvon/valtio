import { useLayoutEffect } from 'react'
import { useSnapshot } from '../../react.ts'

const DUMMY_SYMBOL = Symbol()

/**
 * useProxy
 *
 * Takes a proxy and returns a new proxy which you can use in both react render
 * and in callbacks. The root reference is replaced on every render, but the
 * keys (and subkeys) below it are stable until they're intentionally mutated.
 * For the best ergonomics, you can export a custom hook from your store, so you
 * don't have to figure out a separate name for the hook reference. E.g.:
 *
 * export const store = proxy(initialState)
 * export const useStore = () => useProxy(store)
 * // in the component file:
 * function Cmp() {
 *   const store = useStore()
 *   return <button onClick={() => {store.count++}}>{store.count}</button>
 * }
 *
 * @param proxy
 * @param options
 * @returns A new proxy which you can use in the render as well as in callbacks.
 */
export function useProxy<T extends object>(
  proxy: T,
  options?: NonNullable<Parameters<typeof useSnapshot>[1]>,
): T {
  const snapshot = useSnapshot(proxy, options) as T

  // touch dummy prop so that it doesn't trigger re-renders when no props are touched.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  ;(snapshot as any)[DUMMY_SYMBOL]

  let isRendering = true
  useLayoutEffect(() => {
    // This is an intentional hack
    // It might not work with React Compiler
    // eslint-disable-next-line react-hooks/react-compiler, react-hooks/exhaustive-deps
    isRendering = false
  })

  return new Proxy(proxy, {
    get(target, prop) {
      return isRendering ? snapshot[prop as keyof T] : target[prop as keyof T]
    },
  })
}
