import { InternalState } from './types';

const INTERNAL_STATE: InternalState = {
  rendering: null,
  effects: null,
  reactHooksSupported: false,
};

export function getInternalState() {
  return INTERNAL_STATE;
}
