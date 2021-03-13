import { Subscription, Unsubscribe } from 'suub';
import { ChildrenUtils } from './ChildrenUtils';
import { setCurrentRootInstance } from './Global';
import {
  globalSetTimeout,
  globalClearTimeout,
  createRootTreeElement,
  createElement,
} from './utils';
import {
  OnIdleExec,
  Children,
  ResolveType,
  DemocratRootElement,
  TreeElement,
  Patch,
  Patches,
  Snapshot,
  FunctionComponent,
  Factory,
  Key,
  FactoryInternal,
} from './types';
import { DEMOCRAT_COMPONENT, DEMOCRAT_ELEMENT, DEMOCRAT_ROOT } from './symbols';
import * as Hooks from './Hooks';
import { useChildren } from './Hooks';

export { isValidElement, createContext, createElement } from './utils';

export interface Store<S> {
  render: <C extends Children>(rootChildren: C) => void;
  getState: () => S;
  subscribe: (onChange: () => void) => Unsubscribe;
  destroy: () => void;
  // patches
  subscribePatches: (onPatches: (patches: Patches) => void) => Unsubscribe;
  applyPatches: (patches: Patches) => void;
  // snapshot
  getSnapshot: () => Snapshot;
}

export interface CreateStoreOptions {
  // pass an instance of React to override hooks
  ReactInstance?: null | any;
  // In passive mode, effect are never executed
  passiveMode?: boolean;
  // restore a snapshot
  snapshot?: Snapshot;
}

export function createFactory<Fn extends FunctionComponent<any, any>>(fn: Fn): FactoryInternal<Fn> {
  const fact: Factory<unknown, unknown> = {
    [DEMOCRAT_COMPONENT]: true,
    Component: fn,
    createElement: ((props: any, key: Key) => {
      return createElement(fn, props, key);
    }) as any,
    createElementTyped: (runner, key) => {
      return runner(props => createElement(fn, props, key)) as any;
    },
    useChildren: ((props: any, key: Key) => {
      return useChildren(createElement(fn, props, key));
    }) as any,
  };
  return fact as any;
}

export function createStore<C extends Children>(
  rootChildren: C,
  options: CreateStoreOptions = {}
): Store<ResolveType<C>> {
  const { ReactInstance = null, passiveMode = false, snapshot } = options;

  const stateSub = Subscription();
  const patchesSub = Subscription<Patches>();

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
    render,
    getState: () => state,
    subscribe: stateSub.subscribe,
    destroy,
    subscribePatches: patchesSub.subscribe,
    applyPatches,
    getSnapshot,
  };

  function render<C extends Children>(newRootChildren: C) {
    onIdle(() => {
      rootElem.children = newRootChildren;
      requestRender(null);
    });
  }

  function getSnapshot(): Snapshot {
    return ChildrenUtils.snapshot<'ROOT'>(rootInstance);
  }

  function doRender(): void {
    if (destroyed) {
      throw new Error('Store destroyed');
    }
    setCurrentRootInstance(rootInstance);
    if (rootInstance.mounted === false) {
      rootInstance = ChildrenUtils.mount(rootElem, rootInstance, null as any, snapshot) as any;
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
      stateSub.emit();
      if (patchesQueue.length > 0) {
        const patches = patchesQueue;
        patchesQueue = [];
        patchesSub.emit(patches);
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
