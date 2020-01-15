import * as Democrat from '../../src';

// Context with no default value
const Num1Ctx = Democrat.createContext<number>();

// Context with a default value
const Num2Ctx = Democrat.createContext<number>(42);

const Child = () => {
  // num1a can be undefined if there are no provider
  const num1a = Democrat.useContext(Num1Ctx);

  // num1b can only be number. if no provider it will throw
  // const num1b = Democrat.useContextOrThrow(Num1Ctx);

  // num2a is always a number because it has a default value
  const num2a = Democrat.useContext(Num2Ctx);

  // this will never throw
  const num2b = Democrat.useContextOrThrow(Num2Ctx);

  return {
    num1a,
    // num1b,
    num2a,
    num2b,
  };
};

const Parent = () => {
  const state = Democrat.useChildren({
    withContext: Democrat.createElement(Num1Ctx.Provider, {
      value: 4,
      children: Democrat.createElement(Child),
    }),
    withoutContext: Democrat.createElement(Child),
  });

  return state;
};

function runExample() {
  const store = Democrat.render(Democrat.createElement(Parent));

  const render = () => {
    console.log(store.getState());
  };

  store.subscribe(render);

  render();

  return () => store.destroy();
}

export default runExample;
