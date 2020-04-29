<p align="center">
  <img src="https://github.com/etienne-dldc/democrat/blob/master/design/logo.svg" width="597" alt="democrat logo">
</p>

# 📜 democrat

> React, but for state management !

Democrat is a library that mimic the API of React (Components, hooks, Context...) but instead of producing DOM mutation it produces a state tree.
You can then use this state tree as global state management system (like redux or mobx).

## Project Status

This project is still quite experimental and should not be considered stable !

## Install

```bash
npm install democrat
```

## Gist

```ts
import * as Democrat from 'democrat';

// Create a Democrat "component"
const MainStore = () => {
  // all your familair hooks are here
  const [count, setCount] = Democrat.useState(0);

  const increment = Democrat.useCallback(() => setCount(prev => prev + 1), []);

  // return your state at the end
  return {
    count,
    increment,
  };
};

// Render your component
const store = Democrat.render(Democrat.createElement(Store));
// subscribe to state update
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
  return { children: childData };
};
```

## `useChildren` supported data

React only supports `Array`, `string`, `number` and `booleans` in JSX.
`useChildren` supports the following data structure:

- `Array` (`[]`)
- `Object` (`{}`)
- `Map`

```ts
const Child = () => {
  return 42;
};

const Parent = () => {
  //...
  const childData = Democrat.useChildren({
    a: Democrat.createElement(Child),
    b: Democrat.createElement(Child),
  });
  // childData = { a: 42, b: 42 }
  //...
  return {};
};
```

## Using hooks library

Because Democrat's hooks works just like React's ones with a little trick you can use some of the React hook in Democrat.
All you need to do is pass an instance of `React` to the `Democrat.render` options.

```js
import React from 'react';
import { render } from 'democrat';

render(/*...*/, { ReactInstance: React });
```

For now only the following hooks are supported:

- `useState`
- `useReducer`
- `useEffect`
- `useMemo`
- `useCallback`
- `useLayoutEffect`
- `useRef`

**Note**: While `useContext` exists in Democrat we cannot use the React version of it because of how context works (we would need to also replace `createContext` but we have no way to detect when we should create a Democrat context vs when we should create a React context...).

## Components

```ts
import * as Democrat from 'democrat';

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
