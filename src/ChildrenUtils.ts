import {
  Instance,
  EffectType,
  DemocratElementConsumer,
  DemocratElementProvider,
  DemocratElementComponent,
} from './types';
import {
  isValidElement,
  createInstance,
  objectShallowEqual,
  sameObjectKeys,
  mapObject,
  arrayShallowEqual,
  mapMap,
  mapSet,
  isComponentElement,
  isConsumerElement,
  isProviderElement,
} from './utils';
import isPlainObject from 'is-plain-object';
import { TreeElement, TreeElementState, createTreeElement, TreeElementType } from './TreeElement';
import { getInternalState } from './Global';
import { ContextStack } from './ContextStack';

type CreateTreeElementRaw<T extends { [K in TreeElementType]: any }> = T;
type TreeElementRaw = CreateTreeElementRaw<{
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
  mountChildren,
  updateChildren,
  executeEffect,
  executeLayoutEffect,
  unmountChildren,
};

function renderComponent<P, T>(
  element: DemocratElementComponent<P, T>,
  instance: Instance,
  parent: Instance
): T {
  return withGlobalRenderingInstance(
    instance,
    () => {
      beforeRender(instance);
      const result = element.type(element.props);
      afterRender(instance);
      return result;
    },
    parent
  );
}

function beforeRender(instance: Instance) {
  instance.nextHooks = [];
}

function afterRender(instance: Instance) {
  if (process.env.NODE_ENV === 'development') {
    if (instance.hooks) {
      // not first render
      if (instance.hooks.length !== instance.nextHooks.length) {
        throw new Error('Hooks count mismatch !');
      }
    }
  }
  instance.hooks = instance.nextHooks;
  instance.dirty = false;
}

function withGlobalRenderingInstance<T>(
  current: Instance,
  exec: () => T,
  expectedParent: Instance
): T {
  const expectedParentResolved = expectedParent.parent === null ? null : expectedParent;
  if (getInternalState().rendering !== expectedParentResolved) {
    throw new Error('Invalid parent !');
  }
  getInternalState().rendering = current;
  const result = exec();
  getInternalState().rendering = expectedParentResolved;
  return result;
}

function unmountChildren(tree: TreeElement, parent: Instance) {
  cleanup(tree, 'LAYOUT_EFFECT', (subInstance, force) => {
    runCleanupOfInstance(tree, subInstance, parent, 'LAYOUT_EFFECT', force);
  });
  cleanup(tree, 'EFFECT', (subInstance, force) => {
    runCleanupOfInstance(tree, subInstance, parent, 'EFFECT', force);
  });
}

function executeEffect(tree: TreeElement, parent: Instance) {
  executeEffectInternal(tree, parent, 'EFFECT');
}

function executeLayoutEffect(tree: TreeElement, parent: Instance) {
  executeEffectInternal(tree, parent, 'LAYOUT_EFFECT');
}

function executeEffectInternal(tree: TreeElement, parent: Instance, type: EffectType) {
  cleanup(tree, type, (subInstance, force) => {
    runCleanupOfInstance(tree, subInstance, parent, type, force);
  });
  effects(tree, type, subInstance => {
    runEffectsOfInstance(tree, subInstance, parent, type);
  });
}

function runEffectsOfInstance(
  tree: TreeElement,
  instance: Instance,
  parent: Instance,
  type: EffectType
) {
  withGlobaleEffectsInstance(
    instance,
    () => {
      if (instance.hooks) {
        instance.hooks.forEach(hook => {
          if (hook.type === type && hook.dirty) {
            hook.dirty = false;
            hook.cleanup = hook.effect() || undefined;
          }
          if (hook.type === 'CHILDREN') {
            if (hook.type === 'CHILDREN') {
              effects(hook.tree, type, subInstance => {
                runEffectsOfInstance(tree, subInstance, instance, type);
              });
            }
          }
        });
      }
    },
    parent
  );
}

