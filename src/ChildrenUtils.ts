import type {
  Context,
  EffectType,
  ElementComponent,
  HookSnapshot,
  TreeElement,
  TreeElementPath,
  TreeElementRaw,
  TreeElementSnapshot,
  TreeElementType,
} from './types';
import {
  createTreeElement,
  getInstanceKey,
  isComponentElement,
  isElementInstance,
  isPlainObject,
  isProviderElement,
  isRootElement,
  isValidElement,
  mapMap,
  mapObject,
  markContextSubDirty,
  objectShallowEqual,
  registerContextSub,
  sameArrayStructure,
  sameMapStructure,
  sameObjectKeys,
  unregisterContextSub,
} from './utils';

export const ChildrenUtils = {
  mount,
  update,
  effects,
  layoutEffects,
  unmount,
  access,
  snapshot,
};

const CHILDREN_LIFECYCLES: {
  [K in TreeElementType]: {
    mount: (
      element: TreeElementRaw[K],
      parent: TreeElement,
      path: TreeElementPath,
      snapshot: TreeElementSnapshot<K> | undefined,
    ) => TreeElement<K>;
    update: (instance: TreeElement<K>, element: TreeElementRaw[K], path: TreeElementPath) => TreeElement<K>;
    effect: (instance: TreeElement<K>, effecType: EffectType) => void;
    cleanup: (instance: TreeElement<K>, effecType: EffectType, force: boolean) => void;
    access: (instance: TreeElement<K>, path: TreeElementPath<K>) => TreeElement | null;
    snapshot: (instance: TreeElement<K>) => TreeElementSnapshot<K>;
  };
} = {
  ROOT: {
    mount: (element, parent, _path, snapshot) => {
      // when we mount root, parent is the root instance itself
      if (parent.type !== 'ROOT') {
        throw new Error(`Unexpected ROOT !`);
      }
      const children = parent.withGlobalRenderingInstance(parent, () => {
        return mount(element.children, parent, { type: 'ROOT' }, snapshot?.children);
      });
      parent.mounted = true;
      parent.value = children.value;
      parent.children = children;
      return parent;
    },
    update: (instance, element) => {
      const children = instance.withGlobalRenderingInstance(instance, () => {
        return update(instance.children, element.children, instance, { type: 'ROOT' });
      });
      instance.value = children.value;
      instance.children = children;
      instance.state = 'updated';
      return instance;
    },
    effect: (tree, type) => {
      effectInternal(tree.children, type);
    },
    cleanup: (tree, type, force) => {
      cleanup(tree.children, type, force);
    },
    access: (instance) => {
      return instance.children;
    },
    snapshot: (instance) => {
      return {
        type: 'ROOT',
        children: snapshot(instance.children),
      };
    },
  },
  NULL: {
    mount: (_element, parent, path) => {
      const item = createTreeElement('NULL', parent, path, {
        value: null,
        previous: null,
      });
      return item;
    },
    update: (tree) => tree,
    effect: () => {
      //
    },
    cleanup: () => {
      return;
    },
    access: () => {
      return null;
    },
    snapshot: () => {
      return { type: 'NULL' };
    },
  },
  CHILD: {
    mount: (element, parent, path, snapshot) => {
      const tree = createTreeElement('CHILD', parent, path, {
        snapshot,
        element: element,
        value: null,
        previous: null,
        dirty: false,
        hooks: null,
        nextHooks: [],
      });
      tree.value = tree.root.withGlobalRenderingInstance(tree, () => {
        return renderElement(element, tree);
      });
      // once mounted, remove snapshot
      tree.snapshot = undefined;
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
      tree.value = tree.root.withGlobalRenderingInstance(tree, () => {
        return renderElement(element, tree);
      });
      // update the tree
      tree.element = element;
      tree.state = 'updated';
      return tree;
    },
    effect: (tree, type) => {
      if (tree.hooks) {
        tree.hooks.forEach((hook) => {
          if (hook.type === type && hook.dirty) {
            hook.dirty = false;
            hook.cleanup = hook.effect() || undefined;
          }
          if (hook.type === 'CHILDREN') {
            effectInternal(hook.tree, type);
          }
        });
      }
      return;
    },
    cleanup: (tree, type, force) => {
      if (tree.hooks) {
        tree.hooks.forEach((hook) => {
          if (hook.type === 'CHILDREN') {
            cleanup(hook.tree, type, force);
            return;
          }
          if (hook.type === type && hook.cleanup && (hook.dirty || force)) {
            hook.cleanup();
          }
        });
      }
    },
    access: (instance, path) => {
      if (instance.hooks === null) {
        return null;
      }
      const hook = instance.hooks[path.hookIndex];
      if (hook.type !== 'CHILDREN') {
        return null;
      }
      return hook.tree;
    },
    snapshot: (instance) => {
      return {
        type: 'CHILD',
        hooks:
          instance.hooks === null
            ? []
            : instance.hooks.map((hook): HookSnapshot => {
                if (hook.type === 'CHILDREN') {
                  return { type: 'CHILDREN', child: snapshot(hook.tree) };
                }
                if (hook.type === 'STATE') {
                  return { type: 'STATE', value: hook.value };
                }
                if (hook.type === 'REDUCER') {
                  return { type: 'REDUCER', value: hook.value };
                }
                return null;
              }),
      };
    },
  },
  ARRAY: {
    mount: (element, parent, path, snapshot) => {
      const tree = createTreeElement('ARRAY', parent, path, {
        children: [],
        value: null,
        previous: null,
      });
      tree.children = tree.root.withGlobalRenderingInstance(tree, () => {
        return element.map((item, index) => {
          const snap = snapshot?.children[index];
          return mount(item, tree, { type: 'ARRAY', index }, snap);
        });
      });
      tree.value = tree.children.map((item) => item.value);
      return tree;
    },
    update: (tree, element, path) => {
      // if the length is different or if the keys have moved
      // we need to create a new TreeElement because cleanup order
      // is not the same as effects order
      const sameStructure = sameArrayStructure(tree.children, element);
      if (sameStructure) {
        // same structure just loop through item
        // to update them
        let updated = false;
        tree.children = tree.root.withGlobalRenderingInstance(tree, () => {
          return element.map((child, index) => {
            const newItem = update(tree.children[index], child, tree, { type: 'ARRAY', index });
            if (updated === false && newItem.state !== 'stable') {
              updated = true;
            }
            return newItem;
          });
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = tree.children.map((v) => v.value);
        }
        return tree;
      }
      // array structure has changed => create a new array TreeElement
      const nextTree = createTreeElement('ARRAY', tree.parent, path, {
        children: [],
        value: null,
        previous: tree,
      });
      const prevKeys = tree.children.map((item) => getInstanceKey(item));
      nextTree.children = tree.root.withGlobalRenderingInstance(nextTree, () => {
        return element.map((item, index) => {
          const key = isValidElement(item) ? item.key : undefined;
          // search previous item by key first, otherwise by index
          const prevIndex = key === undefined ? index : prevKeys.indexOf(key) >= 0 ? prevKeys.indexOf(key) : index;
          const prev = tree.children[prevIndex];
          if (!prev) {
            return mount(item, nextTree, { type: 'ARRAY', index }, undefined);
          }
          return update(prev, item, nextTree, { type: 'ARRAY', index });
        });
      });
      nextTree.value = nextTree.children.map((v) => v.value);
      // the old tree need to be processed
      tree.state = 'updated';
      // mark children not in the new tree as removed
      tree.children.forEach((prev) => {
        if (nextTree.children.indexOf(prev) < 0) {
          prev.state = 'removed';
        }
      });
      return nextTree;
    },
    effect: (tree, type) => {
      tree.children.forEach((child) => {
        effectInternal(child, type);
      });
    },
    cleanup: (tree, type, force) => {
      tree.children.forEach((child) => {
        cleanup(child, type, force);
      });
    },
    access: (instance, path) => {
      return instance.children[path.index] || null;
    },
    snapshot: (instance) => {
      return {
        type: 'ARRAY',
        children: instance.children.map((item) => snapshot(item)),
      };
    },
  },
  OBJECT: {
    mount: (element, parent, path, snapshot) => {
      const tree = createTreeElement('OBJECT', parent, path, {
        children: {},
        value: null,
        previous: null,
      });
      tree.children = tree.root.withGlobalRenderingInstance(tree, () =>
        mapObject(element, (item, key) => {
          const snap = snapshot?.children[key];
          return mount(item, tree, { type: 'OBJECT', objectKey: key }, snap);
        }),
      );
      tree.value = mapObject(tree.children, (v) => v.value);
      return tree;
    },
    update: (tree, element, path) => {
      const sameKeys = sameObjectKeys(element, tree.children);
      if (sameKeys) {
        // the object has the same structure => update tree object
        let updated = false;
        tree.root.withGlobalRenderingInstance(tree, () => {
          Object.keys(element).forEach((key) => {
            const newItem = update(tree.children[key], element[key], tree, {
              type: 'OBJECT',
              objectKey: key,
            });
            if (updated === false && newItem.state !== 'stable') {
              updated = true;
            }
            tree.children[key] = newItem;
          });
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = mapObject(tree.children, (v) => v.value);
        }
        return tree;
      }
      // keys have changed => build new tree
      const nextTree = createTreeElement('OBJECT', tree.parent, path, {
        children: {},
        value: null,
        previous: tree,
      });
      const allKeys = new Set([...Object.keys(element), ...Object.keys(tree.children)]);
      tree.root.withGlobalRenderingInstance(nextTree, () => {
        allKeys.forEach((key) => {
          const prev = tree.children[key];
          const next = element[key];
          if (prev && !next) {
            // key removed
            prev.state = 'removed';
            return;
          }
          if (!prev && next) {
            // key added
            nextTree.children[key] = mount(next, nextTree, { type: 'OBJECT', objectKey: key }, undefined);
            return;
          }
          // key updated
          const updated = update(prev, next, nextTree, { type: 'OBJECT', objectKey: key });
          nextTree.children[key] = updated;
          if (updated !== prev) {
            prev.state = 'removed';
          }
        });
      });
      nextTree.value = mapObject(nextTree.children, (v) => v.value);
      tree.state = 'updated';
      return nextTree;
    },
    effect: (tree, type) => {
      Object.keys(tree.children).forEach((key) => {
        effectInternal(tree.children[key], type);
      });
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        Object.keys(tree.children).forEach((key) => {
          cleanup(tree.children[key], type, true);
        });
        return;
      }
      Object.keys(tree.children).forEach((key) => {
        cleanup(tree.children[key], type, false);
      });
    },
    access: (instance, path) => {
      return instance.children[path.objectKey] || null;
    },
    snapshot: (instance) => {
      return {
        type: 'OBJECT',
        children: mapObject(instance.children, (item) => snapshot(item)),
      };
    },
  },
  MAP: {
    mount: (element, parent, path, snapshot) => {
      const children = mapMap(element, (v, key) => {
        const snap = snapshot?.children.get(key);
        return mount(v, parent, { type: 'MAP', mapKey: key }, snap);
      });
      const item = createTreeElement('MAP', parent, path, {
        value: mapMap(children, (item) => item.value),
        children,
        previous: null,
      });
      return item;
    },
    update: (tree, element, path) => {
      const sameStructure = sameMapStructure(tree.children, element);
      if (sameStructure) {
        let updated = false;
        tree.children = mapMap(element, (child, key) => {
          const newItem = update(tree.children.get(key)!, child, tree, {
            type: 'MAP',
            mapKey: key,
          });
          if (updated === false && newItem.state !== 'stable') {
            updated = true;
          }
          return newItem;
        });
        tree.state = updated ? 'updated' : 'stable';
        if (updated) {
          // Update value
          tree.value = mapMap(tree.children, (v) => v.value);
        }
        return tree;
      }
      // keys have changed
      const nextTree = createTreeElement('MAP', tree.parent, path, {
        children: new Map<any, TreeElement>(),
        value: null,
        previous: tree,
      });
      const allKeys = new Set([...Array.from(element.keys()), ...Array.from(tree.children.keys())]);
      allKeys.forEach((key) => {
        const prev = tree.children.get(key);
        const next = element.get(key);
        if (prev && !next) {
          // key removed
          prev.state = 'removed';
          return;
        }
        if (!prev && next) {
          // key added
          nextTree.children.set(key, mount(next, nextTree, { type: 'MAP', mapKey: key }, undefined));
          return;
        }
        if (prev && next) {
          // key updated
          const updated = update(prev, next, nextTree, { type: 'MAP', mapKey: key });
          nextTree.children.set(key, updated);
          if (updated !== prev) {
            prev.state = 'removed';
          }
        }
      });
      nextTree.value = mapMap(nextTree.children, (v) => v.value);
      tree.state = 'updated';
      return nextTree;
    },
    effect: (tree, type) => {
      tree.children.forEach((item) => {
        effectInternal(item, type);
      });
    },
    cleanup: (tree, effectType, force) => {
      if (force === true || tree.state === 'removed') {
        tree.children.forEach((item) => {
          cleanup(item, effectType, true);
        });
        return;
      }
      tree.children.forEach((item) => {
        cleanup(item, effectType, false);
      });
    },
    access: (instance, path) => {
      return instance.children.get(path.mapKey) || null;
    },
    snapshot: (instance) => {
      return {
        type: 'MAP',
        children: mapMap(instance.children, (item) => snapshot(item)),
      };
    },
  },
  PROVIDER: {
    mount: (element, parent, path, snapshot) => {
      const tree = createTreeElement('PROVIDER', parent, path, {
        value: null,
        previous: null,
        element: element,
        children: null as any,
      });
      tree.children = tree.root.withGlobalRenderingInstance(tree, () => {
        return mount(element.props.children, tree, { type: 'PROVIDER' }, snapshot?.children);
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
      const children = tree.root.withGlobalRenderingInstance(tree, () => {
        return update(tree.children, element.props.children, tree, { type: 'PROVIDER' });
      });
      tree.state = 'updated';
      tree.children = children;
      tree.value = children.value;
      return tree;
    },
    effect: (tree, type) => {
      effectInternal(tree.children, type);
    },
    cleanup: (tree, type, force) => {
      if (force === true || tree.state === 'removed') {
        cleanup(tree.children, type, true);
        return;
      }
      cleanup(tree.children, type, false);
    },
    access: (instance) => {
      return instance.children;
    },
    snapshot: (instance) => {
      return { type: 'PROVIDER', children: snapshot(instance.children) };
    },
  },
};

function access(instance: TreeElement, paths: Array<TreeElementPath>): TreeElement | null {
  return paths.reduce<TreeElement | null>((acc, path) => {
    if (acc === null) {
      return null;
    }
    return CHILDREN_LIFECYCLES[acc.type].access(acc as any, path as any);
  }, instance);
}

function snapshot<T extends TreeElementType>(instance: TreeElement<T>): TreeElementSnapshot<T> {
  return CHILDREN_LIFECYCLES[instance.type].snapshot(instance as any) as any;
}

function mount(
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  element: any,
  parent: TreeElement,
  path: TreeElementPath,
  snapshot: TreeElementSnapshot | undefined,
): TreeElement {
  return CHILDREN_LIFECYCLES[getChildrenType(element)].mount(element as never, parent, path, snapshot as any);
}

/**
 * Returns
 * - the same reference if the structure is the same
 * - or a new reference if the struture has changed
 */
function update(
  instance: TreeElement,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  element: any,
  parent: TreeElement,
  path: TreeElementPath,
): TreeElement {
  if ((parent === null || path === null) && instance.type !== 'ROOT') {
    throw new Error('Oops');
  }

  const nextType = getChildrenType(element);
  const shouldUnmoutRemount = (() => {
    if (instance.type !== nextType) {
      return true;
    }
    if (instance.type === 'CHILD' && isComponentElement(element)) {
      if (instance.element.type !== element.type) {
        // different component
        return true;
      }
    }
    if (isElementInstance(instance) && isValidElement(element)) {
      if (element.key !== instance.element.key) {
        // different key
        return true;
      }
    }
    return false;
  })();

  if (shouldUnmoutRemount) {
    // we mount the new children and flag the old one as removed
    const nextTree = mount(element, parent, path, undefined);
    instance.state = 'removed';
    nextTree.previous = instance;
    return nextTree;
  }

  const updated = CHILDREN_LIFECYCLES[instance.type].update(instance as any, element as never, path);
  updated.parent = parent;
  updated.path = path;
  return updated;
}

function effectInternal(tree: TreeElement, effecType: EffectType) {
  const state = tree.state;
  if (state === 'stable' || state === 'removed') {
    return;
  }
  if (!tree.root.passiveMode) {
    CHILDREN_LIFECYCLES[tree.type].effect(tree as any, effecType);
  }
  if (effecType === 'EFFECT') {
    // once effect is done, the tree is stable
    tree.state = 'stable';
  }
}

function unmount(tree: TreeElement): void {
  cleanup(tree, 'LAYOUT_EFFECT', true);
  cleanup(tree, 'EFFECT', true);
}

function effects(tree: TreeElement): void {
  cleanup(tree, 'EFFECT', false);
  effectInternal(tree, 'EFFECT');
}

function layoutEffects(tree: TreeElement): void {
  cleanup(tree, 'LAYOUT_EFFECT', false);
  effectInternal(tree, 'LAYOUT_EFFECT');
}

function cleanupTree(tree: TreeElement, effecType: EffectType, force: boolean) {
  const doForce = tree.state === 'removed' ? true : force;
  CHILDREN_LIFECYCLES[tree.type].cleanup(tree as any, effecType, doForce);
}

function cleanup(tree: TreeElement, effecType: EffectType, force: boolean) {
  if (tree.previous) {
    cleanupTree(tree.previous, effecType, force);
    if (effecType === 'EFFECT' && tree.previous) {
      // if we cleanup effects we don't need this anymore
      tree.previous = null;
    }
  }
  if (tree.state === 'created') {
    // no need to cleanup
    return;
  }
  cleanupTree(tree, effecType, force);
}

function renderElement<T>(element: ElementComponent<T>, instance: TreeElement<'CHILD'>): T {
  // clear hooks
  instance.nextHooks = [];
  const result = element.type(element.props);
  // make sure rule of hooks is respected
  if (instance.hooks && instance.hooks.length !== instance.nextHooks.length) {
    throw new Error('Hooks count mismatch !');
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
  allContexts.forEach((c) => {
    if (prevContexts.has(c) && !nextContexts.has(c)) {
      unregisterContextSub(instance, c);
    }
    if (!prevContexts.has(c) && nextContexts.has(c)) {
      registerContextSub(instance, c);
    }
  });
  instance.hooks = instance.nextHooks;
  instance.dirty = false;
  return result;
}

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
    if (isProviderElement(element)) {
      return 'PROVIDER';
    }
    // if (isConsumerElement(element)) {
    //   return 'CONSUMER';
    // }
    throw new Error(`Invalid children element type`);
  }
  if (Array.isArray(element)) {
    return 'ARRAY';
  }
  if (element instanceof Map) {
    return 'MAP';
  }
  if (isPlainObject(element)) {
    return 'OBJECT';
  }
  if (element instanceof Set) {
    throw new Error('Set are not supported');
    // return 'SET';
  }
  throw new Error(`Invalid children type`);
}
