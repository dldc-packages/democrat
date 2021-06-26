import { TreeElement } from './types.js';

let GLOBAL_STATE: TreeElement<'ROOT'> | null = null;

export function getCurrentRootInstance(): TreeElement<'ROOT'> {
  if (GLOBAL_STATE === null) {
    throw new Error('Calling hook outside of component');
  }
  return GLOBAL_STATE;
}

export function setCurrentRootInstance(instance: TreeElement<'ROOT'> | null): void {
  GLOBAL_STATE = instance;
}
