import { createStore, useCallback, useChildren, useMemo, useState, createFactory } from '../../src';

const Counter = createFactory(() => {
  const [count, setCount] = useState(1);

  const increment = useCallback(() => setCount(prev => prev + 1), []);

  const result = useMemo(
    () => ({
      count,
      increment,
    }),
    [count, increment]
  );

  return result;
});

const Store = createFactory(() => {
  const counter = useChildren(Counter.createElement());
  const countersObject = useChildren({
    counterA: Counter.createElement(),
    counterB: Counter.createElement(),
  });
  const countersArray = useChildren(
    // create as many counters as `count`
    Array(counter.count)
      .fill(null)
      .map(() => Counter.createElement())
  );

  return useMemo(
    () => ({
      counter,
      countersObject,
      countersArray,
    }),
    [counter, countersObject, countersArray]
  );
});

function runExample() {
  const store = createStore(Store.createElement());

  const render = () => {
    console.log(store.getState());
  };

  store.subscribe(render);

  render();

  return () => store.destroy();
}

export default runExample;
