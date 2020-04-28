import { Subscription } from 'suub';
import { ChildrenUtils } from './ChildrenUtils';
import { getCurrentRootInstance, setCurrentRootInstance } from './Global';
import {
  depsChanged,
  globalSetTimeout,
  globalClearTimeout,
  createRootTreeElement,
  getPatchPath,
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
  MutableRefObject,
  RefHookData,
  EffectType,
  Context,
  ContextHookData,
  DemocratRootElement,
  TreeElement,
  TreeElementPath,
  Patch,
  Patches,
  ReducerWithoutAction,
  ReducerStateWithoutAction,
  DispatchWithoutAction,
  Reducer,
  ReducerState,
  ReducerAction,
  ReducerHookData,
  ReducerPatch,
  StatePatch,
  Snapshot,
} from './types';
import { DEMOCRAT_CONTEXT, DEMOCRAT_ELEMENT, DEMOCRAT_ROOT } from './symbols';

export { isValidElement, createElement, createContext } from './utils';

const Hooks = {
  // hooks
  useChildren,
  useState,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  useRef,
};

export interface RenderOptions {
  // pass an instance of React to override hooks
  ReactInstance?: null | any;
  // In passive mode, effect are never not executed
  passiveMode?: boolean;
  // restore a snapshot
  snapshot?: Snapshot;
}

