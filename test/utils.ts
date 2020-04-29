import { Store } from '../src';

export function waitForNextState<T>(store: Store<T>): Promise<T> {
  return new Promise(res => {
    const unsub = store.subscribe(() => {
      unsub();
      res(store.getState());
    });
  });
}

export function waitForNextTick(): Promise<void> {
  return new Promise(res => {
    setTimeout(() => {
      res();
    }, 0);
  });
}

export function mapMap<K, V, U>(source: Map<K, V>, mapper: (v: V, k: K) => U): Map<K, U> {
  const result = new Map<K, U>();
  source.forEach((v, k) => {
    result.set(k, mapper(v, k));
  });
  return result;
}

export function mapObject<T extends { [key: string]: any }, U>(
  obj: T,
  mapper: (v: T[keyof T], key: string) => U
): { [K in keyof T]: U } {
  return Object.keys(obj).reduce((acc, key) => {
    (acc as any)[key] = mapper(obj[key], key);
    return acc;
  }, {} as { [K in keyof T]: U });
}

export function removeFunctionsDeep<T>(item: T): T {
  if (typeof item === 'function') {
    return 'REMOVED_FUNCTION' as any;
  }
  if (Array.isArray(item)) {
    return item.map(v => removeFunctionsDeep(v)) as any;
  }
  if (isPlainObject(item)) {
    return mapObject(item, v => removeFunctionsDeep(v)) as any;
  }
  if (item instanceof Map) {
    return mapMap(item, v => removeFunctionsDeep(v)) as any;
  }
  return item;
}

export function isPlainObject(o: any): o is object {
  let ctor, prot;

  if (isObjectObject(o) === false) return false;

  // If has modified constructor
  ctor = o.constructor;
  if (typeof ctor !== 'function') return false;

  // If has modified prototype
  prot = ctor.prototype;
  if (isObjectObject(prot) === false) return false;

  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty('isPrototypeOf') === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
}

function isObject(val: any) {
  return val != null && typeof val === 'object' && Array.isArray(val) === false;
}

function isObjectObject(o: any) {
  return isObject(o) === true && Object.prototype.toString.call(o) === '[object Object]';
}
