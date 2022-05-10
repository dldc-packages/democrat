import * as Democrat from '../src/mod';
import { waitForNextState, waitForNextTick, mapMap, removeFunctionsDeep } from './utils';

test('basic count state', async () => {
  const onRender = jest.fn();
  const Counter = Democrat.createFactory(() => {
    onRender();
    const [count, setCount] = Democrat.useState(0);
    return {
      count,
      setCount,
    };
  });
  const store = Democrat.createStore(Counter.createElement());
  expect(store.getState().count).toEqual(0);
  await waitForNextTick();
  store.getState().setCount(42);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(42);
  expect(onRender).toHaveBeenCalledTimes(2);
});

test('generic component', async () => {
  const Counter = Democrat.createGenericFactory(function <R>(props: { val: R }): R {
    return props.val;
  });
  const store = Democrat.createStore(Counter.createElement((c) => c({ val: 42 })));
  expect(store.getState()).toEqual(42);
});

test('subscribe', async () => {
  const onRender = jest.fn();
  const Counter = Democrat.createFactory(() => {
    onRender();
    const [count, setCount] = Democrat.useState(0);

    return {
      count,
      setCount,
    };
  });
  const store = Democrat.createStore(Counter.createElement());
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().setCount(42);
  await waitForNextState(store);
  store.getState().setCount(0);
  await waitForNextState(store);
  expect(onState).toHaveBeenCalledTimes(2);
});

test('useReducer', async () => {
  type State = { count: number };
  type Action = { type: 'increment' } | { type: 'decrement' };

  const initialState: State = { count: 0 };

  function reducer(state: State, action: Action): State {
    switch (action.type) {
      case 'increment':
        return { count: state.count + 1 };
      case 'decrement':
        return { count: state.count - 1 };
      default:
        return state;
    }
  }
  const onRender = jest.fn();
  const Counter = Democrat.createFactory(() => {
    onRender();
    const [count, dispatch] = Democrat.useReducer(reducer, initialState);

    return {
      count,
      dispatch,
    };
  });
  const store = Democrat.createStore(Counter.createElement());
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().dispatch({ type: 'increment' });
  await waitForNextState(store);
  expect(store.getState().count).toEqual({ count: 1 });
  store.getState().dispatch({ type: 'decrement' });
  await waitForNextState(store);
  expect(store.getState().count).toEqual({ count: 0 });
  const prevState = store.getState().count;
  expect(onState).toHaveBeenCalledTimes(2);
  store.getState().dispatch({} as any);
  expect(store.getState().count).toBe(prevState);
});

test('subscribe wit useMemo', async () => {
  const onRender = jest.fn();
  const Counter = () => {
    onRender();
    const [count, setCount] = Democrat.useState(0);

    const result = Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );

    return result;
  };
  const store = Democrat.createStore(Democrat.createElement(Counter, {}));
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().setCount(42);
  await waitForNextState(store);
  store.getState().setCount(0);
  await waitForNextState(store);
  expect(onState).toHaveBeenCalledTimes(2);
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

    return {
      count: countA + countB,
      setCount,
    };
  };
  const store = Democrat.createStore(Democrat.createElement(Counter, {}));
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
  Democrat.createStore(Democrat.createElement(Counter, {}));
  await waitForNextTick();
  expect(onLayoutEffect).toHaveBeenCalled();
  expect(onEffect).toHaveBeenCalled();
});

test('effects cleanup runs', async () => {
  const onLayoutEffect = jest.fn();
  const onLayoutEffectCleanup = jest.fn();
  const onEffect = jest.fn();
  const onEffectCleanup = jest.fn();

  const Counter = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useLayoutEffect(() => {
      onLayoutEffect();
      return onLayoutEffectCleanup;
    }, [count]);

    Democrat.useEffect(() => {
      onEffect();
      return onEffectCleanup;
    }, [count]);

    return {
      count,
      setCount,
    };
  };
  const store = Democrat.createStore(Democrat.createElement(Counter, {}));
  await waitForNextTick();
  expect(onLayoutEffect).toBeCalledTimes(1);
  expect(onEffect).toBeCalledTimes(1);
  store.getState().setCount(42);
  await waitForNextState(store);
  await waitForNextTick();
  expect(onLayoutEffect).toBeCalledTimes(2);
  expect(onEffect).toBeCalledTimes(2);
  expect(onLayoutEffectCleanup).toHaveBeenCalled();
  expect(onEffectCleanup).toHaveBeenCalled();
});

