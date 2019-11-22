<p align="center">
  <img src="https://github.com/etienne-dldc/democrat/blob/master/design/logo.svg" width="597" alt="democrat logo">
</p>

# 📜 democrat

> React, but for state management !

## Install

```bash
npm install democrat@next
```

**NOTE**: Make sure to install with the `@next` tag !

## Gist

```ts
import Democrat from 'democrat';

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

const store = Democrat.render(Democrat.createElement(Store));

const render = () => {
  console.log(store.getState());
};

store.subscribe(render);

render();
```

## Components

```ts
import Democrat from 'democrat';

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
```
