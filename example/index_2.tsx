import Democrat from '../src';
import React from '../src';

(window as any).Democrat = Democrat;

const Counter = ({ parentCount }: { parentCount: number }) => {
  console.log('render Counter');
  const [count, setCounter] = Democrat.useState(0);

  const increment = Democrat.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  Democrat.useLayoutEffect(() => {
    increment();
  }, []);

  const total = count + parentCount;

  return React.useMemo(
    () => ({
      increment,
      count: total,
    }),
    [increment, total]
  );
};

const AppStore = () => {
  console.log('render AppStore');

  const [count, setCounter] = Democrat.useState(0);

  const increment = Democrat.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  const counters = Democrat.useChildren([
    Democrat.createElement(Counter, { parentCount: count }),
    Democrat.createElement(Counter, { parentCount: 0 }),
  ]);

  return Democrat.useMemo(
    () => ({
      count,
      increment,
      counters,
    }),
    [count, increment, counters]
  );
};

const store = Democrat.render(AppStore, {});
(window as any).store = store;

let prevState: any = null;

const render = () => {
  const state = store.getState();
  if (prevState) {
    console.log(
      Object.keys(state).reduce((acc, key) => {
        acc[key] = prevState[key] === state[key];
        return acc;
      }, {} as any)
    );
    console.log(
      Object.keys(state.counters).reduce((acc, key) => {
        acc[key] = prevState.counters[key] === state.counters[key];
        return acc;
      }, {} as any)
    );
  }
  prevState = state;
  (window as any).state = state;
  console.log(state);
};

store.subscribe(render);

render();
