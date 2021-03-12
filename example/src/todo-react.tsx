import * as Democrat from '../../src';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

function generateId(): string {
  return (
    '_' +
    Math.random()
      .toString(36)
      .substr(2, 9)
  );
}

interface Todo {
  id: string;
  title: string;
  done: boolean;
}

interface State {
  todos: Array<Todo>;
  addTodo: (title: string) => void;
  toggleTodo: (todoId: string) => void;
}

const TodosStore = Democrat.createFactory<void, State>(() => {
  const [todos, setTodos] = Democrat.useState<Array<Todo>>([]);

  const addTodo = Democrat.useCallback((title: string) => {
    setTodos(prev => [...prev, { id: generateId(), title, done: false }]);
  }, []);

  const toggleTodo = Democrat.useCallback((todoId: string) => {
    setTodos(prev =>
      prev.map(todo => {
        if (todo.id === todoId) {
          return {
            ...todo,
            done: !todo.done,
          };
        }
        return todo;
      })
    );
  }, []);

  return Democrat.useMemo(
    () => ({
      todos,
      addTodo,
      toggleTodo,
    }),
    [todos, addTodo, toggleTodo]
  );
});

const TodosRender: React.FC<{ state: State }> = ({ state }) => {
  const [newTodo, setNewTodo] = React.useState('');

  return (
    <div>
      <input
        value={newTodo}
        onChange={e => setNewTodo(e.target.value)}
        placeholder="new todo"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            state.addTodo(newTodo);
            setNewTodo('');
          }
        }}
      />
      <div>
        {state.todos.map(todo => (
          <div key={todo.id}>
            <input type="checkbox" checked={todo.done} onChange={() => state.toggleTodo(todo.id)} />
            <span>{todo.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function runExample() {
  const store = Democrat.createStore(TodosStore.createElement());

  const render = () => {
    ReactDOM.render(<TodosRender state={store.getState()} />, document.getElementById('app'));
  };

  (window as any).applyPatches = (patches: Democrat.Patches) => {
    store.applyPatches(patches);
  };

  store.subscribe(render);
  store.subscribePatches(patches => {
    console.log('Patches', patches);
  });

  render();
  return () => {
    ReactDOM.unmountComponentAtNode(document.getElementById('app')!);
    store.destroy();
  };
}

export default runExample;
