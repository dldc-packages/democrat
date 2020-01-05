import * as Democrat from '../src';
import { waitForNextState, waitForNextTick } from './utils';

test('basic count state', async () => {
  expect.assertions(2);
  const Counter = () => {
    const [count, setCount] = Democrat.useState(0);
    return {
      count,
      setCount,
    };
  };
  const store = Democrat.render(Democrat.createElement(Counter));
  expect(store.getState().count).toEqual(0);
  store.getState().setCount(42);
  expect((await waitForNextState(store)).count).toEqual(42);
});

test('set two states', async () => {
  expect.assertions(3);
  const render = jest.fn();
  const Counter = () => {
    render();
    const [countA, setCountA] = Democrat.useState(0);
    const [countB, setCountB] = Democrat.useState(0);
    const setCount = Democrat.useCallback((v: number) => {
      setCountA(v);
      setCountB(v);
    }, []);

    console.log({ countA, countB });

    return {
      count: countA + countB,
      setCount,
    };
  };
  const store = Democrat.render(Democrat.createElement(Counter));
  expect(store.getState().count).toEqual(0);
  store.getState().setCount(1);
  await waitForNextState(store);
  expect(render).toHaveBeenCalledTimes(2);
  expect(store.getState().count).toEqual(2);
});

test('effects runs', async () => {
  const onLayoutEffect = jest.fn();
  const onEffect = jest.fn();

  const Counter = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useLayoutEffect(() => {
      onLayoutEffect();
    }, [count]);

    Democrat.useEffect(() => {
      onEffect();
    }, [count]);

    return {
      count,
      setCount,
    };
  };
  Democrat.render(Democrat.createElement(Counter));
  await waitForNextTick();
  expect(onLayoutEffect).toHaveBeenCalled();
  expect(onEffect).toHaveBeenCalled();
});

test('use effect when re-render', async () => {
  const onUseEffect = jest.fn();
  const Counter = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useEffect(() => {
      onUseEffect();
      if (count === 0) {
        setCount(42);
      }
    }, [count]);

    return {
      count,
      setCount,
    };
  };

  const store = Democrat.render(Democrat.createElement(Counter));
  await waitForNextState(store);
  expect(onUseEffect).toHaveBeenCalledTimes(1);
  expect(store.getState().count).toBe(42);
  await waitForNextTick();
  expect(onUseEffect).toHaveBeenCalledTimes(2);
});

test('multiple counters (array children)', async () => {
  const Counter = () => {
    const [count, setCount] = Democrat.useState(0);
    return {
      count,
      setCount,
    };
  };
  const Counters = () => {
    const [numberOfCounter, setNumberOfCounter] = Democrat.useState(3);

    const counters = Democrat.useChildren(
      new Array(numberOfCounter).fill(null).map(() => Democrat.createElement(Counter))
    );

    const addCounter = Democrat.useCallback(() => {
      setNumberOfCounter(v => v + 1);
    }, []);

    return {
      counters,
      addCounter,
    };
  };

  const store = Democrat.render(Democrat.createElement(Counters));
  expect(store.getState()).toMatchInlineSnapshot(`
    Object {
      "addCounter": [Function],
      "counters": Array [
        Object {
          "count": 0,
          "setCount": [Function],
        },
        Object {
          "count": 0,
          "setCount": [Function],
        },
        Object {
          "count": 0,
          "setCount": [Function],
        },
      ],
    }
  `);
  expect(store.getState().counters.length).toBe(3);
  expect(store.getState().counters[0].count).toBe(0);
  store.getState().counters[0].setCount(1);
  await waitForNextState(store);
  expect(store.getState().counters[0].count).toBe(1);
  store.getState().addCounter();
  await waitForNextState(store);
  expect(store.getState().counters.length).toEqual(4);
  expect(store.getState().counters[3].count).toBe(0);
});

