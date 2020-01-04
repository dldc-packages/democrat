import {
  EffectType,
  DemocratElementConsumer,
  DemocratElementProvider,
  DemocratElementComponent,
  TreeElementType,
  TreeElement,
  DemocratRootElement,
  Context,
} from './types';
import {
  isValidElement,
  objectShallowEqual,
  sameObjectKeys,
  mapObject,
  mapMap,
  mapSet,
  isComponentElement,
  isConsumerElement,
  isProviderElement,
  createTreeElement,
  sameArrayStructure,
  sameMapStructure,
  isRootElement,
  unregisterContextSub,
  registerContextSub,
  markContextSubDirty,
} from './utils';
import isPlainObject from 'is-plain-object';
import { withGlobalRenderingInstance, withGlobaleEffectsInstance } from './Global';

type CreateTreeElementRaw<T extends { [K in TreeElementType]: any }> = T;
type TreeElementRaw = CreateTreeElementRaw<{
  ROOT: DemocratRootElement;
  NULL: null;
  CHILD: DemocratElementComponent<any, any>;
  PROVIDER: DemocratElementProvider<any, any>;
  CONSUMER: DemocratElementConsumer<any, any>;
  ARRAY: Array<any>;
  OBJECT: { [key: string]: any };
  MAP: Map<any, any>;
  SET: Set<any>;
}>;

export const ChildrenUtils = {
  mount,
  update,
  effects,
  layoutEffects,
  unmount,
};

function getChildrenType(element: any): TreeElementType {
  if (element === null) {
    return 'NULL';
  }
  if (isValidElement(element)) {
    if (isRootElement(element)) {
      return 'ROOT';
    }
    if (isComponentElement(element)) {
      return 'CHILD';
    }
    if (isConsumerElement(element)) {
      return 'CONSUMER';
    }
    if (isProviderElement(element)) {
      return 'PROVIDER';
    }
    throw new Error(`Invalid children element type`);
  }
  if (Array.isArray(element)) {
    return 'ARRAY';
  }
  if (element instanceof Map) {
    return 'MAP';
  }
  if (element instanceof Set) {
    return 'SET';
  }
  if (isPlainObject(element)) {
    return 'OBJECT';
  }
  throw new Error(`Invalid children type`);
}

