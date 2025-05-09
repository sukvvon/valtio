import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap, snapCache } = unstable_getInternalStates()
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<V>
  index: number
  epoch: number
  toJSON: () => Map<K, V>
}

/**
 * Determines if an object is a proxy Map created with proxyMap
 *
 * @param {object} obj - The object to check
 * @returns {boolean} True if the object is a proxy Map, false otherwise
 */
export const isProxyMap = (obj: object): boolean => {
  return (
    Symbol.toStringTag in obj &&
    obj[Symbol.toStringTag] === 'Map' &&
    proxyStateMap.has(obj)
  )
}

/**
 * Creates a reactive Map that integrates with Valtio's proxy system
 *
 * This utility creates a Map-like object that works with Valtio's reactivity system,
 * allowing you to track changes to the Map in the same way as regular proxy objects.
 * The API is the same as the standard JavaScript Map.
 *
 * @template K - Type of the Map keys
 * @template V - Type of the Map values
 * @param {Iterable<[K, V]>} [entries] - Initial key-value pairs to populate the Map
 * @returns {Map<K, V>} A proxy Map object that tracks changes
 * @throws {TypeError} If entries is not iterable
 *
 * @example
 * import { proxyMap } from 'valtio/utils'
 * const state = proxyMap([["key", "value"]])
 *
 * // can be used inside a proxy as well
 * const state = proxy({
 *   count: 1,
 *   map: proxyMap()
 * })
 *
 * // When using an object as a key, you can wrap it with `ref` so it's not proxied
 * // this is useful if you want to preserve the key equality
 * import { ref } from 'valtio'
 *
 * const key = ref({})
 * state.set(key, "value")
 * state.get(key) //value
 *
 * const key = {}
 * state.set(key, "value")
 * state.get(key) //undefined
 */
export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialData: Array<V> = []
  let initialIndex = 0
  const indexMap = new Map<K, number>()

  const snapMapCache = new WeakMap<object, Map<K, number>>()
  const registerSnapMap = () => {
    const cache = snapCache.get(vObject)
    const latestSnap = cache?.[1]
    if (latestSnap && !snapMapCache.has(latestSnap)) {
      const clonedMap = new Map(indexMap)
      snapMapCache.set(latestSnap, clonedMap)
    }
  }
  const getMapForThis = (x: any) => snapMapCache.get(x) || indexMap

  if (entries) {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [key, value] of entries) {
      indexMap.set(key, initialIndex)
      initialData[initialIndex++] = value
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: initialData,
    index: initialIndex,
    epoch: 0,
    get size() {
      if (!isProxy(this)) {
        registerSnapMap()
      }
      const map = getMapForThis(this)
      return map.size
    },
    get(key: K) {
      const map = getMapForThis(this)
      const index = map.get(key)
      if (index === undefined) {
        this.epoch // touch property for tracking
        return undefined
      }
      return this.data[index]
    },
    has(key: K) {
      const map = getMapForThis(this)
      this.epoch // touch property for tracking
      return map.has(key)
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const index = indexMap.get(key)
      if (index === undefined) {
        indexMap.set(key, this.index)
        this.data[this.index++] = value
      } else {
        this.data[index] = value
      }
      this.epoch++
      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const index = indexMap.get(key)
      if (index === undefined) {
        return false
      }
      delete this.data[index]
      indexMap.delete(key)
      this.epoch++
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.length = 0 // empty array
      this.index = 0
      this.epoch++
      indexMap.clear()
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      this.epoch // touch property for tracking
      const map = getMapForThis(this)
      map.forEach((index, key) => {
        cb(this.data[index]!, key, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      this.epoch // touch property for tracking
      const map = getMapForThis(this)
      for (const [key, index] of map) {
        yield [key, this.data[index]!]
      }
    },
    *keys(): IterableIterator<K> {
      this.epoch // touch property for tracking
      const map = getMapForThis(this)
      for (const key of map.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      this.epoch // touch property for tracking
      const map = getMapForThis(this)
      for (const index of map.values()) {
        yield this.data[index]!
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map(this.entries())
    },
  }

  const proxiedObject = proxy(vObject)
  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    index: { enumerable: false },
    epoch: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}