test('runs cleanup only once', async () => {
  const onLayoutEffect = jest.fn();
  const onLayoutEffectCleanup = jest.fn();

  const Child = () => {
    Democrat.useLayoutEffect(() => {
      onLayoutEffect();
      return onLayoutEffectCleanup;
    }, []);
  };

  const Counter = () => {
    const [count, setCount] = Democrat.useState(0);

    const child = Democrat.useChildren(count < 10 ? Democrat.createElement(Child, {}) : null);

    return {
      child,
      count,
      setCount,
    };
  };
  const store = Democrat.createStore(Democrat.createElement(Counter, {}));
  await waitForNextTick();
  expect(onLayoutEffectCleanup).not.toHaveBeenCalled();
  expect(onLayoutEffect).toBeCalledTimes(1);
  // should unmount
  store.getState().setCount(12);
  await waitForNextState(store);
  expect(onLayoutEffectCleanup).toBeCalledTimes(1);
  expect(onLayoutEffect).toBeCalledTimes(1);
  // stay unmounted
  store.getState().setCount(13);
  await waitForNextState(store);
  expect(onLayoutEffectCleanup).toBeCalledTimes(1);
  expect(onLayoutEffect).toBeCalledTimes(1);
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

  const store = Democrat.createStore(Democrat.createElement(Counter, {}));
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
      new Array(numberOfCounter).fill(null).map(() => Democrat.createElement(Counter, {}))
    );

    const addCounter = Democrat.useCallback(() => {
      setNumberOfCounter((v) => v + 1);
    }, []);

    return {
      counters,
      addCounter,
    };
  };

  const store = Democrat.createStore(Democrat.createElement(Counters, {}));
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
      counterB: Democrat.createElement(Counter, {}),
    });

    const sum = counters.counterA.count + counters.counterB.count;

    return { counters, sum };
  };

  const store = Democrat.createStore(Democrat.createElement(Counters, {}));
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

