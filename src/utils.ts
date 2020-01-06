import { DEMOCRAT_ELEMENT, DEMOCRAT_CONTEXT, DEMOCRAT_ROOT } from './symbols';
import {
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
  TreeElementType,
  TreeElementCommon,
  TreeElementData,
  TreeElement,
  DemocratRootElement,
} from './types';

export function isValidElement(maybe: any): maybe is DemocratElement<any, any> {
  return maybe && maybe[DEMOCRAT_ELEMENT] === true;
}

export function isRootElement(maybe: any): maybe is DemocratRootElement {
  return maybe && maybe[DEMOCRAT_ELEMENT] === true && maybe[DEMOCRAT_ROOT] === true;
}

export function createElement<P, T>(
  component: Component<P, T>,
  props: Props<P>
): DemocratElement<P, T>;
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

export function markDirty(instance: TreeElement<'CHILD'>, limit: TreeElement | null = null) {
  let current: TreeElement | null = instance;
  while (current !== null && current !== limit) {
    if (current.type === 'CHILD') {
      if (current.dirty === true) {
        break;
      }
      current.dirty = true;
    }
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
      hasDefault: defaultValue !== undefined && arguments.length === 1,
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

const nextId = (() => {
  let id = 0;
  return () => id++;
})();

export function createTreeElement<T extends TreeElementType>(
  type: T,
  parent: TreeElement,
  data: Omit<TreeElementCommon, 'id' | 'state' | 'parent' | 'root'> & TreeElementData[T]
): TreeElement<T> {
  const id = nextId();
  return {
    type,
    id,
    state: 'created',
    parent,
    root: parent.type === 'ROOT' ? parent : parent.root,
    ...data,
  } as any;
}

export function createRootTreeElement(
  data: Omit<TreeElementCommon, 'id' | 'state' | 'parent' | 'root'> & TreeElementData['ROOT']
): TreeElement<'ROOT'> {
  return {
    type: 'ROOT',
    id: nextId(),
    state: 'created',
    root: null,
    parent: null,
    ...data,
  } as any;
}

/**
 * Array have the same structure if
 *  - they have the same length
 *  - the keys have not moved
 */
export function sameArrayStructure(prev: Array<TreeElement>, children: Array<any>): boolean {
  if (prev.length !== children.length) {
    return false;
  }
  const prevKeys = prev.map(item => (item.type === 'CHILD' ? item.element.key : undefined));
  const childrenKeys = children.map(item => (isValidElement(item) ? item.key : undefined));
  return arrayShallowEqual(prevKeys, childrenKeys);
}

export function sameMapStructure(prev: Map<any, TreeElement>, children: Map<any, any>): boolean {
  if (prev.size !== children.size) {
    return false;
  }
  let allIn = true;
  prev.forEach((_v, k) => {
    if (allIn === true && children.has(k) === false) {
      allIn = false;
    }
  });
  return allIn;
}

export function findProvider(
  tree: TreeElement,
  context: Context<any>
): TreeElement<'PROVIDER'> | null {
  let current: TreeElement | null = tree;
  while (true) {
    if (current === null) {
      break;
    }
    if (current.type === 'PROVIDER' && current.element.type.context === context) {
      break;
    }
    current = current.parent;
  }
  return current;
}

export function registerContextSub(instance: TreeElement<'CHILD'>, context: Context<any>) {
  const root = instance.root!;
  if (!root.context.has(context)) {
    root.context.set(context, new Set());
  }
  root.context.get(context)!.add(instance);
}

export function unregisterContextSub(instance: TreeElement<'CHILD'>, context: Context<any>) {
  const root = instance.root!;
  if (!root.context.has(context)) {
    return;
  }
  const ctx = root.context.get(context)!;
  ctx.delete(instance);
  if (ctx.size === 0) {
    root.context.delete(context);
  }
}

export function markContextSubDirty(instance: TreeElement, context: Context<any>) {
  const root = instance.root!;
  const ctx = root.context.get(context);
  if (ctx) {
    ctx.forEach(c => {
      if (isDescendantOf(c, instance)) {
        markDirty(c, instance);
      }
    });
  }
}

export function isDescendantOf(instance: TreeElement, parent: TreeElement) {
  let current: TreeElement | null = instance;
  while (current !== null && current !== parent) {
    current = current.parent;
  }
  return current === parent;
}
