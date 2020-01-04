import { InternalState, TreeElement, HooksData } from './types';

const INTERNAL_STATE: InternalState = {
  rendering: null,
  effects: null,
  reactHooksSupported: false,
};

export function getInternalState() {
  return INTERNAL_STATE;
}

export function withGlobalRenderingInstance<T>(current: TreeElement, exec: () => T): T {
  if (getInternalState().rendering !== current.parent) {
    throw new Error('Invalid parent !');
  }
  getInternalState().rendering = current;
  const result = exec();
  getInternalState().rendering = current.parent;
  return result;
}

export function withGlobaleEffectsInstance(current: TreeElement, exec: () => void) {
  if (getInternalState().effects !== current.parent) {
    throw new Error('Invalid parent !');
  }
  getInternalState().effects = current;
  exec();
  getInternalState().effects = current.parent;
}

export function getCurrentChildInstance(): TreeElement<'CHILD'> {
  const tree = getInternalState().rendering;
  if (tree === null || tree.type !== 'CHILD') {
    throw new Error(`Hooks used outside of render !`);
  }
  return tree;
}

export function getCurrentHook(): HooksData | null {
  const instance = getCurrentChildInstance();
  if (instance.hooks && instance.hooks.length > 0) {
    return instance.hooks[instance.nextHooks.length] || null;
  }
  return null;
}

export function setCurrentHook(hook: HooksData) {
  const instance = getCurrentChildInstance();
  instance.nextHooks.push(hook);
}
