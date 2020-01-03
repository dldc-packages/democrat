import { Subscription } from 'suub';
import { ChildrenUtils } from './ChildrenUtils';
import { getInternalState } from './Global';
import {
  createInstance,
  depsChanged,
  markDirty,
  globalSetTimeout,
  globalClearTimeout,
} from './utils';
import {
  Instance,
  Store,
  OnIdleExec,
  HooksData,
  Children,
  ResolveType,
  Dispatch,
  SetStateAction,
  StateHookData,
  EffectCallback,
  DependencyList,
  EffectHookData,
  LayoutEffectHookData,
  MemoHookData,
  DemocratElement,
  MutableRefObject,
  RefHookData,
  EffectType,
  Context,
} from './types';
import { DEMOCRAT_CONTEXT } from './symbols';
import { TreeElement } from './TreeElement';
import { ContextStack } from './ContextStack';

export { isValidElement, createElement, createContext } from './utils';

const Hooks = {
  // hooks
  useChildren,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  useRef,
};

export function supportReactHooks(React: any) {
  if (getInternalState().reactHooksSupported) {
    return;
  }
  const methods = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useLayoutEffect', 'useRef'];
  methods.forEach(name => {
    const originalFn = React[name];
    React[name] = (...args: Array<any>) => {
      if (getInternalState().rendering) {
        return (Hooks as any)[name](...args);
      }
      return originalFn(...args);
    };
  });
}

export function render<P, T>(rootElement: DemocratElement<P, T>): Store<T> {
  const sub = Subscription.create();
  let state: T;
  let rootElementTree: null | TreeElement = null;
  let destroyed: boolean = false;
  let execQueue: null | Array<OnIdleExec> = null;

  const rootInstance = createInstance({
    onIdle,
    parent: null,
  });

  execute();

  return {
    getState: () => state,
    subscribe: sub.subscribe,
    destroy,
  };

  function onIdle(exec: OnIdleExec) {
    if (destroyed) {
      throw new Error('Store destroyed');
    }
    if (getInternalState().rendering !== null) {
      throw new Error(`Cannot setState during render !`);
    }
    if (getInternalState().effects === null) {
      // exec and pass execute as the render fn
      exec(() => execute());
      return;
    }
    if (execQueue === null) {
      execQueue = [exec];
    } else {
      execQueue.push(exec);
    }
  }

  function flushExecQueue(): boolean {
    let renderRequested = false;
    if (execQueue) {
      execQueue.forEach(exec => {
        exec(() => {
          renderRequested = true;
        });
      });
      execQueue = null;
    }
    return renderRequested;
  }

  function scheduleEffects(effectsSync: boolean): number {
    return globalSetTimeout(() => {
      ChildrenUtils.executeEffect(rootElementTree!, rootInstance);
      const shouldRender = flushExecQueue();
      if (shouldRender) {
        execute(effectsSync);
      }
    }, 0);
  }

  function execute(
    effectsSync: boolean = false,
    scheduleEffectsBeforeRender: boolean = false
  ): void {
    if (destroyed) {
      throw new Error('Store destroyed');
    }
    let effectTimer: number | null = null;
    if (scheduleEffectsBeforeRender) {
      effectTimer = scheduleEffects(effectsSync);
    }
    if (rootElementTree === null) {
      rootElementTree = ChildrenUtils.mountChildren(rootElement, rootInstance, null);
      state = rootElementTree.value;
    } else {
      rootElementTree = ChildrenUtils.updateChildren(
        rootElementTree,
        rootElement,
        rootInstance,
        null
      );
      state = rootElementTree.value;
    }
    if (!scheduleEffectsBeforeRender) {
      effectTimer = scheduleEffects(effectsSync);
    }
    ChildrenUtils.executeLayoutEffect(rootElementTree!, rootInstance);
    const shouldRunEffectsSync = flushExecQueue();
    if (shouldRunEffectsSync || effectsSync) {
      if (effectTimer) {
        globalClearTimeout(effectTimer);
      }
      ChildrenUtils.executeEffect(rootElementTree!, rootInstance);
      const effectRequestRender = flushExecQueue();
      if (shouldRunEffectsSync) {
        execute(effectsSync, true);
      } else if (effectsSync && effectRequestRender) {
        execute(true, true);
      }
    } else {
      sub.call();
    }
  }

  function destroy() {
    if (destroyed) {
      throw new Error('Store already destroyed');
    }
    ChildrenUtils.unmountChildren(rootElementTree!, rootInstance);
    destroyed = true;
  }
}

function getCurrentInstance(): Instance {
  const state = getInternalState().rendering;
  if (state === null) {
    throw new Error(`Hooks used outside of render !`);
  }
  return state;
}

