// by importing as React we get eslint hook plugin working for free !
import React from '../../src';

const Counter = ({ index }: { index: number }) => {
  const [count, setCounter] = React.useState(0);

  const increment = React.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  React.useEffect(() => {
    console.log('Counter effect');
    return () => {
      console.log('Couter cleanup');
    };
  });

  return React.useMemo(
    () => ({
      increment,
      count,
    }),
    [increment, count]
  );
};

const AppStore = () => {
  const [count, setCounter] = React.useState(3);

  const increment = React.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  const decrement = React.useCallback(() => {
    setCounter(prev => prev - 1);
  }, []);

  const counters = React.useChildren(
    new Array(count).fill(null).map((_, index) => React.createElement(Counter, { index }))
  );

  return React.useMemo(
    () => ({
      count,
      increment,
      decrement,
      counters,
    }),
    [count, increment, decrement, counters]
  );
};

const store = React.render(AppStore, {});

const render = () => {
  const state = store.getState();
  (window as any).state = state;
  console.log(state);
};

store.subscribe(render);

render();

document.getElementById('root')!.innerText = 'Open the console';

window.setTimeout(() => {
  console.log(
    [
      'try one of the following',
      '',
      '- state.increment()',
      `- state.counters[0].increment()`,
      '- state.idecrement()',
    ].join('\n')
  );
}, 0);
