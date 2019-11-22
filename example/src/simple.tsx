import Democrat from '../../src';

const Store = () => {
  const [count, setCount] = Democrat.useState(0);

  const increment = Democrat.useCallback(() => setCount(prev => prev + 1), []);
  const decrement = Democrat.useCallback(() => setCount(prev => prev - 1), []);

  const result = Democrat.useMemo(
    () => ({
      count,
      increment,
      decrement,
    }),
    [count, increment, decrement]
  );

  return result;
};

function runExample() {
  const store = Democrat.render(Democrat.createElement(Store));

  const render = () => {
    console.log(store.getState());
  };

  store.subscribe(render);

  render();

  return () => store.destroy();
}

export default runExample;