export function render<C extends Children>(
  rootChildren: C,
  options: RenderOptions = {}
): Store<ResolveType<C>> {
  const { ReactInstance = null, passiveMode = false } = options;

  // TODO: Handle snapshot

  const stateSub = Subscription.create();
  const patchesSub = Subscription.create<Patches>();

  let state: ResolveType<C>;
  let destroyed: boolean = false;
  let execQueue: null | Array<OnIdleExec> = null;
  let renderRequested = false;
  let flushScheduled = false;
  let patchesQueue: Patches = [];

  const rootElem: DemocratRootElement = {
    [DEMOCRAT_ELEMENT]: true,
    [DEMOCRAT_ROOT]: true,
    children: rootChildren,
  };

  let rootInstance: TreeElement<'ROOT'> = createRootTreeElement({
    onIdle,
    requestRender,
    applyPatches,
    passiveMode,
  });

  if (ReactInstance) {
    rootInstance.supportReactHooks(ReactInstance, Hooks);
  }

  doRender();

  return {
    getState: () => state,
    subscribe: stateSub.subscribe,
    destroy,
    subscribePatches: patchesSub.subscribe,
    applyPatches,
    getSnapshot,
  };

  function getSnapshot(): Snapshot {
    return ChildrenUtils.snapshot<'ROOT'>(rootInstance);
  }

  function doRender(): void {
    if (destroyed) {
      throw new Error('Store destroyed');
    }
    setCurrentRootInstance(rootInstance);
    if (rootInstance.mounted === false) {
      rootInstance = ChildrenUtils.mount(rootElem, rootInstance, null as any) as any;
    } else {
      rootInstance = ChildrenUtils.update(rootInstance, rootElem, null as any, null as any) as any;
    }
    setCurrentRootInstance(null);
    state = rootInstance.value;
    // Schedule setTimeout(() => runEffect)
    const effectTimer = scheduleEffects();
    // run layoutEffects
    ChildrenUtils.layoutEffects(rootInstance);
    // Apply all `setState`
    const layoutEffectsRequestRender = flushExecQueue();
    if (layoutEffectsRequestRender) {
      // cancel the setTimeout
      globalClearTimeout(effectTimer);
      // run effect synchronously
      ChildrenUtils.effects(rootInstance);
      // apply setState
      flushExecQueue();
      doRender();
    } else {
      // not setState in Layout effect
      stateSub.call();
      if (patchesQueue.length > 0) {
        const patches = patchesQueue;
        patchesQueue = [];
        patchesSub.call(patches);
      }
      return;
    }
  }

  function onIdle(exec: OnIdleExec) {
    if (destroyed) {
      throw new Error('Store destroyed');
    }
    if (rootInstance.isRendering()) {
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

  function requestRender(patch: Patch | null): void {
    if (patch) {
      patchesQueue.push(patch);
    }
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

  function scheduleEffects(): number {
    return globalSetTimeout(() => {
      ChildrenUtils.effects(rootInstance);
      const shouldRender = flushExecQueue();
      if (shouldRender) {
        doRender();
      }
    }, 0);
  }

  function applyPatches(patches: Patches) {
    rootInstance.onIdle(() => {
      patches.forEach(patch => {
        const instance = ChildrenUtils.access(rootInstance, patch.path);
        if (instance === null || instance.type !== 'CHILD' || instance.hooks === null) {
          return;
        }
        const hook = instance.hooks[patch.hookIndex];
        if (!hook || hook.type !== patch.type) {
          return;
        }
        // Should we use setValue / dispath ? If yes we need to prevent from re-emitting the patch
        // hook.setValue(patch.value)
        if (patch.type === 'STATE' && hook.type === 'STATE') {
          hook.value = patch.value;
        }
        if (patch.type === 'REDUCER' && hook.type === 'REDUCER') {
          hook.value = hook.reducer(hook.value, patch.action);
        }
        rootInstance.markDirty(instance);
        instance.root.requestRender(null);
      });
    });
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
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook === null) {
    const instance = root.getCurrentRenderingChildInstance();
    const hookIndex = root.getCurrentHookIndex();
    const path: TreeElementPath<'CHILD'> = { type: 'CHILD', hookIndex };
    const childrenTree = ChildrenUtils.mount(children, instance, path);
    root.setCurrentHook({
      type: 'CHILDREN',
      tree: childrenTree,
      path,
    });
    return childrenTree.value;
  }
  if (hook.type !== 'CHILDREN') {
    throw new Error('Invalid Hook type');
  }
  hook.tree = ChildrenUtils.update(hook.tree, children, hook.tree.parent, hook.path);
  root.setCurrentHook(hook);
  return hook.tree.value;
}

// overload where dispatch could accept 0 arguments.
export function useReducer<R extends ReducerWithoutAction<any>, I>(
  reducer: R,
  initializerArg: I,
  initializer: (arg: I) => ReducerStateWithoutAction<R>
): [ReducerStateWithoutAction<R>, DispatchWithoutAction];
// overload where dispatch could accept 0 arguments.
export function useReducer<R extends ReducerWithoutAction<any>>(
  reducer: R,
  initializerArg: ReducerStateWithoutAction<R>,
  initializer?: undefined
): [ReducerStateWithoutAction<R>, DispatchWithoutAction];
// overload where "I" may be a subset of ReducerState<R>; used to provide autocompletion.
// If "I" matches ReducerState<R> exactly then the last overload will allow initializer to be ommitted.
// the last overload effectively behaves as if the identity function (x => x) is the initializer.
export function useReducer<R extends Reducer<any, any>, I>(
  reducer: R,
  initializerArg: I & ReducerState<R>,
  initializer: (arg: I & ReducerState<R>) => ReducerState<R>
): [ReducerState<R>, Dispatch<ReducerAction<R>>];
// overload for free "I"; all goes as long as initializer converts it into "ReducerState<R>".
export function useReducer<R extends Reducer<any, any>, I>(
  reducer: R,
  initializerArg: I,
  initializer: (arg: I) => ReducerState<R>
): [ReducerState<R>, Dispatch<ReducerAction<R>>];
export function useReducer<R extends Reducer<any, any>>(
  reducer: R,
  initialState: ReducerState<R>,
  initializer?: undefined
): [ReducerState<R>, Dispatch<ReducerAction<R>>];
// implementation
export function useReducer(reducer: any, initialArg: any, init?: any): [any, Dispatch<any>] {
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook === null) {
    const instance = root.getCurrentRenderingChildInstance();
    let initialState;
    if (init !== undefined) {
      initialState = init(initialArg);
    } else {
      initialState = initialArg;
    }
    const hookIndex = root.getCurrentHookIndex();
    const value = initialState;
    const dispatch: Dispatch<any> = action => {
      if (instance.state === 'removed') {
        throw new Error(`Cannot dispatch on an unmounted component`);
      }
      instance.root.onIdle(() => {
        const nextValue = reducerHook.reducer(reducerHook.value, action);
        if (nextValue !== reducerHook.value) {
          const patch: ReducerPatch = {
            path: getPatchPath(instance),
            type: 'REDUCER',
            hookIndex,
            action,
          };
          reducerHook.value = nextValue;
          root.markDirty(instance);
          instance.root.requestRender(patch);
        }
      });
    };
    const reducerHook: ReducerHookData = { type: 'REDUCER', value, dispatch, reducer };
    root.setCurrentHook(reducerHook);
    return [value, dispatch];
  }
  if (hook.type !== 'REDUCER') {
    throw new Error('Invalid Hook type');
  }
  hook.reducer = reducer;
  root.setCurrentHook(hook);
  return [hook.value, hook.dispatch];
}

export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook === null) {
    const instance = root.getCurrentRenderingChildInstance();
    const hookIndex = root.getCurrentHookIndex();
    const value = typeof initialState === 'function' ? (initialState as any)() : initialState;
    const setValue: Dispatch<SetStateAction<S>> = value => {
      if (instance.state === 'removed') {
        throw new Error(`Cannot set state of an unmounted component`);
      }
      instance.root.onIdle(() => {
        const nextValue = typeof value === 'function' ? (value as any)(stateHook.value) : value;
        if (nextValue !== stateHook.value) {
          const patch: StatePatch = {
            path: getPatchPath(instance),
            type: 'STATE',
            hookIndex,
            value: nextValue,
          };
          stateHook.value = nextValue;
          root.markDirty(instance);
          instance.root.requestRender(patch);
        }
      });
    };
    const stateHook: StateHookData = { type: 'STATE', value, setValue };
    root.setCurrentHook(stateHook);
    return [value, setValue];
  }
  if (hook.type !== 'STATE') {
    throw new Error('Invalid Hook type');
  }
  root.setCurrentHook(hook);
  return [hook.value, hook.setValue];
}

