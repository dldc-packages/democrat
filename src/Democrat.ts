import { Subscription } from 'suub';
import { ChildrenUtils } from './ChildrenUtils';
import {
  getInternalState,
  getCurrentHook,
  getCurrentChildInstance,
  setCurrentHook,
} from './Global';
import {
  depsChanged,
  markDirty,
  globalSetTimeout,
  globalClearTimeout,
  createRootTreeElement,
  findProvider,
} from './utils';
import {
  Store,
  OnIdleExec,
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
  ContextHookData,
  DemocratRootElement,
  TreeElement,
} from './types';
import { DEMOCRAT_CONTEXT, DEMOCRAT_ELEMENT, DEMOCRAT_ROOT } from './symbols';

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

export function render<P, T>(rootChildren: DemocratElement<P, T>): Store<T> {
  const sub = Subscription.create();
  let state: T;
  let destroyed: boolean = false;
  let execQueue: null | Array<OnIdleExec> = null;
  let renderRequested = false;
  let flushScheduled = false;

  const rootElem: DemocratRootElement = {
    [DEMOCRAT_ELEMENT]: true,
    [DEMOCRAT_ROOT]: true,
    children: rootChildren,
  };

  let rootInstance: TreeElement<'ROOT'> = createRootTreeElement({
    onIdle,
    requestRender,
    value: null,
    previous: null,
    mounted: false,
    children: null as any,
    context: new Map(),
  });

  doRender();

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
    if (execQueue === null) {
      execQueue = [exec];
    } else {
      execQueue.push(exec);
    }
    scheduleFlush();
  }

  function scheduleFlush(): void {
    if (flushScheduled) {
      return;
    }
    flushScheduled = true;
    globalSetTimeout(() => {
      flushScheduled = false;
      const shouldRender = flushExecQueue();
      if (shouldRender) {
        doRender();
      }
    }, 0);
  }

  function requestRender(): void {
    renderRequested = true;
  }

  function flushExecQueue(): boolean {
    renderRequested = false;
    if (execQueue) {
      execQueue.forEach(exec => {
        exec();
      });
      execQueue = null;
    }
    return renderRequested;
  }

  function doRender(effectsSync: boolean = false): void {
    if (destroyed) {
      throw new Error('Store destroyed');
    }
    if (rootInstance.mounted === false) {
      rootInstance = ChildrenUtils.mount(rootElem, rootInstance) as any;
    } else {
      rootInstance = ChildrenUtils.update(rootInstance, rootElem, null) as any;
    }
    state = rootInstance.value;
    const effectTimer = scheduleEffects();
    ChildrenUtils.layoutEffects(rootInstance);
    const layoutEffectsRequestRender = flushExecQueue();
    if (layoutEffectsRequestRender || effectsSync) {
      if (effectTimer) {
        globalClearTimeout(effectTimer);
      }
      ChildrenUtils.effects(rootInstance);
      const effectsRequestRender = flushExecQueue();
      if (layoutEffectsRequestRender || effectsRequestRender) {
        doRender(true);
      }
    } else {
      sub.call();
    }
  }

  function scheduleEffects(): number {
    return globalSetTimeout(() => {
      ChildrenUtils.effects(rootInstance);
      const shouldRender = flushExecQueue();
      if (shouldRender) {
        doRender();
      }
    }, 0);
  }

  function destroy() {
    if (destroyed) {
      throw new Error('Store already destroyed');
    }
    ChildrenUtils.unmount(rootInstance);
    destroyed = true;
  }
}

export function useChildren<C extends Children>(children: C): ResolveType<C> {
  const hook = getCurrentHook();
  const parent = getCurrentChildInstance();
  if (hook === null) {
    const childrenTree = ChildrenUtils.mount(children, parent);
    setCurrentHook({
      type: 'CHILDREN',
      tree: childrenTree,
    });
    return childrenTree.value;
  }
  if (hook.type !== 'CHILDREN') {
    throw new Error('Invalid Hook type');
  }
  hook.tree = ChildrenUtils.update(hook.tree, children, hook.tree.parent);
  setCurrentHook(hook);
  return hook.tree.value;
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const hook = getCurrentHook();
  const instance = getCurrentChildInstance();
  if (hook === null) {
    const value = typeof initialState === 'function' ? (initialState as any)() : initialState;
    const setValue: Dispatch<SetStateAction<S>> = value => {
      instance.root.onIdle(() => {
        const nextValue = typeof value === 'function' ? (value as any)(stateHook.value) : value;
        if (nextValue !== stateHook.value) {
          stateHook.value = nextValue;
          markDirty(instance);
          instance.root.requestRender();
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

export function useContextInternal<C extends Context<any>>(
  context: C
): { found: C[typeof DEMOCRAT_CONTEXT]['defaultValue']; value: any } {
  const instance = getCurrentChildInstance();
  const hook = getCurrentHook();
  if (hook !== null) {
    if (hook.type !== 'CONTEXT') {
      throw new Error('Invalid Hook type');
    }
  }
  // TODO: move provider and value resolution to the instance level
  const provider = findProvider(instance, context);
  const value = provider
    ? provider.element.props.value
    : context[DEMOCRAT_CONTEXT].hasDefault
    ? context[DEMOCRAT_CONTEXT].defaultValue
    : undefined;
  const contextHook: ContextHookData = {
    type: 'CONTEXT',
    context,
    provider,
    value,
  };
  setCurrentHook(contextHook);
  return {
    found: provider !== null,
    value,
  };
}

export function useContext<C extends Context<any>>(
  context: C
): C[typeof DEMOCRAT_CONTEXT]['hasDefault'] extends false
  ? C[typeof DEMOCRAT_CONTEXT]['defaultValue'] | undefined
  : C[typeof DEMOCRAT_CONTEXT]['defaultValue'] {
  return useContextInternal(context).value;
}

/**
 * Same as useContext except if there are no provider and no default value it throw an error
 */
export function useContextOrThrow<C extends Context<any>>(
  context: C
): C[typeof DEMOCRAT_CONTEXT]['defaultValue'] {
  const { found, value } = useContextInternal(context);
  if (found === false && context[DEMOCRAT_CONTEXT].hasDefault === false) {
    throw new Error('Missing Provider');
  }
  return value;
}

// useImperativeHandle<T, R extends T>(ref: Ref<T>|undefined, init: () => R, deps?: DependencyList): void;

// useDebugValue<T>(value: T, format?: (value: T) => any): void;
