import Democrat, { Component as DemocratComponent } from '../../src';
import React from 'react';
import ReactDOM from 'react-dom';

let nextId = 0;

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

interface State {
  todos: Array<Todo>;
  addTodo: (title: string) => void;
  toggleTodo: (todoId: number) => void;
}

const TodosStore: DemocratComponent<{}, State> = () => {
  const [todos, setTodos] = Democrat.useState<Array<Todo>>([]);

  const addTodo = Democrat.useCallback((title: string) => {
    setTodos(prev => [...prev, { id: nextId++, title, done: false }]);
  }, []);

  const toggleTodo = Democrat.useCallback((todoId: number) => {
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
};

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
  const store = Democrat.render(Democrat.createElement(TodosStore));

  const render = () => {
    ReactDOM.render(<TodosRender state={store.getState()} />, document.getElementById('app'));
  };

  store.subscribe(render);

  render();
  return () => {
    ReactDOM.unmountComponentAtNode(document.getElementById('app')!);
    store.destroy();
  };
}

export default runExample;
