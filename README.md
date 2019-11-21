<p align="center">
  <img src="https://github.com/etienne-dldc/democrat/blob/master/design/logo.svg" width="597" alt="tumau logo">
</p>

# 📜 democrat

> React, but for state management !

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