const CHILDREN_LIFECYCLES: {
  [K in TreeElementType]: {
    mount: (element: TreeElementRaw[K], parent: TreeElement) => TreeElement<K>;
    update: (tree: TreeElement<K>, element: TreeElementRaw[K]) => TreeElement<K>;
    effect: (tree: TreeElement<K>, type: EffectType) => void;
    cleanup: (tree: TreeElement<K>, type: EffectType, force: boolean) => void;
  };
} = {
  ROOT: {
    mount: (element, tree) => {
      if (tree.type !== 'ROOT') {
        throw new Error(`Unexpected ROOT !`);
      }
      const children = withGlobalRenderingInstance(tree, () => {
        return mount(element.children, tree);
      });
      tree.mounted = true;
      tree.value = children.value;
      tree.children = children;
      return tree;
    },
    update: (tree, element) => {
      const children = withGlobalRenderingInstance(tree, () => {
        return update(tree.children, element.children, tree);
      });
      tree.value = children.value;
      tree.children = children;
      return tree;
    },
    effect: (tree, type) => {
      withGlobaleEffectsInstance(tree, () => {
        effectInternal(tree.children, type);
      });
    },
    cleanup: (tree, type, force) => {
      withGlobaleEffectsInstance(tree, () => {
        cleanup(tree.children, type, force);
      });
    },
  },
  NULL: {
    mount: (_element, parent) => {
      const item = createTreeElement('NULL', parent, {
        value: null,
        previous: null,
      });
      return item;
    },
    update: tree => tree,
    effect: () => {},
    cleanup: () => {
      return;
    },
  },
  CHILD: {
    mount: (element, parent) => {
      const tree = createTreeElement('CHILD', parent, {
        element: element,
        value: null,
        previous: null,
        key: element.key,
        dirty: false,
        hooks: null,
        nextHooks: [],
      });
      tree.value = withGlobalRenderingInstance(tree, () => {
        return renderComponent(element, tree);
      });
      return tree;
    },
    update: (tree, element) => {
      // This is an update of a component
      const sameProps = objectShallowEqual(tree.element.props, element.props);
      // Note dirty is set when a state or a context change
      if (sameProps && tree.dirty === false) {
        return tree;
      }
      // Re-render
      tree.value = withGlobalRenderingInstance(tree, () => {
        return renderComponent(element, tree);
      });
      // update the tree
      tree.element = element;
      tree.state = 'updated';
      return tree;
    },
    effect: (tree, type) => {
      withGlobaleEffectsInstance(tree, () => {
        if (tree.hooks) {
          tree.hooks.forEach(hook => {
            if (hook.type === type && hook.dirty) {
              hook.dirty = false;
              hook.cleanup = hook.effect() || undefined;
            }
            if (hook.type === 'CHILDREN') {
              effectInternal(hook.tree, type);
            }
          });
        }
      });
      return;
    },
    cleanup: (tree, type, force) => {
      if (force || tree.state === 'removed') {
        // force cleanup
        runCleanupOfChild(tree, type, true);
        return;
      }
      if (tree.state === 'created') {
        // when a child is 'created' we don't need to cleanup
        return;
      }
      runCleanupOfChild(tree, type, false);
    },
  },
  ARRAY: {
    mount: (element, parent) => {
      const tree = createTreeElement('ARRAY', parent, {
        children: [],
        value: null,
        previous: null,
      });
      tree.children = withGlobalRenderingInstance(tree, () => {
        return element.map(item => mount(item, tree));
      });
      tree.value = tree.children.map(item => item.value);
      return tree;
    },
    update: (tree, element) => {
      // if the length is different or if the keys have moved
      // we need to create a new TreeElement because cleanup order
      // is not the same as effects order
      const sameStructure = sameArrayStructure(tree.children, element);
      if (sameStructure) {
        let updated = false;
        tree.children = withGlobalRenderingInstance(tree, () => {
          return element.map((child, index) => {
            const newItem = update(tree.children[index], child, tree);
            if (updated === false && newItem.state !== 'stable') {
              updated = true;
            }
            return newItem;
          });
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = tree.children.map(v => v.value);
        }
        return tree;
      }
      // array structure has changed => create a new array TreeElement
      const nextTree = createTreeElement('ARRAY', tree.parent!, {
        children: [],
        value: null,
        previous: tree,
      });
      const prevKeys = tree.children.map(item =>
        item.type === 'CHILD' ? item.element.key : undefined
      );
      nextTree.children = withGlobalRenderingInstance(nextTree, () => {
        return element.map((item, index) => {
          const key = isValidElement(item) ? item.key : undefined;
          // search previous item by key first, otherwise by index
          const prevIndex =
            key === undefined ? index : prevKeys.indexOf(key) >= 0 ? prevKeys.indexOf(key) : index;
          const prev = tree.children[prevIndex];
          if (!prev) {
            return mount(item, nextTree);
          }
          return update(prev, item, nextTree);
        });
      });
      nextTree.value = nextTree.children.map(v => v.value);
      // the old tree need to be processed
      tree.state = 'updated';
      // mark children not in the new tree as removed
      tree.children.forEach(prev => {
        if (nextTree.children.indexOf(prev) < 0) {
          prev.state = 'removed';
        }
      });
      return nextTree;
    },
    effect: (tree, type) => {
      withGlobaleEffectsInstance(tree, () => {
        tree.children.forEach(child => {
          effectInternal(child, type);
        });
      });
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        tree.children.forEach(child => {
          cleanup(child, type, true);
        });
        return;
      }
      tree.children.forEach(child => {
        cleanup(child, type, false);
      });
    },
  },
  OBJECT: {
    mount: (element, parent) => {
      const tree = createTreeElement('OBJECT', parent, {
        children: {},
        value: null,
        previous: null,
      });
      tree.children = withGlobalRenderingInstance(tree, () =>
        mapObject(element, item => {
          return mount(item, tree);
        })
      );
      tree.value = mapObject(tree.children, v => v.value);
      return tree;
    },
    update: (tree, element) => {
      const sameKeys = sameObjectKeys(element, tree.children);
      if (sameKeys) {
        // the object has the same structure => update tree object
        let updated = false;
        withGlobalRenderingInstance(tree, () => {
          Object.keys(element).forEach(key => {
            const newItem = update(tree.children[key], element[key], tree);
            if (updated === false && newItem.state !== 'stable') {
              updated = true;
            }
            tree.children[key] = newItem;
          });
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = mapObject(tree.children, v => v.value);
        }
        return tree;
      }
      // keys have changed => build new tree
      const nextTree = createTreeElement('OBJECT', tree.parent!, {
        children: {},
        value: null,
        previous: tree,
      });
      const allKeys = new Set([...Object.keys(element), ...Object.keys(tree.children)]);
      withGlobalRenderingInstance(nextTree, () => {
        allKeys.forEach(key => {
          const prev = tree.children[key];
          const next = element[key];
          if (prev && !next) {
            // key removed
            prev.state = 'removed';
            return;
          }
          if (!prev && next) {
            // key added
            nextTree.children[key] = mount(next, nextTree);
            return;
          }
          // key updated
          const updated = update(prev, next, nextTree);
          nextTree.children[key] = updated;
          if (updated !== prev) {
            prev.state = 'removed';
          }
        });
      });
      nextTree.value = mapObject(nextTree.children, v => v.value);
      tree.state = 'updated';
      return nextTree;
    },
    effect: (tree, type) => {
      withGlobaleEffectsInstance(tree, () => {
        Object.keys(tree.children).forEach(key => {
          effectInternal(tree.children[key], type);
        });
      });
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        Object.keys(tree.children).forEach(key => {
          cleanup(tree.children[key], type, true);
        });
        return;
      }
      Object.keys(tree.children).forEach(key => {
        cleanup(tree.children[key], type, false);
      });
    },
  },
  MAP: {
    mount: (element, parent) => {
      const children = mapMap(element, v => mount(v, parent));
      const item = createTreeElement('MAP', parent, {
        value: mapMap(children, item => item.value),
        children,
        previous: null,
      });
      return item;
    },
    update: (tree, element) => {
      const sameStructure = sameMapStructure(tree.children, element);
      if (sameStructure) {
        let updated = false;
        tree.children = mapMap(element, child => {
          const newItem = update(child, child, tree);
          if (updated === false && newItem.state !== 'stable') {
            updated = true;
          }
          return newItem;
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = mapMap(tree.children, v => v.value);
        }
        return tree;
      }
      // keys have changed
      const allKeys = new Set([...Array.from(element.keys()), ...Array.from(tree.children.keys())]);
      const children = new Map<any, TreeElement>();
      allKeys.forEach(key => {
        const prev = tree.children.get(key);
        const next = element.get(key);
        if (prev && !next) {
          // key removed
          prev.state = 'removed';
          return;
        }
        if (!prev && next) {
          // key added
          children.set(key, mount(next, tree));
          return;
        }
        if (prev && next) {
          // key updated
          const updated = update(prev, next, nextTree);
          children.set(key, updated);
          if (updated !== prev) {
            prev.state = 'removed';
          }
        }
      });
      const value = mapMap(tree.children, v => v.value);
      tree.state = 'updated';
      const nextTree = createTreeElement('MAP', tree.parent!, {
        children,
        value,
        previous: tree,
      });
      return nextTree;
    },
    effect: (tree, type) => {
      tree.children.forEach(item => {
        effectInternal(item, type);
      });
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        tree.children.forEach(item => {
          cleanup(item, type, true);
        });
        return;
      }
      tree.children.forEach(item => {
        cleanup(item, type, false);
      });
    },
  },
  SET: {
    mount: (element, parent) => {
      const children = mapSet(element, v => mount(v, parent));
      const item = createTreeElement('SET', parent, {
        value: mapSet(children, item => item.value),
        children,
        previous: null,
      });
      return item;
    },
    update: () => {
      throw new Error('Update on Set children is not implemented yet');
    },
    effect: (tree, type) => {
      tree.children.forEach(item => {
        effectInternal(item, type);
      });
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        tree.children.forEach(item => {
          cleanup(item, type, true);
        });
        return;
      }
      tree.children.forEach(item => {
        cleanup(item, type, false);
      });
    },
  },
  CONSUMER: {
    mount: (element, parent) => {
      return createTreeElement('CONSUMER', parent, {
        value: null,
        previous: null,
        element: element,
      });
    },
    update: tree => {
      return tree;
      // throw new Error('Update on Consumer children is not implemented yet');
    },
    effect: (_tree, _type) => {
      // effectInternal(tree.)
    },
    cleanup: () => {
      throw new Error('Not implemented yet');
    },
  },
  PROVIDER: {
    mount: (element, parent) => {
      const tree = createTreeElement('PROVIDER', parent, {
        value: null,
        previous: null,
        element: element,
        children: null as any,
      });
      tree.children = withGlobalRenderingInstance(tree, () => {
        return mount(element.props.children, tree);
      });
      tree.value = tree.children.value;
      return tree;
    },
    update: (tree, element) => {
      const shouldMarkDirty = (() => {
        if (tree.element.key !== element.key) {
          return true;
        }
        if (tree.element.type.context !== element.type.context) {
          return true;
        }
        if (tree.element.props.value !== element.props.value) {
          return true;
        }
        return false;
      })();
      if (shouldMarkDirty) {
        markContextSubDirty(tree, tree.element.type.context);
      }
      tree.element = element;
      const children = withGlobalRenderingInstance(tree, () => {
        return update(tree.children, element.props.children, tree);
      });
      tree.state = 'updated';
      tree.children = children;
      tree.value = children.value;
      return tree;
    },
    effect: (tree, type) => {
      withGlobaleEffectsInstance(tree, () => {
        effectInternal(tree.children, type);
      });
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        cleanup(tree.children, type, true);
        return;
      }
      cleanup(tree.children, type, false);
    },
  },
};

