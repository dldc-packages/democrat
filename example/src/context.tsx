import {
  createContext,
  createFactory,
  useContext,
  useChildren,
  createStore,
  useContextOrThrow,
} from '../../src';

// Context with no default value
const Num1Ctx = createContext<number>();

// Context with a default value
const Num2Ctx = createContext<number>(42);

const Child = createFactory(() => {
  // num1a can be undefined if there are no provider
  const num1a = useContext(Num1Ctx);

  // num1b can only be number. if no provider it will throw
  // const num1b = useContextOrThrow(Num1Ctx);

  // num2a is always a number because it has a default value
  const num2a = useContext(Num2Ctx);

  // this will never throw
  const num2b = useContextOrThrow(Num2Ctx);

  return {
    num1a,
    // num1b,
    num2a,
    num2b,
  };
});

const Parent = createFactory(() => {
  const state = useChildren({
    withContext: Num1Ctx.Provider.createElement({
      value: 4,
      children: Child.createElement(),
    }),
    withoutContext: Child.createElement(),
  });

  return state;
});

function runExample() {
  const store = createStore(Parent.createElement());

  const render = () => {
    console.log(store.getState());
  };

  store.subscribe(render);

  render();

  return () => store.destroy();
}

export default runExample;
