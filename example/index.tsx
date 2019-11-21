import React from '../src';

(window as any).Democrat = React;

const Counter = ({ parentCount }: { parentCount: number }) => {
  const [count, setCounter] = React.useState(0);

  console.log('Counter');

  const increment = React.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  React.useLayoutEffect(() => {
    // increment();
    return () => {
      console.log('cleanup from Counter layout effect');
    };
  });

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
  const [count, setCounter] = React.useState(3);

  const increment = React.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  const decrement = React.useCallback(() => {
    setCounter(prev => prev - 1);
  }, []);

  const counters = React.useChildren(
    new Array(count).fill(null).map(() => React.createElement(Counter, { parentCount: 0 }))
  );

  return React.useMemo(
    () => ({
      count,
      increment,
      decrement,
      counters,
    }),
    [count, increment, decrement, counters]
  );
};

const store = React.render(AppStore, {});
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
