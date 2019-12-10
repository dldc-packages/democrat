// by importing as React we get eslint hook plugin working for free !
import * as React from '../../src';

const Counter = ({ index }: { index: number }) => {
  const [count, setCounter] = React.useState(0);

  const increment = React.useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  React.useEffect(() => {
    console.log(`Counter ${index} effect`);
    return () => {
      console.log(`Counter ${index} cleanup`);
    };
  });

  React.useEffect(() => {
    console.log(`Mount Counter ${index}`);
    return () => {
      console.log(`Unmount Counter ${index}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

function runExample() {
  const store = React.render(React.createElement(AppStore));

  const render = () => {
    const state = store.getState();
    (window as any).state = state;
    console.log(state);
  };

  store.subscribe(render);

  render();

  document.getElementById('app')!.innerText = 'Open the console';

  window.setTimeout(() => {
    console.log(
      [
        'try one of the following',
        '',
        '- state.increment()',
        `- state.counters[0].increment()`,
        '- state.decrement()',
      ].join('\n')
    );
  }, 0);

  return () => store.destroy();
}

export default runExample;