function getCurrentHook(): HooksData | null {
  const instance = getCurrentInstance();
  if (instance.hooks && instance.hooks.length > 0) {
    return instance.hooks[instance.nextHooks.length] || null;
  }
  return null;
}

function setCurrentHook(hook: HooksData) {
  const instance = getCurrentInstance();
  instance.nextHooks.push(hook);
}

export function useChildren<C extends Children>(children: C): ResolveType<C> {
  const hook = getCurrentHook();
  const parent = getCurrentInstance();
  if (hook === null) {
    const childrenTree = ChildrenUtils.mountChildren(children, parent, null);
    setCurrentHook({
      type: 'CHILDREN',
      tree: childrenTree,
    });
    return childrenTree.value;
  }
  if (hook.type !== 'CHILDREN') {
    throw new Error('Invalid Hook type');
  }
  hook.tree = ChildrenUtils.updateChildren(hook.tree, children, parent, null);
  setCurrentHook(hook);
  return hook.tree.value;
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const hook = getCurrentHook();
  const instance = getCurrentInstance();
  if (hook === null) {
    const value = typeof initialState === 'function' ? (initialState as any)() : initialState;
    const setValue: Dispatch<SetStateAction<S>> = value => {
      instance.onIdle(render => {
        const nextValue = typeof value === 'function' ? (value as any)(stateHook.value) : value;
        if (nextValue !== stateHook.value) {
          stateHook.value = nextValue;
          markDirty(instance);
          render();
        }
      });
    };
    const stateHook: StateHookData = { type: 'STATE', value, setValue };
    setCurrentHook(stateHook);
    return [value, setValue];
  }
  if (hook.type !== 'STATE') {
    throw new Error('Invalid Hook type');
  }
  setCurrentHook(hook);
  return [hook.value, hook.setValue];
}

export function useEffect(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectInternal('EFFECT', effect, deps);
}

export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectInternal('LAYOUT_EFFECT', effect, deps);
}

function useEffectInternal(type: EffectType, effect: EffectCallback, deps?: DependencyList): void {
  const hook = getCurrentHook();
  if (hook === null) {
    const effectHook: EffectHookData | LayoutEffectHookData = {
      type,
      effect,
      cleanup: undefined,
      deps,
      dirty: true,
    };
    setCurrentHook(effectHook);
    return;
  }
  if (hook.type !== type) {
    throw new Error('Invalid Hook type');
  }
  if (depsChanged(hook.deps, deps)) {
    hook.effect = effect;
    hook.deps = deps;
    hook.dirty = true;
    setCurrentHook(hook);
    return;
  }
  // ignore this effect
  setCurrentHook(hook);
  return;
}

export function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T {
  const hook = getCurrentHook();
  if (hook === null) {
    const memoHook: MemoHookData = {
      type: 'MEMO',
      value: factory(),
      deps,
    };
    setCurrentHook(memoHook);
    return memoHook.value;
  }
  if (hook.type !== 'MEMO') {
    throw new Error('Invalid Hook type');
  }
  if (depsChanged(hook.deps, deps)) {
    hook.deps = deps;
    hook.value = factory();
  }
  setCurrentHook(hook);
  return hook.value;
}

export function useCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, deps);
}

export function useRef<T extends unknown>(initialValue: T): MutableRefObject<T>;
export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
export function useRef<T>(initialValue?: T): MutableRefObject<T> {
  const hook = getCurrentHook();
  if (hook === null) {
    const memoHook: RefHookData = {
      type: 'REF',
      ref: {
        current: initialValue,
      },
    };
    setCurrentHook(memoHook);
    return memoHook.ref;
  }
  if (hook.type !== 'REF') {
    throw new Error('Invalid Hook type');
  }
  setCurrentHook(hook);
  return hook.ref;
}

export function useContext<C extends Context<any>>(
  context: C
): C[typeof DEMOCRAT_CONTEXT]['hasDefault'] extends false
  ? C[typeof DEMOCRAT_CONTEXT]['defaultValue'] | undefined
  : C[typeof DEMOCRAT_CONTEXT]['defaultValue'] {
  const instance = getCurrentInstance();
  setCurrentHook({} as any);
  const read = ContextStack.read(instance.context, context);
  if (read.found) {
    return read.value;
  }
  return undefined as any;
}

/**
 * Same as useContext except if there are no provider and no default value it throw an error
 */
export function useContextOrThrow<C extends Context<any>>(
  _context: C
): C[typeof DEMOCRAT_CONTEXT]['defaultValue'] {
  throw new Error(`Implement this !`);
}

// useImperativeHandle<T, R extends T>(ref: Ref<T>|undefined, init: () => R, deps?: DependencyList): void;

// useDebugValue<T>(value: T, format?: (value: T) => any): void;
