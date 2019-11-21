import { Subscription } from 'suub';
import { DEMOCRAT_INTERNAL_STATE } from './symbols';
import { createInstance, createElement, depsChanged, markDirty } from './utils';
import { ChildrenUtils } from './ChildrenUtils';
import { getInternalState } from './Global';
import { ComponentUtils } from './ComponentUtils';
import {
  Component,
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
} from './types';

export const Democrat = {
  [DEMOCRAT_INTERNAL_STATE]: getInternalState(),
  createElement,
  useChildren,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  render,
};

function render<P, T>(component: Component<P, T>, props: P): Store<T> {
  const sub = Subscription.create();
  let state: T;
  let execQueue: null | Array<OnIdleExec> = null;

  const rootInstance = createInstance({
    onIdle,
    parent: null,
  });

  (window as any).rootInstance = rootInstance;

  function onIdle(exec: OnIdleExec) {
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
    return window.setTimeout(() => {
      ComponentUtils.executeEffect(rootInstance);
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
    let effectTimer: number | null = null;
    if (scheduleEffectsBeforeRender) {
      effectTimer = scheduleEffects(effectsSync);
      state = ComponentUtils.render(component, props, rootInstance, null);
    } else {
      state = ComponentUtils.render(component, props, rootInstance, null);
      effectTimer = scheduleEffects(effectsSync);
    }
    ComponentUtils.executeLayoutEffect(rootInstance);
    const shouldRunEffectsSync = flushExecQueue();
    if (shouldRunEffectsSync || effectsSync) {
      if (effectTimer) {
        window.clearTimeout(effectTimer);
      }
      ComponentUtils.executeEffect(rootInstance);
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

  execute();

  return {
    getState: () => state,
    subscribe: sub.subscribe,
  };
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

function useChildren<C extends Children>(children: C): ResolveType<C> {
  const hook = getCurrentHook();
  const parent = getCurrentInstance();
  if (hook === null) {
    const childrenTree = ChildrenUtils.mount(children, parent);
    setCurrentHook({
      type: 'CHILDREN',
      children: childrenTree,
    });
    return childrenTree.value;
  }
  if (hook.type !== 'CHILDREN') {
    throw new Error('Invalid Hook type');
  }
  hook.children = ChildrenUtils.update(hook.children, children, parent);
  setCurrentHook(hook);
  return hook.children.value;
}

function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
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

function useEffect(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectInternal('EFFECT', effect, deps);
}

function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectInternal('LAYOUT_EFFECT', effect, deps);
}

function useEffectInternal(
  type: 'EFFECT' | 'LAYOUT_EFFECT',
  effect: EffectCallback,
  deps?: DependencyList
): void {
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

function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T {
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

function useCallback<T extends (...args: any[]) => unknown>(callback: T, deps: DependencyList): T {
  return Democrat.useMemo(() => callback, deps);
}

// useRef<T extends unknown>(initialValue: T): MutableRefObject<T>;
// useRef<T = undefined>(): MutableRefObject<T | undefined>;
// useContext<T>(context: Context<T>): T;
// useImperativeHandle<T, R extends T>(ref: Ref<T>|undefined, init: () => R, deps?: DependencyList): void;

// useDebugValue<T>(value: T, format?: (value: T) => any): void;
