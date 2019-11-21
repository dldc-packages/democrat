import Democrat from '../src';
import React from '../src';

(window as any).Democrat = Democrat;

const Counter = ({ parentCount }: { parentCount: number }) => {
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
  const [count, setCounter] = Democrat.useState(2);

  const increment = Democrat.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  const counters = Democrat.useChildren(
    new Array(count).fill(null).map(() => Democrat.createElement(Counter, { parentCount: 0 }))
  );

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
    // console.log(
    //   Object.keys(state).reduce((acc, key) => {
    //     acc[key] = prevState[key] === state[key];
    //     return acc;
    //   }, {} as any)
    // );
    // console.log(
    //   Object.keys(state.counters).reduce((acc, key) => {
    //     acc[key] = prevState.counters[key] === state.counters[key];
    //     return acc;
    //   }, {} as any)
    // );
  }
  prevState = state;
  (window as any).state = state;
  console.log(state);
};

store.subscribe(render);

render();
