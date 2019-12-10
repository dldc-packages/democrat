import * as Democrat from '../../src';

let logCount = 0;
const log = (...vals) => console.log(logCount++, ...vals);

// type CounterResult = { value: number; increment: () => void };

let nextNum = 0;

const Counter: Democrat.Component<{}, null> = () => {
  const [count, setCounter] = Democrat.useState(0);

  const num = nextNum++;

  log('Child: render', num);

  window.setTimeout(() => {
    log('Child: timeout', num);
  }, 0);

  Promise.resolve().then(() => {
    log('Child: promise', num);
  });

  Democrat.useEffect(() => {
    log('Child: effect', num);
  });

  Democrat.useLayoutEffect(() => {
    log('Child: layout effect', num);
  });

  Democrat.useLayoutEffect(() => {
    log('Child: mount');
  }, []);

  Democrat.useLayoutEffect(() => {
    log('Child: setCounter useLayoutEffect', count);
    setCounter(1);
  }, []);

  return null;
};

const AppStore: Democrat.Component<{}, { count: number }> = () => {
  const [count, setCounter] = Democrat.useState(0);

  log('App: render', count, typeof setCounter);

  setTimeout(() => {
    log('App: timeout', count);
  }, 0);

  Promise.resolve().then(() => {
    log('App: promise', count);
  });

  Democrat.useEffect(() => {
    log('App: effect', count);
  });

  Democrat.useLayoutEffect(() => {
    log('App: layout effect', count);
  });

  Democrat.useLayoutEffect(() => {
    log('App: useLayoutEffect setCounter', count);
    setCounter(1);
  }, []);

  Democrat.useEffect(() => {
    log('App: useEffect setCounter', count);
    setCounter(2);
  }, []);

  Democrat.useChildren(Democrat.createElement(Counter, {}));

  return {
    count,
  };
};

function runExample() {
  Promise.resolve().then(() => {
    log('render: promise');
  });

  const store = Democrat.render(Democrat.createElement(AppStore));

  return () => store.destroy();
}

export default runExample;
