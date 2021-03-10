/* eslint-disable react-hooks/exhaustive-deps */
import {
  createStore,
  createComponent,
  useState,
  useEffect,
  useLayoutEffect,
  useChildren,
} from '../../src';

let logCount = 0;
const log = (...vals) => console.log(logCount++, ...vals);

// type CounterResult = { value: number; increment: () => void };

let nextNum = 0;

const Counter = createComponent(() => {
  const [count, setCounter] = useState(0);

  const num = nextNum++;

  log('Child: render', num);

  window.setTimeout(() => {
    log('Child: timeout', num);
  }, 0);

  Promise.resolve().then(() => {
    log('Child: promise', num);
  });

  useEffect(() => {
    log('Child: effect', num);
  });

  useLayoutEffect(() => {
    log('Child: layout effect', num);
  });

  useLayoutEffect(() => {
    log('Child: mount');
  }, []);

  useLayoutEffect(() => {
    log('Child: setCounter useLayoutEffect', count);
    setCounter(1);
  }, []);

  return null;
});

const AppStore = createComponent(() => {
  const [count, setCounter] = useState(0);

  log('App: render', count, typeof setCounter);

  setTimeout(() => {
    log('App: timeout', count);
  }, 0);

  Promise.resolve().then(() => {
    log('App: promise', count);
  });

  useEffect(() => {
    log('App: effect', count);
  });

  useLayoutEffect(() => {
    log('App: layout effect', count);
  });

  useLayoutEffect(() => {
    log('App: useLayoutEffect setCounter', count);
    setCounter(1);
  }, []);

  useEffect(() => {
    log('App: useEffect setCounter', count);
    setCounter(2);
  }, []);

  useChildren(Counter.createElement());

  return {
    count,
  };
});

function runExample() {
  Promise.resolve().then(() => {
    log('render: promise');
  });

  const store = createStore(AppStore.createElement());

  return () => store.destroy();
}

export default runExample;
