import { DEMOCRAT_ELEMENT, DEMOCRAT_INSTANCE } from './symbols';
import { DemocratElement, Instance, OnIdle, Key, Component, DependencyList, Props } from './types';

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
}

export const createInstance = (() => {
  let nextInstanceId = 0;

  return ({ onIdle, key, parent }: CreateInstanceParams): Instance => {
    return {
      [DEMOCRAT_INSTANCE]: true,
      id: nextInstanceId++,
      hooks: null,
      nextHooks: [],
      key,
      onIdle,
      parent,
      dirty: false,
    };
  };
})();

export function createElement<P, T>(
  component: Component<P, T>,
  props: Props<P>
): DemocratElement<P, T> {
  const key = props.key;
  delete props.key;
  return {
    [DEMOCRAT_ELEMENT]: true,
    component: component,
    props: props,
    key,
  };
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