function runCleanupOfInstance(
  tree: TreeElement,
  instance: Instance,
  parent: Instance,
  type: EffectType,
  force: boolean
) {
  withGlobaleEffectsInstance(
    instance,
    () => {
      if (instance.hooks) {
        instance.hooks.forEach(hook => {
          if (hook.type === 'CHILDREN') {
            cleanup(hook.tree, type, (subInstance, force) => {
              runCleanupOfInstance(tree, subInstance, instance, type, force);
            });
            return;
          }
          if (hook.type === type && hook.cleanup && (hook.dirty || force)) {
            hook.cleanup();
          }
        });
      }
    },
    parent
  );
}

function withGlobaleEffectsInstance(current: Instance, exec: () => void, expectedParent: Instance) {
  const expectedParentResolved = expectedParent.parent === null ? null : expectedParent;
  if (getInternalState().effects !== expectedParentResolved) {
    throw new Error('Invalid parent !');
  }
  getInternalState().effects = current;
  exec();
  getInternalState().effects = expectedParentResolved;
}

function getChildrenType(rawChildren: any): TreeElementType {
  if (rawChildren === null) {
    return 'NULL';
  }
  if (isValidElement(rawChildren)) {
    if (isComponentElement(rawChildren)) {
      return 'CHILD';
    }
    if (isConsumerElement(rawChildren)) {
      return 'CONSUMER';
    }
    if (isProviderElement(rawChildren)) {
      return 'PROVIDER';
    }
    throw new Error(`Invalid children element type`);
  }
  if (Array.isArray(rawChildren)) {
    return 'ARRAY';
  }
  if (rawChildren instanceof Map) {
    return 'MAP';
  }
  if (rawChildren instanceof Set) {
    return 'SET';
  }
  if (isPlainObject(rawChildren)) {
    return 'OBJECT';
  }
  throw new Error(`Invalid children type`);
}

const CHILDREN_MOUNT: {
  [K in TreeElementType]: (
    rawChildren: TreeElementRaw[K],
    parent: Instance,
    ctx: ContextStack | null
  ) => TreeElement<K>;
} = {
  NULL: () => {
    const item = createTreeElement('NULL', {
      value: null,
      previous: null,
    });
    return item;
  },
  CHILD: (rawChildren, parent, ctx) => {
    const instance = createInstance({
      onIdle: parent.onIdle,
      key: rawChildren.key,
      parent,
      context: ctx,
    });
    const value = renderComponent(rawChildren, instance, parent);
    const item = createTreeElement('CHILD', {
      element: rawChildren,
      instance,
      value,
      previous: null,
    });
    return item;
  },
  ARRAY: (rawChildren, parent, ctx) => {
    const children = rawChildren.map(item => mountChildren(item, parent, ctx));
    const item = createTreeElement('ARRAY', {
      children,
      value: children.map(item => item.value),
      previous: null,
    });
    return item;
  },
  OBJECT: (rawChildren, parent, ctx) => {
    const children = mapObject(rawChildren, item => {
      return mountChildren(item, parent, ctx);
    });
    const value = mapObject(children, v => v.value);
    const item = createTreeElement('OBJECT', {
      value,
      children,
      previous: null,
    });
    return item;
  },
  MAP: (rawChildren, parent, ctx) => {
    const children = mapMap(rawChildren, v => mountChildren(v, parent, ctx));
    const item = createTreeElement('MAP', {
      value: mapMap(children, item => item.value),
      children,
      previous: null,
    });
    return item;
  },
  SET: (rawChildren, parent, ctx) => {
    const children = mapSet(rawChildren, v => mountChildren(v, parent, ctx));
    const item = createTreeElement('SET', {
      value: mapSet(children, item => item.value),
      children,
      previous: null,
    });
    return item;
  },
  CONSUMER: () => {
    return createTreeElement('CONSUMER', {
      value: null,
      previous: null,
    });
  },
  PROVIDER: (rawChildren, parent, ctx) => {
    const context = ContextStack.add(ctx, rawChildren.type.context, rawChildren.props.value);
    const children = mountChildren(rawChildren.props.children, parent, context);
    return createTreeElement('PROVIDER', {
      value: children.value,
      previous: null,
      children,
    });
  },
};

function mountChildren(rawChildren: any, parent: Instance, ctx: ContextStack | null): TreeElement {
  return CHILDREN_MOUNT[getChildrenType(rawChildren)](rawChildren as never, parent, ctx);
}