test('multiple counters (object children update)', async () => {
  const Counter = ({ initialCount = 0 }: { initialCount?: number }) => {
    const [count, setCount] = Democrat.useState(initialCount);

    return {
      count,
      setCount,
    };
  };
  const Counters = () => {
    const [showCounterC, setShowCounterC] = Democrat.useState(false);

    const counters = Democrat.useChildren({
      counterA: Democrat.createElement(Counter, { initialCount: 2 }),
      counterB: Democrat.createElement(Counter, {}),
      counterC: showCounterC ? Democrat.createElement(Counter, {}) : null,
    });

    const sum = counters.counterA.count + counters.counterB.count;

    const toggle = Democrat.useCallback(() => setShowCounterC((prev) => !prev), []);

    return { counters, sum, toggle };
  };

  const store = Democrat.createStore(Democrat.createElement(Counters, {}));
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
        "counterC": null,
      },
      "sum": 2,
      "toggle": [Function],
    }
  `);
  store.getState().toggle();
  await waitForNextState(store);
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
      "counterC": Object {
        "count": 0,
        "setCount": [Function],
      },
    },
    "sum": 2,
    "toggle": [Function],
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
  const store = Democrat.createStore(
    Democrat.createElement(NumCtx.Provider, {
      value: 42,
      children: Democrat.createElement(Store, {}),
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
        children: Democrat.createElement(Child, {}),
      })
    );

    return {
      count,
      setCount,
      setNum,
    };
  };

  const store = Democrat.createStore(Democrat.createElement(Parent, {}));
  expect(store.getState().count).toEqual(0);
  store.getState().setCount(1);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(1);
  store.getState().setNum(1);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(2);
});

test('read a context with no provider', async () => {
  const NumCtx = Democrat.createContext<number>(10);

  const Store = () => {
    const num = Democrat.useContext(NumCtx);
    const [count, setCount] = Democrat.useState(0);

    return {
      count: count + num,
      setCount,
    };
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  expect(store.getState().count).toEqual(10);
});

test('conditionnaly use a children', async () => {
  const Child = () => {
    return 42;
  };

  const Store = () => {
    const [show, setShow] = Democrat.useState(false);

    const child = Democrat.useChildren(show ? Democrat.createElement(Child, {}) : null);

    return Democrat.useMemo(
      () => ({
        setShow,
        child,
      }),
      [setShow, child]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  expect(store.getState().child).toEqual(null);
  store.getState().setShow(true);
  await waitForNextState(store);
  expect(store.getState().child).toEqual(42);
});

test('render a children', async () => {
  const Child = () => {
    const [count, setCount] = Democrat.useState(0);
    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };

  const Store = () => {
    const [count, setCount] = Democrat.useState(0);
    const child = Democrat.useChildren(Democrat.createElement(Child, {}));
    return Democrat.useMemo(
      () => ({
        count,
        setCount,
        child,
      }),
      [count, setCount, child]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  expect(store.getState().child.count).toEqual(0);
  store.getState().child.setCount(42);
  await waitForNextState(store);
  expect(store.getState().child.count).toEqual(42);
});

test('subscribe when children change', async () => {
  const Child = () => {
    const [count, setCount] = Democrat.useState(0);
    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };

  const Store = () => {
    const [count, setCount] = Democrat.useState(0);
    const child = Democrat.useChildren(Democrat.createElement(Child, {}));
    return Democrat.useMemo(
      () => ({
        count,
        setCount,
        child,
      }),
      [count, setCount, child]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().child.setCount(42);
  await waitForNextState(store);
  store.getState().child.setCount(1);
  await waitForNextState(store);
  expect(store.getState().child.count).toEqual(1);
  expect(onState).toHaveBeenCalledTimes(2);
});

test('useLayoutEffect', async () => {
  const Store = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useLayoutEffect(() => {
      if (count !== 0) {
        setCount(0);
      }
    }, [count]);

    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().setCount(42);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(0);
  expect(onState).toHaveBeenCalledTimes(1);
});

test('useEffect in loop', async () => {
  const Store = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useEffect(() => {
      if (count !== 0) {
        setCount(count - 1);
      }
    }, [count]);

    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  const onState = jest.fn();
  store.subscribe(() => {
    onState(store.getState().count);
  });
  store.getState().setCount(3);
  await waitForNextState(store);
  await waitForNextState(store);
  await waitForNextState(store);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(0);
  expect(onState).toHaveBeenCalledTimes(4);
  expect(onState.mock.calls).toEqual([[3], [2], [1], [0]]);
});

test('useLayoutEffect in loop', async () => {
  const Store = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useLayoutEffect(() => {
      if (count !== 0) {
        setCount(count - 1);
      }
    }, [count]);

    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().setCount(3);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(0);
  expect(onState).toHaveBeenCalledTimes(1);
});

test('useLayoutEffect & useEffect in loop (should run useEffect sync)', async () => {
  const Store = () => {
    const [count, setCount] = Democrat.useState(0);

    Democrat.useLayoutEffect(() => {
      if (count !== 0) {
        setCount(count - 1);
      }
    }, [count]);

    Democrat.useEffect(() => {
      if (count !== 0) {
        setCount(count - 1);
      }
    }, [count]);

    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  const onState = jest.fn();
  store.subscribe(onState);
  store.getState().setCount(3);
  await waitForNextState(store);
  expect(store.getState().count).toEqual(0);
  expect(onState).toHaveBeenCalledTimes(1);
});

test('array of children', async () => {
  const Child = ({ val }: { val: number }) => {
    return val * 2;
  };

  const Store = () => {
    const [items, setItems] = Democrat.useState([23, 5, 7]);

    const addItem = Democrat.useCallback((item: number) => {
      setItems((prev) => [...prev, item]);
    }, []);

    const child = Democrat.useChildren(items.map((v) => Democrat.createElement(Child, { val: v })));

    return Democrat.useMemo(
      () => ({
        addItem,
        child,
      }),
      [addItem, child]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
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
      setItems((prev) => [item, ...prev]);
    }, []);

    const child = Democrat.useChildren(
      items.map((v) => Democrat.createElement(Child, { val: v }, v))
    );

    return Democrat.useMemo(
      () => ({
        addItem,
        child,
      }),
      [addItem, child]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  expect(store.getState().child).toEqual([46, 10, 14]);
  store.getState().addItem(6);
  await waitForNextState(store);
  expect(store.getState().child).toEqual([12, 46, 10, 14]);
});

test('remove key of array child', async () => {
  const onRender = jest.fn();

  const Child = () => {
    return Math.random();
  };

  const Store = () => {
    onRender();
    const [withKey, setWithKey] = Democrat.useState(true);

    const child = Democrat.useChildren([
      withKey ? Democrat.createElement(Child, {}, 42) : Democrat.createElement(Child, {}),
    ]);

    return Democrat.useMemo(
      () => ({
        setWithKey,
        child,
      }),
      [setWithKey, child]
    );
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  const out1 = store.getState().child[0];
  await waitForNextTick();
  store.getState().setWithKey(false);
  await waitForNextState(store);
  expect(onRender).toHaveBeenCalledTimes(2);
  const out2 = store.getState().child[0];
  expect(out2).not.toEqual(out1);
});

test('render an array as root', () => {
  const Child = () => {
    return 42;
  };
  expect(() =>
    Democrat.createStore([Democrat.createElement(Child, {}), Democrat.createElement(Child, {})])
  ).not.toThrow();
  const store = Democrat.createStore([
    Democrat.createElement(Child, {}),
    Democrat.createElement(Child, {}),
  ]);
  expect(store.getState()).toEqual([42, 42]);
});

test('throw when render invalid element', () => {
  expect(() => Democrat.createStore(new Date() as any)).toThrow('Invalid children type');
});

test('throw when render a Set', () => {
  expect(() => Democrat.createStore(new Set() as any)).toThrow('Set are not supported');
});

test('render a Map', () => {
  expect(() => Democrat.createStore(new Map())).not.toThrow();
});

test('update a Map', async () => {
  const Child = () => {
    const [count, setCount] = Democrat.useState(0);

    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };

  const Store = () => {
    const [ids, setIds] = Democrat.useState<Map<string, null>>(new Map());

    const children = Democrat.useChildren(mapMap(ids, () => Democrat.createElement(Child, {})));

    const addChild = Democrat.useCallback((id: string) => {
      setIds((prev) => {
        const next = mapMap(prev, (v) => v);
        next.set(id, null);
        return next;
      });
    }, []);

    const removeChild = Democrat.useCallback((id: string) => {
      setIds((prev) => {
        const next = mapMap(prev, (v) => v);
        next.delete(id);
        return next;
      });
    }, []);

    return Democrat.useMemo(
      () => ({
        children,
        removeChild,
        addChild,
      }),
      [children, removeChild, addChild]
    );
  };

  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  expect(store.getState().children).toBeInstanceOf(Map);
  expect(store.getState().children.size).toBe(0);
  store.getState().addChild('a');
  await waitForNextTick();
  expect(store.getState().children.size).toBe(1);
  store.getState().addChild('b');
  await waitForNextTick();
  expect(store.getState().children.size).toBe(2);
  store.getState().removeChild('a');
  await waitForNextTick();
  expect(store.getState().children.size).toBe(1);
  store.getState().children.get('b')!.setCount(42);
  await waitForNextTick();
  expect(store.getState().children.get('b')!.count).toBe(42);
});

test('can save and restore unsing snapshot', async () => {
  const Child = () => {
    const [count, setCount] = Democrat.useState(0);

    return Democrat.useMemo(
      () => ({
        count,
        setCount,
      }),
      [count, setCount]
    );
  };

  const Store = () => {
    const [ids, setIds] = Democrat.useState<Map<string, null>>(new Map());

    const children = Democrat.useChildren(mapMap(ids, () => Democrat.createElement(Child, {})));

    const addChild = Democrat.useCallback((id: string) => {
      setIds((prev) => {
        const next = mapMap(prev, (v) => v);
        next.set(id, null);
        return next;
      });
    }, []);

    const removeChild = Democrat.useCallback((id: string) => {
      setIds((prev) => {
        const next = mapMap(prev, (v) => v);
        next.delete(id);
        return next;
      });
    }, []);

    const sum = Democrat.useMemo(() => {
      return Array.from(children.values()).reduce((acc, item) => acc + item.count, 0);
    }, [children]);

    return Democrat.useMemo(
      () => ({
        children,
        removeChild,
        addChild,
        sum,
      }),
      [children, removeChild, addChild]
    );
  };

  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  store.getState().addChild('a');
  await waitForNextTick();
  store.getState().addChild('b');
  await waitForNextTick();
  store.getState().children.get('b')!.setCount(42);
  await waitForNextTick();
  const finalState = removeFunctionsDeep(store.getState());
  expect(finalState).toMatchInlineSnapshot(`
    Object {
      "addChild": "REMOVED_FUNCTION",
      "children": Map {
        "a" => Object {
          "count": 0,
          "setCount": "REMOVED_FUNCTION",
        },
        "b" => Object {
          "count": 42,
          "setCount": "REMOVED_FUNCTION",
        },
      },
      "removeChild": "REMOVED_FUNCTION",
      "sum": 42,
    }
  `);
  const snapshot = store.getSnapshot();
  const restoreStore = Democrat.createStore(Democrat.createElement(Store, {}), { snapshot });
  expect(removeFunctionsDeep(restoreStore.getState())).toEqual(finalState);
});

test('passing a React instance', () => {
  const useState = jest.fn((initialState: any) => [initialState]);
  const NotReact = {
    useState,
  };

  const Store = () => {
    const [state] = NotReact.useState(42);
    return state;
  };

  Store();
  expect(useState).toHaveBeenCalledTimes(1);

  const store = Democrat.createStore(Democrat.createElement(Store, {}), {
    ReactInstance: NotReact,
  });
  expect(store.getState()).toEqual(42);
  expect(useState).toHaveBeenCalledTimes(1);
  Store();
  expect(useState).toHaveBeenCalledTimes(2);
});

test(`effects don't run in passive mode`, async () => {
  const onEffect = jest.fn();

  const Store = () => {
    Democrat.useEffect(() => {
      onEffect();
    }, []);

    return null;
  };

  Democrat.createStore(Democrat.createElement(Store, {}));
  await waitForNextTick();
  expect(onEffect).toHaveBeenCalledTimes(1);

  Democrat.createStore(Democrat.createElement(Store, {}), { passiveMode: true });
  await waitForNextTick();
  expect(onEffect).toHaveBeenCalledTimes(1); // still one, effect not called
});

