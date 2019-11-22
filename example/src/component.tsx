import Democrat from '../../src';

const Counter = () => {
  const [count, setCount] = Democrat.useState(1);

  const increment = Democrat.useCallback(() => setCount(prev => prev + 1), []);

  const result = Democrat.useMemo(
    () => ({
      count,
      increment,
    }),
    [count, increment]
  );

  return result;
};

const Store = () => {
  const counter = Democrat.useChildren(Democrat.createElement(Counter));
  const countersObject = Democrat.useChildren({
    counterA: Democrat.createElement(Counter),
    counterB: Democrat.createElement(Counter),
  });
  const countersArray = Democrat.useChildren(
    // create as many counters as `count`
    Array(counter.count)
      .fill(null)
      .map(() => Democrat.createElement(Counter))
  );

  return Democrat.useMemo(
    () => ({
      counter,
      countersObject,
      countersArray,
    }),
    [counter, countersObject, countersArray]
  );
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