const CHILDREN_UPDATES: {
  [K in TreeElementType]: (
    tree: TreeElement<K>,
    rawChildren: any,
    parent: Instance,
    ctx: ContextStack | null
  ) => TreeElement;
} = {
  NULL: (tree, rawChildren, parent, ctx) => {
    if (rawChildren === null) {
      return tree;
    }
    const nextTree = mountChildren(rawChildren, parent, ctx);
    return nextTree;
  },
  CHILD: (tree, rawChildren, parent, ctx) => {
    const sameComponent =
      isValidElement(rawChildren) &&
      rawChildren.type === tree.element.type &&
      rawChildren.key === tree.element.key;
    if (sameComponent) {
      // This is an update of a component
      const sameProps = objectShallowEqual(tree.element.props, rawChildren.props);
      if (sameProps && tree.instance.dirty === false) {
        return tree;
      }
      // Re-render
      const value = renderComponent(rawChildren, tree.instance, parent);
      // update the tree
      tree.element = rawChildren;
      tree.value = value;
      tree.state = 'updated';
      return tree;
    }
    // not the same type or not the same component
    // note: we don't need to set nextTree.updated because it's set by mountChildren;
    const nextTree = mountChildren(rawChildren, parent, ctx);
    nextTree.previous = tree;
    nextTree.previous.state = 'removed';
    return nextTree;
  },
  OBJECT: (tree, rawChildren, parent, ctx) => {
    if (isPlainObject(rawChildren)) {
      const sameKeys = sameObjectKeys(rawChildren, tree.children);
      if (sameKeys) {
        // the object has the same structure => update tree object
        let updated = false;
        Object.keys(rawChildren).forEach(key => {
          const newItem = updateChildren(tree.children[key], rawChildren[key], parent, ctx);
          if (updated === false && newItem.state !== 'stable') {
            updated = true;
          }
          tree.children[key] = newItem;
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = mapObject(tree.children, v => v.value);
        }
        return tree;
      }
      // keys have changed => build new tree
      const children: { [key: string]: TreeElement } = {};
      const allKeys = new Set([...Object.keys(rawChildren), ...Object.keys(tree.children)]);
      allKeys.forEach(key => {
        const prev = tree.children[key];
        const next = rawChildren[key];
        if (prev && !next) {
          // key removed
          prev.state = 'removed';
          return;
        }
        if (!prev && next) {
          // key added
          children[key] = mountChildren(next, parent, ctx);
          return;
        }
        // key updated
        const updated = updateChildren(prev, next, parent, ctx);
        children[key] = updated;
        if (updated !== prev) {
          prev.state = 'removed';
        }
      });
      const value = mapObject(children, v => v.value);
      tree.state = 'updated';
      const nextTree = createTreeElement('OBJECT', {
        children,
        value,
        previous: tree,
      });
      return nextTree;
    }
    // not a the same structure
    const nextTree = mountChildren(rawChildren, parent, ctx);
    nextTree.previous = tree;
    nextTree.previous.state = 'removed';
    return nextTree;
  },
  ARRAY: (tree, rawChildren, parent, ctx) => {
    if (Array.isArray(rawChildren)) {
      // if the length is different or if the keys have moved
      // we need to create a new TreeElement because cleanup order
      // is not the same as effects order
      const sameStructure = sameArrayStructure(tree.children, rawChildren);
      if (sameStructure) {
        let updated = false;
        tree.children = rawChildren.map((child, index) => {
          const newItem = updateChildren(tree.children[index], child, parent, ctx);
          if (updated === false && newItem.state !== 'stable') {
            updated = true;
          }
          return newItem;
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = tree.children.map(v => v.value);
        }
        return tree;
      }
      // array structure has changed => create a new array TreeElement
      const prevKeys = tree.children.map(item =>
        item.type === 'CHILD' ? item.element.key : undefined
      );
      const children = rawChildren.map((item, index) => {
        const key = isValidElement(item) ? item.key : undefined;
        // search previous item by key first, otherwise by index
        const prevIndex =
          key === undefined ? index : prevKeys.indexOf(key) >= 0 ? prevKeys.indexOf(key) : index;
        const prev = tree.children[prevIndex];
        if (!prev) {
          return mountChildren(item, parent, ctx);
        }
        return updateChildren(prev, item, parent, ctx);
      });
      const value = children.map(v => v.value);
      // the tree need to be processed
      tree.state = 'updated';
      // mark children not in the new tree as removed
      tree.children.forEach(prev => {
        if (children.indexOf(prev) < 0) {
          prev.state = 'removed';
        }
      });
      const nextTree = createTreeElement('ARRAY', {
        children,
        value,
        previous: tree,
      });
      return nextTree;
    }
    // not an array anymore
    const nextTree = mountChildren(rawChildren, parent, ctx);
    tree.state = 'removed';
    nextTree.previous = tree;
    return nextTree;
  },
  MAP: (tree, rawChildren, parent, ctx) => {
    if (rawChildren instanceof Map) {
      const sameStructure = sameMapStructure(tree.children, rawChildren);
      if (sameStructure) {
        let updated = false;
        tree.children = mapMap(rawChildren, child => {
          const newItem = updateChildren(child, child, parent, ctx);
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
      const allKeys = new Set([
        ...Array.from(rawChildren.keys()),
        ...Array.from(tree.children.keys()),
      ]);
      const children = new Map<any, TreeElement>();
      allKeys.forEach(key => {
        const prev = tree.children.get(key);
        const next = rawChildren.get(key);
        if (prev && !next) {
          // key removed
          prev.state = 'removed';
          return;
        }
        if (!prev && next) {
          // key added
          children.set(key, mountChildren(next, parent, ctx));
          return;
        }
        if (prev && next) {
          // key updated
          const updated = updateChildren(prev, next, parent, ctx);
          children.set(key, updated);
          if (updated !== prev) {
            prev.state = 'removed';
          }
        }
      });
      const value = mapMap(tree.children, v => v.value);
      tree.state = 'updated';
      const nextTree = createTreeElement('MAP', {
        children,
        value,
        previous: tree,
      });
      return nextTree;
    }
    // not map anymore
    const nextTree = mountChildren(rawChildren, parent, ctx);
    tree.state = 'removed';
    nextTree.previous = tree;
    return nextTree;
  },
  SET: () => {
    throw new Error('Update on Set children is not implemented yet');
  },
  CONSUMER: tree => {
    return tree;
    // throw new Error('Update on Consumer children is not implemented yet');
  },
  PROVIDER: tree => {
    return tree;
    // throw new Error('Update on Provider children is not implemented yet');
  },
};

/**
 * Returns
 *   1. The same reference if the structure is the same
 *      or a new reference if the struture has changed
 *   2. tree.updated if effects should run
 */
function updateChildren(
  tree: TreeElement,
  rawChildren: any,
  parent: Instance,
  ctx: ContextStack | null
): TreeElement {
  return CHILDREN_UPDATES[tree.type](tree as any, rawChildren, parent, ctx);
}

/**
 * Array have the same structure if
 *  - they have the same length
 *  - the keys have not moved
 */
function sameArrayStructure(prev: Array<TreeElement>, children: Array<any>): boolean {
  if (prev.length !== children.length) {
    return false;
  }
  const prevKeys = prev.map(item => (item.type === 'CHILD' ? item.element.key : undefined));
  const childrenKeys = prev.map(item => (isValidElement(item) ? item.key : undefined));
  return arrayShallowEqual(prevKeys, childrenKeys);
}

function sameMapStructure(prev: Map<any, TreeElement>, children: Map<any, any>): boolean {
  if (prev.size !== children.size) {
    return false;
  }
  let allIn = true;
  prev.forEach((_v, k) => {
    if (allIn === true && children.has(k) === false) {
      allIn = false;
    }
  });
  return allIn;
}

const CHILDREN_EFFECT: {
  [K in TreeElementType]: (
    tree: TreeElement<K>,
    type: EffectType,
    onItem: (instance: Instance) => void
  ) => void;
} = {
  NULL: () => {},
  ARRAY: (tree, type, onItem) => {
    tree.children.forEach(child => {
      effects(child, type, onItem);
    });
  },
  OBJECT: (tree, type, onItem) => {
    Object.keys(tree.children).forEach(key => {
      effects(tree.children[key], type, onItem);
    });
  },
  CHILD: (tree, _type, onItem) => {
    onItem(tree.instance);
    return;
  },
  MAP: (tree, type, onItem) => {
    tree.children.forEach(item => {
      effects(item, type, onItem);
    });
  },
  SET: (tree, type, onItem) => {
    tree.children.forEach(item => {
      effects(item, type, onItem);
    });
  },
  PROVIDER: (tree, type, onItem) => {
    effects(tree.children, type, onItem);
  },
  CONSUMER: () => {
    throw new Error('Not implemented yet');
  },
};

function effects(tree: TreeElement, type: EffectType, onItem: (instance: Instance) => void) {
  const state = tree.state;
  if (state === 'stable' || state === 'removed') {
    return;
  }
  if (type === 'EFFECT') {
    // once effect is done, the tree is stable
    tree.state = 'stable';
  }
  return CHILDREN_EFFECT[tree.type](tree as any, type, onItem);
}

const CHILDREN_CLEANUP: {
  [K in TreeElementType]: (
    tree: TreeElement<K>,
    type: EffectType,
    onItem: (instance: Instance, force: boolean) => void,
    state: Exclude<TreeElementState, 'stable'>
  ) => void;
} = {
  NULL: () => {
    return;
  },
  ARRAY: (tree, type, onItem, state) => {
    if (state === 'removed') {
      tree.children.forEach(child => {
        cleanupInternal(child, type, onItem, 'removed');
      });
      return;
    }
    tree.children.forEach(child => {
      cleanupInternal(child, type, onItem, null);
    });
  },
  OBJECT: (tree, type, onItem, state) => {
    if (state === 'removed') {
      Object.keys(tree.children).forEach(key => {
        cleanupInternal(tree.children[key], type, onItem, 'removed');
      });
      return;
    }
    Object.keys(tree.children).forEach(key => {
      cleanupInternal(tree.children[key], type, onItem, null);
    });
  },
  MAP: (tree, type, onItem, state) => {
    if (state === 'removed') {
      tree.children.forEach(item => {
        cleanupInternal(item, type, onItem, 'removed');
      });
      return;
    }
    tree.children.forEach(item => {
      cleanupInternal(item, type, onItem, null);
    });
  },
  SET: (tree, type, onItem, state) => {
    if (state === 'removed') {
      tree.children.forEach(item => {
        cleanupInternal(item, type, onItem, 'removed');
      });
      return;
    }
    tree.children.forEach(item => {
      cleanupInternal(item, type, onItem, null);
    });
  },
  CHILD: (tree, _type, onItem, state) => {
    if (state === 'created') {
      // when a child is 'created' we don't need to cleanup
      return;
    }
    if (state === 'removed') {
      onItem(tree.instance, true);
      return;
    }
    onItem(tree.instance, false);
  },
  PROVIDER: () => {
    // throw new Error('Not implemented yet');
  },
  CONSUMER: () => {
    throw new Error('Not implemented yet');
  },
};

function cleanup(
  tree: TreeElement,
  type: EffectType,
  onItem: (instance: Instance, force: boolean) => void
) {
  cleanupInternal(tree, type, onItem, null);
}

function cleanupInternal(
  tree: TreeElement,
  type: EffectType,
  onItem: (instance: Instance, force: boolean) => void,
  parentState: 'removed' | null
) {
  const state: TreeElementState = parentState || tree.state;
  if (state === 'stable') {
    return;
  }
  // if we are not in remove mode and there is a previous
  // we cleanup this instead in a force remove mode
  if (state !== 'removed' && tree.previous) {
    CHILDREN_CLEANUP[tree.type](tree.previous as any, type, onItem, state);
    if (type === 'EFFECT') {
      // if we clenup effects we don't need this anymore
      tree.previous = null;
    }
    return;
  }
  return CHILDREN_CLEANUP[tree.type](tree as any, type, onItem, state);
}
