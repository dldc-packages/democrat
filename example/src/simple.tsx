import { useState, useCallback, useMemo, createFactory, createStore } from '../../src';

const Store = createFactory(() => {
  const [count, setCount] = useState(0);

  const increment = useCallback(() => setCount(prev => prev + 1), []);
  const decrement = useCallback(() => setCount(prev => prev - 1), []);

  const result = useMemo(
    () => ({
      count,
      increment,
      decrement,
    }),
    [count, increment, decrement]
  );

  return result;
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
