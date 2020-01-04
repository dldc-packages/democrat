import * as Democrat from '../src';

test('basic count state', () => {
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
  expect(store.getState().count).toEqual(42);
});

test('multiple counters (array children)', () => {
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
  expect(store.getState().counters[0].count).toBe(1);
  store.getState().addCounter();
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

test('render a context', () => {
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
  expect(store.getState().count).toEqual(43);
});

test('render a context and update it', () => {
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
  expect(store.getState().count).toEqual(1);
  store.getState().setNum(1);
  expect(store.getState().count).toEqual(2);
});
