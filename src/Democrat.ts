import { SubscribeMethod, Subscription } from 'suub';

export type Dispatch<A> = (value: A) => void;
export type SetStateAction<S> = S | ((prevState: S) => S);
export type DependencyList = ReadonlyArray<any>;
export type EffectCleanup = () => void | undefined;
export type EffectCallback = () => void | EffectCleanup;
// interface MutableRefObject<T> {
//   current: T;
// }

export interface Store<S> {
  getState: () => S;
  subscribe: SubscribeMethod<void>;
}

let nextInstanceId = 0;

const DEMOCRAT_INTERNAL_STATE = Symbol('DEMOCRAT_INTERNAL_STATE');
const DEMOCRAT_ELEMENT = Symbol('DEMOCRAT_ELEMENT');

interface Element<P, T> {
  [DEMOCRAT_ELEMENT]: true;
  component: Component<P, T>;
  props: P;
}

interface StateHookData {
  type: 'STATE';
  value: any;
  setValue: Dispatch<SetStateAction<any>>;
}

interface ChildrenHookData {
  type: 'CHILDREN';
  component: Component<any, any>;
  instance: Instance;
  props: any;
}

type EffectHookData = {
  type: 'EFFECT';
  effect: EffectCallback;
  cleanup: undefined | EffectCleanup;
  deps: DependencyList | undefined;
  dirty: boolean;
};

type LayoutEffectHookData = {
  type: 'LAYOUT_EFFECT';
  effect: EffectCallback;
  cleanup: undefined | EffectCleanup;
  deps: DependencyList | undefined;
  dirty: boolean;
};

type MemoHookData = {
  type: 'MEMO';
  value: any;
  deps: DependencyList | undefined;
};

type HooksData =
  | StateHookData
  | ChildrenHookData
  | EffectHookData
  | MemoHookData
  | LayoutEffectHookData;

type OnIdleExec = (render: () => void) => void;
type OnIdle = (exec: OnIdleExec) => void;

interface Instance {
  id: number;
  parent: null | Instance;
  hooks: Array<HooksData> | null;
  nextHooks: Array<HooksData>;
  onIdle: OnIdle;
}

type InternalState = {
  rendering: null | Instance;
  effects: null | Instance;
};

export type Component<P, S> = (props: P) => S;

const internalState: InternalState = {
  rendering: null,
  effects: null,
};

export const Democrat = {
  [DEMOCRAT_INTERNAL_STATE]: internalState,
  createElement,
  useChildren,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  render,
};

function createElement<P, T>(
  component: Component<P, T>,
  props: P
): Element<P, T> {
  return {
    [DEMOCRAT_ELEMENT]: true,
    component: component,
    props,
  };
}