test('multiple counters (object children)', () => {
  const Counter = ({ initialCount = 0 }: { initialCount?: number }) => {
    const [count, setCount] = Democrat.useState(initialCount);

    return {
      count,
      setCount,
    };
  };
  const Counters = () => {
    const counters = Democrat.useChildren({
      counterA: Democrat.createElement(Counter, { initialCount: 2 }),
      counterB: Democrat.createElement(Counter),
    });

    const sum = counters.counterA.count + counters.counterB.count;

    return { counters, sum };
  };

  const store = Democrat.render(Democrat.createElement(Counters));
  expect(store.getState()).toMatchInlineSnapshot(`
    Object {
      "counters": Object {
        "counterA": Object {
          "count": 2,
          "setCount": [Function],
        },
        "counterB": Object {
          "count": 0,
          "setCount": [Function],
        },
      },
      "sum": 2,
    }
  `);
});

test('render a context', async () => {
  const NumCtx = Democrat.createContext<number>(10);

  const Store = () => {
    const num = Democrat.useContext(NumCtx);
    const [count, setCount] = Democrat.useState(0);

    return {
      count: count + num,
      setCount,
    };
  };
  const store = Democrat.render(
    Democrat.createElement(NumCtx.Provider, {
      value: 42,
      children: Democrat.createElement(Store),
    })
  );
  expect(store.getState().count).toEqual(42);
  store.getState().setCount(1);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(43);
});

test('render a context and update it', async () => {
  const NumCtx = Democrat.createContext<number>(10);

  const Child = () => {
    const num = Democrat.useContext(NumCtx);
    const [count, setCount] = Democrat.useState(0);

    return {
      count: count + num,
      setCount,
    };
  };

  const Parent = () => {
    const [num, setNum] = Democrat.useState(0);

    const { count, setCount } = Democrat.useChildren(
      Democrat.createElement(NumCtx.Provider, {
        value: num,
        children: Democrat.createElement(Child),
      })
    );

    return {
      count,
      setCount,
      setNum,
    };
  };

  const store = Democrat.render(Democrat.createElement(Parent));
  expect(store.getState().count).toEqual(0);
  store.getState().setCount(1);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(1);
  store.getState().setNum(1);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(2);
});

test('conditionnaly use a children', async () => {
  const Child = () => {
    return 42;
  };

  const Store = () => {
    const [show, setShow] = Democrat.useState(false);

    const child = Democrat.useChildren(show ? Democrat.createElement(Child) : null);

    return Democrat.useMemo(
      () => ({
        setShow,
        child,
      }),
      [setShow, child]
    );
  };
  const store = Democrat.render(Democrat.createElement(Store));
  expect(store.getState().child).toEqual(null);
  store.getState().setShow(true);
  await waitForNextState(store);
  expect(store.getState().child).toEqual(42);
});

test('array of children', async () => {
  const Child = ({ val }: { val: number }) => {
    return val * 2;
  };

  const Store = () => {
    const [items, setItems] = Democrat.useState([23, 5, 7]);

    const addItem = Democrat.useCallback((item: number) => {
      setItems(prev => [...prev, item]);
    }, []);

    const child = Democrat.useChildren(items.map(v => Democrat.createElement(Child, { val: v })));

    return Democrat.useMemo(
      () => ({
        addItem,
        child,
      }),
      [addItem, child]
    );
  };
  const store = Democrat.render(Democrat.createElement(Store));
  expect(store.getState().child).toEqual([46, 10, 14]);
  store.getState().addItem(6);
  await waitForNextState(store);
  expect(store.getState().child).toEqual([46, 10, 14, 12]);
});

test('array of children with keys', async () => {
  const Child = ({ val }: { val: number }) => {
    return val * 2;
  };

  const Store = () => {
    const [items, setItems] = Democrat.useState([23, 5, 7]);

    const addItem = Democrat.useCallback((item: number) => {
      setItems(prev => [item, ...prev]);
    }, []);

    const child = Democrat.useChildren(
      items.map(v => Democrat.createElement(Child, { key: v, val: v }))
    );

    return Democrat.useMemo(
      () => ({
        addItem,
        child,
      }),
      [addItem, child]
    );
  };
  const store = Democrat.render(Democrat.createElement(Store));
  expect(store.getState().child).toEqual([46, 10, 14]);
  store.getState().addItem(6);
  await waitForNextState(store);
  expect(store.getState().child).toEqual([12, 46, 10, 14]);
});