function mount(element: any, parent: TreeElement): TreeElement {
  return CHILDREN_LIFECYCLES[getChildrenType(element)].mount(element as never, parent);
}

/**
 * Returns
 *   1. The same reference if the structure is the same
 *      or a new reference if the struture has changed
 *   2. tree.updated if effects should run
 */
function update(tree: TreeElement, element: any, parent: TreeElement | null): TreeElement {
  if (tree.type !== 'ROOT' && parent === null) {
    throw new Error('Oop');
  }

  const nextType = getChildrenType(element);
  const shouldUnmoutRemount = (() => {
    if (tree.type !== nextType) {
      return true;
    }
    if (tree.type === 'CHILD' && isComponentElement(element)) {
      if (tree.element.type !== element.type) {
        // different component
        return true;
      }
    }
    if (
      (tree.type === 'CHILD' || tree.type === 'CONSUMER' || tree.type === 'PROVIDER') &&
      isValidElement(element)
    ) {
      if (element.key !== tree.element.key) {
        // different key
        return true;
      }
    }
    return false;
  })();

  if (shouldUnmoutRemount) {
    console.log('shouldUnmoutRemount');
    // we mount the mew children and flag the old one as removed
    const nextTree = mount(element, parent!);
    tree.state = 'removed';
    nextTree.previous = tree;
    return nextTree;
  }

  const updated = CHILDREN_LIFECYCLES[tree.type].update(tree as any, element as never);
  if (updated.parent !== parent) {
    updated.parent = parent!;
  }
  return updated;
}

