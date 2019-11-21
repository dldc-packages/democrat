import { InternalState } from './types';

const INTERNAL_STATE: InternalState = {
  rendering: null,
  effects: null,
};

export function getInternalState() {
  return INTERNAL_STATE;
}
