import { DEMOCRAT_ELEMENT, DEMOCRAT_INSTANCE, DEMOCRAT_CONTEXT } from './symbols';
import {
  Instance,
  OnIdle,
  Key,
  Component,
  DependencyList,
  Props,
  AllOptional,
  Context,
  DemocratElement,
  DemocratContextConsumer,
  ContextConsumerProps,
  DemocratContextProvider,
  ContextProviderProps,
  ResolveType,
  DemocratElementComponent,
  DemocratElementProvider,
  DemocratElementConsumer,
} from './types';
import { ContextStack } from './ContextStack';

export function isValidElement(maybe: any): maybe is DemocratElement<any, any> {
  return maybe && maybe[DEMOCRAT_ELEMENT] === true;
}

export function isInstance(maybe: any): maybe is Instance {
  return maybe && maybe[DEMOCRAT_INSTANCE] === true;
}

interface CreateInstanceParams {
  onIdle: OnIdle;
  parent: null | Instance;
  key?: Key;
  context?: ContextStack | null;
}

export const createInstance = (() => {
  let nextInstanceId = 0;

  return ({ onIdle, key, parent, context = null }: CreateInstanceParams): Instance => {
    return {
      [DEMOCRAT_INSTANCE]: true,
      id: nextInstanceId++,
      hooks: null,
      nextHooks: [],
      key,
      onIdle,
      parent,
      context,
      dirty: false,
    };
  };
})();

export function createElement<P, T>(
  context: DemocratContextConsumer<P>,
  props: ContextConsumerProps<P, T>
): DemocratElement<P, ResolveType<T>>;
export function createElement<P, T>(
  context: DemocratContextProvider<P>,
  props: ContextProviderProps<P, T>
): DemocratElement<P, ResolveType<T>>;
export function createElement<P, T>(
  component: Component<P, T>,
  props: Props<P>
): DemocratElement<P, T>;
export function createElement<P, T>(
  component: Component<P, T>,
  props?: Props<P>
): AllOptional<P> extends true ? DemocratElement<P, T> : { typeError: 'Props are required !' };
export function createElement<P, T>(
  component: Component<P, T> | DemocratContextProvider<P> | DemocratContextConsumer<P>,
  props: Props<P> = {} as any
): AllOptional<P> extends true ? DemocratElement<P, T> : { typeError: 'Props are required !' } {
  const key = props.key;
  delete props.key;
  const element: DemocratElement<P, T> = {
    [DEMOCRAT_ELEMENT]: true,
    type: component as any,
    props: props,
    key,
  };
  return element as any;
}

export function objectShallowEqual(
  deps1: { [key: string]: any } | undefined,
  deps2: { [key: string]: any } | undefined
): boolean {
  if (deps1 === deps2) {
    return true;
  }
  if (deps1 === undefined || deps2 === undefined) {
    return false;
  }
  const keys = Object.keys(deps1);
  if (!arrayShallowEqual(keys, Object.keys(deps2))) {
    return false;
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!Object.is(deps1[key], deps2[key])) {
      return false;
    }
  }
  return true;
}

export function sameObjectKeys(
  obj1: { [key: string]: any },
  obj2: { [key: string]: any }
): boolean {
  return arrayShallowEqual(Object.keys(obj1).sort(), Object.keys(obj2).sort());
}

export function arrayShallowEqual(deps1: ReadonlyArray<any>, deps2: ReadonlyArray<any>): boolean {
  if (deps1 === deps2) {
    return true;
  }
  if (deps1.length !== deps2.length) {
    return false;
  }
  for (let i = 0; i < deps1.length; i++) {
    const dep = deps1[i];
    if (!Object.is(dep, deps2[i])) {
      return false;
    }
  }
  return true;
}

export function depsChanged(
  deps1: DependencyList | undefined,
  deps2: DependencyList | undefined
): boolean {
  if (deps1 === undefined || deps2 === undefined) {
    return true;
  }
  if (deps1.length !== deps2.length) {
    return true;
  }
  return !arrayShallowEqual(deps1, deps2);
}

export function markDirty(instance: Instance) {
  let current: Instance | null = instance;
  while (current !== null && current.dirty === false) {
    current.dirty = true;
    current = current.parent;
  }
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

export const globalSetTimeout: typeof window.setTimeout = setTimeout as any;
export const globalClearTimeout: typeof window.clearTimeout = clearTimeout as any;

export function mapMap<K, V, U>(source: Map<K, V>, mapper: (v: V, k: K) => U): Map<K, U> {
  const result = new Map<K, U>();
  source.forEach((v, k) => {
    result.set(k, mapper(v, k));
  });
  return result;
}

export function mapSet<V, U>(source: Set<V>, mapper: (v: V) => U): Set<U> {
  const result = new Set<U>();
  source.forEach(v => {
    result.add(mapper(v));
  });
  return result;
}

export function createContext<T>(): Context<T, false>;
export function createContext<T>(defaultValue: T): Context<T, true>;
export function createContext<T>(defaultValue?: T): Context<T, boolean> {
  const context: Context<T, boolean> = {
    [DEMOCRAT_CONTEXT]: {
      hasDefault: defaultValue !== undefined && arguments.length === 2,
      defaultValue: defaultValue as any, // force undefined when there a no default value
    },
    Consumer: {
      [DEMOCRAT_CONTEXT]: 'CONSUMER',
      context: null as any,
    },
    Provider: {
      [DEMOCRAT_CONTEXT]: 'PROVIDER',
      context: null as any,
    },
  };
  context.Consumer.context = context;
  context.Provider.context = context;
  return context;
}

export function isComponentElement(
  element: DemocratElement<any, any>
): element is DemocratElementComponent<any, any> {
  return typeof element.type === 'function';
}

export function isProviderElement(
  element: DemocratElement<any, any>
): element is DemocratElementProvider<any, any> {
  return typeof element.type !== 'function' && element.type[DEMOCRAT_CONTEXT] === 'PROVIDER';
}

export function isConsumerElement(
  element: DemocratElement<any, any>
): element is DemocratElementConsumer<any, any> {
  return typeof element.type !== 'function' && element.type[DEMOCRAT_CONTEXT] === 'CONSUMER';
}