function effectInternal(tree: TreeElement, type: EffectType) {
  const state = tree.state;
  if (state === 'stable' || state === 'removed') {
    return;
  }
  if (type === 'EFFECT') {
    // once effect is done, the tree is stable
    tree.state = 'stable';
  }
  return CHILDREN_LIFECYCLES[tree.type].effect(tree as any, type);
}

function unmount(tree: TreeElement) {
  cleanup(tree, 'LAYOUT_EFFECT', true);
  cleanup(tree, 'EFFECT', true);
}

function effects(tree: TreeElement) {
  cleanup(tree, 'EFFECT', false);
  effectInternal(tree, 'EFFECT');
}

function layoutEffects(tree: TreeElement) {
  cleanup(tree, 'LAYOUT_EFFECT', false);
  effectInternal(tree, 'LAYOUT_EFFECT');
}

function cleanup(tree: TreeElement, type: EffectType, force: boolean) {
  if (force === false && tree.state === 'stable') {
    return;
  }
  if (force === true || tree.state === 'removed') {
    CHILDREN_LIFECYCLES[tree.type].cleanup(tree.previous as any, type, true);
    return;
  }
  if (tree.previous) {
    // not removing
    // we cleanup the previous instance
    CHILDREN_LIFECYCLES[tree.type].cleanup(tree.previous as any, type, false);
    if (type === 'EFFECT') {
      // if we cleanup effects we don't need this anymore
      tree.previous = null;
    }
    return;
  }
}

