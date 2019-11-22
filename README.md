<p align="center">
  <img src="https://github.com/etienne-dldc/democrat/blob/master/design/logo.svg" width="597" alt="democrat logo">
</p>

# 📜 democrat

> React, but for state management !

## ⚠️⚠️ NOT TESTED ⚠️⚠️

This project is not tested yet and should not be considered stable !

## Install

```bash
npm install democrat
```

## Gist

```ts
import Democrat from 'democrat';

const MainStore = () => {
  const [count, setCount] = Democrat.useState(0);

  const increment = Democrat.useCallback(() => setCount(prev => prev + 1), []);

  return {
    count,
    increment,
  };
};

const store = Democrat.render(Democrat.createElement(Store));
store.subscribe(render);
render();

function render = () => {
  console.log(store.getState());
};
```

## How is this different from React ?

There are two main diffrences with React

### 1. Return value

With Democrat instead of JSX, you return data. More precisly, you return what you want to expose in your state.

### 2. `useChildren`

In React to use other component you have to return an element of it in your render. In Democrat you can't do that since what you return is your state. Instead you can use the `useChildren` hook.
The `useChildren` is very similar to when you return `<MyComponent />` in React:

- It will create a diff to define what to update/mount/unmount
- If props don't change it will not re-render but re-use the previous result instead
  But the difference is that you get the result of that children an can use it in the parent component.

```ts
const Child = () => {
  // ..
  return { some: 'data' };
};

const Parent = () => {
  //...
  const childData = Democrat.useChildren(Democrat.createElement(Child));
  // childData = { some: 'data' }
  //...
  return {};
};
```

## Using hooks library

Because Democrat's hooks works just like React's ones with a little trick you can use any React hook in Democrat.
All you need to do is add this code before the first `Democrat.render`.

```js
import React from 'react';
import Democrat from 'democrat';

Democrat.supportReactHooks(React);
```

Note that for now only the following hooks are supported:

- `useState`
- `useEffect`
- `useMemo`
- `useCallback`
- `useLayoutEffect`
- `useRef`

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