test('update root element with store.render', async () => {
  const Store = ({ num }: { num: number }) => {
    const [count, setCount] = Democrat.useState(0);

    return {
      count: count + num,
      setCount,
    };
  };

  const store = Democrat.createStore(Democrat.createElement(Store, { num: 3 }));
  expect(store.getState().count).toBe(3);
  store.getState().setCount(5);
  await waitForNextState(store);
  expect(store.getState().count).toBe(8);
  store.render(Democrat.createElement(Store, { num: 10 }));
  await waitForNextState(store);
  expect(store.getState().count).toBe(15);
});

test('cannot set state on a destroyed store', async () => {
  const Store = () => {
    const [count, setCount] = Democrat.useState(42);
    return {
      count: count,
      setCount,
    };
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  expect(store.getState().count).toBe(42);
  store.getState().setCount(8);
  await waitForNextState(store);
  expect(store.getState().count).toBe(8);
  store.destroy();
  expect(() => store.getState().setCount(0)).toThrow('Store destroyed');
});

test('cannot destroy a store twice', async () => {
  const Store = () => {
    const [count, setCount] = Democrat.useState(42);
    return {
      count: count,
      setCount,
    };
  };
  const store = Democrat.createStore(Democrat.createElement(Store, {}));
  store.destroy();
  expect(() => store.destroy()).toThrow('Store already destroyed');
});
