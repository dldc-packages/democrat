import { Store } from '../src';

export function waitForNextState<T>(store: Store<T>): Promise<T> {
  return new Promise(res => {
    const unsub = store.subscribe(() => {
      unsub();
      res(store.getState());
    });
  });
}

export function waitForNextTick(): Promise<void> {
  return new Promise(res => {
    setTimeout(() => {
      res();
    }, 0);
  });
}