function renderComponent<P, T>(
  element: DemocratElementComponent<P, T>,
  instance: TreeElement<'CHILD'>
): T {
  beforeRender(instance);
  const result = element.type(element.props);
  afterRender(instance);
  return result;
}

function beforeRender(instance: TreeElement<'CHILD'>) {
  instance.nextHooks = [];
}

function afterRender(instance: TreeElement<'CHILD'>) {
  if (process.env.NODE_ENV === 'development') {
    if (instance.hooks) {
      // not first render
      if (instance.hooks.length !== instance.nextHooks.length) {
        throw new Error('Hooks count mismatch !');
      }
    }
  }
  // update context sub
  const allContexts = new Set<Context<any>>();
  const prevContexts: Set<Context<any>> =
    instance.hooks === null
      ? new Set()
      : instance.hooks.reduce((acc, hook) => {
          if (hook.type === 'CONTEXT') {
            allContexts.add(hook.context);
            acc.add(hook.context);
          }
          return acc;
        }, new Set<Context<any>>());
  const nextContexts = instance.nextHooks.reduce((acc, hook) => {
    if (hook.type === 'CONTEXT') {
      allContexts.add(hook.context);
      acc.add(hook.context);
    }
    return acc;
  }, new Set<Context<any>>());
  allContexts.forEach(c => {
    if (prevContexts.has(c) && !nextContexts.has(c)) {
      unregisterContextSub(instance, c);
    }
    if (!prevContexts.has(c) && nextContexts.has(c)) {
      registerContextSub(instance, c);
    }
  });
  instance.hooks = instance.nextHooks;
  instance.dirty = false;
}

function runCleanupOfChild(tree: TreeElement<'CHILD'>, type: EffectType, force: boolean) {
  withGlobaleEffectsInstance(tree, () => {
    if (tree.hooks) {
      tree.hooks.forEach(hook => {
        if (hook.type === 'CHILDREN') {
          cleanup(hook.tree, type, force);
          return;
        }
        if (hook.type === type && hook.cleanup && (hook.dirty || force)) {
          hook.cleanup();
        }
      });
    }
  });
}