function render<P, T>(component: Component<P, T>, props: P): Store<T> {
  const sub = Subscription.create();
  let state: T;
  let execQueue: null | Array<OnIdleExec> = null;

  const rootInstance: Instance = {
    id: nextInstanceId++,
    parent: null,
    hooks: null,
    nextHooks: [],
    onIdle,
  };

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

  function onIdle(exec: OnIdleExec) {
    if (Democrat[DEMOCRAT_INTERNAL_STATE].rendering !== null) {
      throw new Error(`Cannot setState during render !`);
    }
    if (Democrat[DEMOCRAT_INTERNAL_STATE].effects === null) {
      exec(() => {
        execute();
      });
      return;
    }
    if (execQueue === null) {
      execQueue = [exec];
      // Promise.resolve().then(() => {
      //   flushExecQueue();
      // });
      return;
    }
    execQueue.push(exec);
  }

  function scheduleEffects(effectsSync: boolean): number {
    return window.setTimeout(() => {
      executeEffect(rootInstance, 'EFFECT');
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
      state = renderComponent(component, props, rootInstance, null);
    } else {
      state = renderComponent(component, props, rootInstance, null);
      effectTimer = scheduleEffects(effectsSync);
    }
    executeEffect(rootInstance, 'LAYOUT_EFFECT');
    const shouldRunEffectsSync = flushExecQueue();
    if (shouldRunEffectsSync || effectsSync) {
      if (effectTimer) {
        window.clearTimeout(effectTimer);
      }
      executeEffect(rootInstance, 'EFFECT');
      const effectRequestRender = flushExecQueue();
      if (shouldRunEffectsSync) {
        execute(effectsSync, true);
      } else if (effectsSync && effectRequestRender) {
        execute(true, true);
      }
    }

    // if (execQueue === null) {
    //   sub.call();
    // }
  }

  execute();

  return {
    getState: () => state,
    subscribe: sub.subscribe,
  };
}

function runEffectsOfInstance(
  instance: Instance,
  type: 'EFFECT' | 'LAYOUT_EFFECT'
) {
  if (instance.hooks) {
    instance.hooks.forEach(hook => {
      if (hook.type === 'CHILDREN') {
        runEffectsOfInstance(hook.instance, type);
      }
    });
    instance.hooks.forEach(hook => {
      if (hook.type === type) {
        if (hook.dirty) {
          hook.dirty = false;
          if (hook.cleanup) {
            hook.cleanup();
          }
          hook.cleanup = hook.effect() || undefined;
        }
      }
    });
  }
}

function executeEffect(instance: Instance, type: 'EFFECT' | 'LAYOUT_EFFECT') {
  if (Democrat[DEMOCRAT_INTERNAL_STATE].effects !== null) {
    throw new Error('Already executing effects');
  }
  Democrat[DEMOCRAT_INTERNAL_STATE].effects = instance;
  // loop to run layoutEffects
  runEffectsOfInstance(instance, type);
  Democrat[DEMOCRAT_INTERNAL_STATE].effects = null;
}

function beforeRender(instance: Instance) {
  instance.nextHooks = [];
}

function afterRender(instance: Instance) {
  if (instance.hooks) {
    // not first render
    if (instance.hooks.length !== instance.nextHooks.length) {
      throw new Error('Hooks count mismatch !');
    }
  }
  const hooks = instance.nextHooks;
  instance.hooks = hooks;
}

function withRenderingInstanceState<T>(
  current: Instance,
  exec: () => T,
  expectedParent: Instance | null
): T {
  if (Democrat[DEMOCRAT_INTERNAL_STATE].rendering !== expectedParent) {
    throw new Error('Invalid parent !');
  }
  Democrat[DEMOCRAT_INTERNAL_STATE].rendering = current;
  const result = exec();
  Democrat[DEMOCRAT_INTERNAL_STATE].rendering = expectedParent;
  return result;
}

function renderComponent<P, T>(
  component: Component<P, T>,
  props: P,
  instance: Instance,
  parent: Instance | null
): T {
  return withRenderingInstanceState(
    instance,
    () => {
      beforeRender(instance);
      const result = component(props);
      afterRender(instance);
      return result;
    },
    parent
  );
}

function getCurrentInstance(): Instance {
  const state = Democrat[DEMOCRAT_INTERNAL_STATE].rendering;
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

function useChildren<P, T>(elements: Element<P, T>): T {
  const hook = getCurrentHook();
  const parent = getCurrentInstance();
  if (hook === null) {
    const childInstance: Instance = {
      id: nextInstanceId++,
      parent,
      hooks: null,
      nextHooks: [],
      onIdle: parent.onIdle,
    };
    const result = renderComponent(
      elements.component,
      elements.props,
      childInstance,
      parent
    );
    setCurrentHook({
      type: 'CHILDREN',
      component: elements.component,
      instance: childInstance,
      props: elements.props,
    });
    return result;
  }
  if (hook.type !== 'CHILDREN') {
    throw new Error('Invalid Hook type');
  }
  if (hook.component !== elements.component) {
    throw new Error('Changing type is not supported yet');
  }
  // re-render
  // TODO: check props to skip render
  const result = renderComponent(
    elements.component,
    elements.props,
    hook.instance,
    parent
  );
  hook.props = elements.props;
  setCurrentHook(hook);
  return result;
}

function useState<S>(
  initialState: S | (() => S)
): [S, Dispatch<SetStateAction<S>>] {
  const hook = getCurrentHook();
  const instance = getCurrentInstance();
  if (hook === null) {
    const value =
      typeof initialState === 'function'
        ? (initialState as any)()
        : initialState;
    const setValue: Dispatch<SetStateAction<S>> = value => {
      instance.onIdle(render => {
        const nextValue =
          typeof value === 'function' ? (value as any)(stateHook.value) : value;
        if (nextValue !== stateHook.value) {
          stateHook.value = nextValue;
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

function depsChanged(
  deps1: DependencyList | undefined,
  deps2: DependencyList | undefined
): boolean {
  if (deps1 === undefined || deps2 === undefined) {
    return true;
  }
  if (deps1.length !== deps2.length) {
    return true;
  }
  for (let i = 0; i < deps1.length; i++) {
    const dep = deps1[i];
    if (!Object.is(dep, deps2[i])) {
      // guards changed
      return true;
    }
  }
  return false;
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

function useCallback<T extends (...args: any[]) => unknown>(
  callback: T,
  deps: DependencyList
): T {
  return Democrat.useMemo(() => callback, deps);
}

// function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {}

// useRef<T extends unknown>(initialValue: T): MutableRefObject<T>;
// useRef<T = undefined>(): MutableRefObject<T | undefined>;
// useContext<T>(context: Context<T>): T;
// useImperativeHandle<T, R extends T>(ref: Ref<T>|undefined, init: () => R, deps?: DependencyList): void;

// useDebugValue<T>(value: T, format?: (value: T) => any): void;
