import React from '../src';

(window as any).Democrat = React;

const Counter = ({ index }: { index: number }) => {
  const [count, setCounter] = React.useState(0);

  console.log('Counter');

  const increment = React.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  React.useEffect(() => {
    console.log('effect', index, count);
    return () => {
      console.log('cleanup', index, count);
    };
  });

  return React.useMemo(
    () => ({
      increment,
      count,
    }),
    [increment, count]
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
    new Array(count).fill(null).map((_, index) => React.createElement(Counter, { index }))
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
