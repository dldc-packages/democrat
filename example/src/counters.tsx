import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createStore,
  useChildren,
  createComponent,
} from '../../src';

const Counter = createComponent(({ index }: { index: number }) => {
  const [count, setCounter] = useState(0);

  const increment = useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  useEffect(() => {
    console.log(`Counter ${index} effect`);
    return () => {
      console.log(`Counter ${index} cleanup`);
    };
  });

  useEffect(() => {
    console.log(`Mount Counter ${index}`);
    return () => {
      console.log(`Unmount Counter ${index}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      increment,
      count,
    }),
    [increment, count]
  );
});

const AppStore = createComponent(() => {
  const [count, setCounter] = useState(3);

  const increment = useCallback(() => {
    setCounter(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCounter(prev => prev - 1);
  }, []);

  const counters = useChildren(
    new Array(count).fill(null).map((_, index) => Counter.createElement({ index }))
  );

  return useMemo(
    () => ({
      count,
      increment,
      decrement,
      counters,
    }),
    [count, increment, decrement, counters]
  );
});

function runExample() {
  const store = createStore(AppStore.createElement());

  const render = () => {
    const state = store.getState();
    (window as any).state = state;
    console.log('State:');
    console.log(state);
  };

  store.subscribe(render);
  store.subscribePatches(patches => {
    console.log('Patches:');
    console.log(patches);
  });

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
