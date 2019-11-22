// @ts-ignore
import EXAMPLES from './src/**.tsx';

const root = document.getElementById('root')!;

let cleanup: null | (() => void) = null;

Object.keys(EXAMPLES).forEach(key => {
  const btn = document.createElement('button');
  btn.innerText = key;
  btn.addEventListener('click', () => {
    if (cleanup) {
      cleanup();
    }
    window.setTimeout(() => {
      console.log(
        [`*************************`, `* Running example ${key}`, `*************************`].join(
          '\n'
        )
      );
      cleanup = EXAMPLES[key].default();
    }, 100);
  });
  root.appendChild(btn);
});