export function useEffect(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectInternal('EFFECT', effect, deps);
}

export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectInternal('LAYOUT_EFFECT', effect, deps);
}

function useEffectInternal(
  effecType: EffectType,
  effect: EffectCallback,
  deps?: DependencyList
): void {
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook === null) {
    const effectHook: EffectHookData | LayoutEffectHookData = {
      type: effecType,
      effect,
      cleanup: undefined,
      deps,
      dirty: true,
    };
    root.setCurrentHook(effectHook);
    return;
  }
  if (hook.type !== effecType) {
    throw new Error('Invalid Hook type');
  }
  if (depsChanged(hook.deps, deps)) {
    hook.effect = effect;
    hook.deps = deps;
    hook.dirty = true;
    root.setCurrentHook(hook);
    return;
  }
  // ignore this effect
  root.setCurrentHook(hook);
  return;
}

export function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T {
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook === null) {
    const memoHook: MemoHookData = {
      type: 'MEMO',
      value: factory(),
      deps,
    };
    root.setCurrentHook(memoHook);
    return memoHook.value;
  }
  if (hook.type !== 'MEMO') {
    throw new Error('Invalid Hook type');
  }
  if (depsChanged(hook.deps, deps)) {
    hook.deps = deps;
    hook.value = factory();
  }
  root.setCurrentHook(hook);
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
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook === null) {
    const memoHook: RefHookData = {
      type: 'REF',
      ref: {
        current: initialValue,
      },
    };
    root.setCurrentHook(memoHook);
    return memoHook.ref;
  }
  if (hook.type !== 'REF') {
    throw new Error('Invalid Hook type');
  }
  root.setCurrentHook(hook);
  return hook.ref;
}

function useContextInternal<C extends Context<any>>(
  context: C
): { found: C[typeof DEMOCRAT_CONTEXT]['defaultValue']; value: any } {
  const root = getCurrentRootInstance();
  const hook = root.getCurrentHook();
  if (hook !== null) {
    if (hook.type !== 'CONTEXT') {
      throw new Error('Invalid Hook type');
    }
  }
  // TODO: move provider and value resolution to the instance level
  const provider = root.findProvider(context);
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
  root.setCurrentHook(contextHook);
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
