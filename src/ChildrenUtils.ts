import { Instance, DemocratElement } from './types';
import {
  isValidElement,
  createInstance,
  objectShallowEqual,
  sameObjectKeys,
  mapObject,
  arrayShallowEqual,
} from './utils';
import isPlainObject from 'is-plain-object';

type RenderComponent = <P, T>(
  element: DemocratElement<P, T>,
  instance: Instance,
  parent: Instance | null
) => T;

type TreeElementState = 'created' | 'stable' | 'updated' | 'removed';

type TreeElementCommon = {
  id: number;
  previous: TreeElement | null;
  value: any;
  state: TreeElementState;
};

type TreeElementObject = TreeElementCommon & {
  type: 'OBJECT';
  children: { [key: string]: TreeElement };
};
type TreeElementArray = TreeElementCommon & { type: 'ARRAY'; children: Array<TreeElement> };
type TreeElementChild = TreeElementCommon & {
  type: 'CHILD';
  element: DemocratElement<any, any>;
  instance: Instance;
};
type TreeElementNull = TreeElementCommon & { type: 'NULL' };

export type TreeElement = TreeElementNull | TreeElementObject | TreeElementArray | TreeElementChild;

export const ChildrenUtils = {
  mount: mountChildren,
  update: updateChildren,
  cleanup,
  effects,
};

const nextId = (() => {
  let id = 0;
  return () => id++;
})();

function mountChildren(rawChildren: any, parent: Instance, render: RenderComponent): TreeElement {
  if (rawChildren === null) {
    const item: TreeElementNull = {
      id: nextId(),
      type: 'NULL',
      value: null,
      previous: null,
      state: 'created',
    };
    return item;
  }
  if (isValidElement(rawChildren)) {
    const instance = createInstance({
      onIdle: parent.onIdle,
      key: rawChildren.key,
      parent,
    });
    const value = render(rawChildren, instance, parent);
    const item: TreeElementChild = {
      id: nextId(),
      type: 'CHILD',
      value,
      previous: null,
      element: rawChildren,
      instance,
      state: 'created',
    };
    return item;
  }
  if (Array.isArray(rawChildren)) {
    const children = rawChildren.map(item => mountChildren(item, parent, render));
    const item: TreeElementArray = {
      id: nextId(),
      type: 'ARRAY',
      value: children.map(item => item.value),
      previous: null,
      children,
      state: 'created',
    };
    return item;
  }
  if (isPlainObject(rawChildren)) {
    const children = mapObject(rawChildren, item => {
      return mountChildren(item, parent, render);
    });
    const value = mapObject(children, v => v.value);
    const item: TreeElementObject = {
      id: nextId(),
      type: 'OBJECT',
      value: value,
      previous: null,
      children: children,
      state: 'created',
    };
    return item;
  }

  throw new Error(`Invalid value in children`);
}

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
  render: RenderComponent
): TreeElement {
  if (tree.type === 'NULL') {
    if (rawChildren === null) {
      return tree;
    }
    const nextTree = mountChildren(rawChildren, parent, render);
    return nextTree;
  }
  if (tree.type === 'CHILD') {
    if (
      isValidElement(rawChildren) &&
      rawChildren.component === tree.element.component &&
      rawChildren.key === tree.element.key
    ) {
      // This is an update of a component
      const sameProps = objectShallowEqual(tree.element.props, rawChildren.props);
      if (sameProps && tree.instance.dirty === false) {
        return tree;
      }
      // Re-render
      const value = render(rawChildren, tree.instance, parent);
      // update the tree
      tree.element = rawChildren;
      tree.value = value;
      tree.state = 'updated';
      return tree;
    }
    // not the same type or not the same component
    // note: we don't need to set nextTree.updated because it's set by mountChildren;
    const nextTree = mountChildren(rawChildren, parent, render);
    nextTree.previous = tree;
    nextTree.previous.state = 'removed';
    return nextTree;
  }
  if (tree.type === 'OBJECT') {
    if (isPlainObject(rawChildren)) {
      const sameKeys = sameObjectKeys(rawChildren, tree.children);
      if (sameKeys) {
        // the object has the same structure => update tree object
        let updated = false;
        Object.keys(rawChildren).forEach(key => {
          const newItem = updateChildren(tree.children[key], rawChildren[key], parent, render);
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
      const children = mapObject(rawChildren, (val, key) => {
        const prevItem = tree.children[key];
        return prevItem
          ? updateChildren(prevItem, val, parent, render)
          : mountChildren(rawChildren[key], parent, render);
      });
      const value = mapObject(children, v => v.value);
      const nextTree: TreeElementObject = {
        id: nextId(),
        type: 'OBJECT',
        children,
        value,
        previous: tree,
        state: 'created',
      };
      return nextTree;
    }
    // not a the same structure
    const nextTree = mountChildren(rawChildren, parent, render);
    nextTree.previous = tree;
    nextTree.previous.state = 'removed';
    return nextTree;
  }
  if (tree.type === 'ARRAY') {
    if (Array.isArray(rawChildren)) {
      const sameStructure = sameArrayStructure(tree.children, rawChildren);
      if (sameStructure) {
        let updated = false;
        tree.children = rawChildren.map((child, index) => {
          const newItem = updateChildren(tree.children[index], child, parent, render);
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
      // array has changed
      const prevKeys = tree.children.map(item =>
        item.type === 'CHILD' ? item.element.key : undefined
      );
      const children = rawChildren.map((item, index) => {
        const key = isValidElement(item) ? item.key : undefined;
        const prevIndex =
          key === undefined ? index : prevKeys.indexOf(key) >= 0 ? prevKeys.indexOf(key) : index;
        const prev = tree.children[prevIndex];
        if (!prev) {
          return mountChildren(item, parent, render);
        }
        return updateChildren(prev, item, parent, render);
      });
      const value = children.map(v => v.value);
      tree.children.forEach(prev => {
        if (children.indexOf(prev) < 0) {
          prev.state = 'removed';
        }
      });
      tree.state = 'updated';

      const nextTree: TreeElementArray = {
        id: nextId(),
        type: 'ARRAY',
        children,
        value,
        previous: tree,
        state: 'created',
      };
      return nextTree;
    }
    // not an array anymore
    const nextTree = mountChildren(rawChildren, parent, render);
    nextTree.previous = tree;
    nextTree.previous.state = 'removed';
    return nextTree;
  }
  throw new Error(`Unsuported update !`);
}

/**
 * We need a new structure if
 *  - the two arrays have different lengths
 *  - or keys have moved
 * false positive are not an issue since
 */
function sameArrayStructure(prev: Array<TreeElement>, children: Array<any>): boolean {
  if (prev.length !== children.length) {
    return false;
  }
  const prevKeys = prev.map(item => (item.type === 'CHILD' ? item.element.key : undefined));
  const childrenKeys = prev.map(item => (isValidElement(item) ? item.key : undefined));
  return arrayShallowEqual(prevKeys, childrenKeys);
}

function effects(
  tree: TreeElement,
  type: 'EFFECT' | 'LAYOUT_EFFECT',
  onItem: (instance: Instance) => void
) {
  const state = tree.state;
  if (state === 'stable' || state === 'removed') {
    return;
  }
  if (type === 'EFFECT') {
    // once effect is done, the tree is stable
    tree.state = 'stable';
  }
  if (tree.type === 'NULL') {
    return;
  }
  if (tree.type === 'ARRAY') {
    tree.children.forEach(child => {
      effects(child, type, onItem);
    });
    return;
  }
  if (tree.type === 'OBJECT') {
    Object.keys(tree.children).forEach(key => {
      effects(tree.children[key], type, onItem);
    });
    return;
  }
  if (tree.type === 'CHILD') {
    onItem(tree.instance);
    return;
  }
  throw new Error(`Unhandled tree type for effect`);
}

function cleanup(
  tree: TreeElement,
  type: 'EFFECT' | 'LAYOUT_EFFECT',
  onItem: (instance: Instance, force: boolean) => void
) {
  cleanupInternal(tree, type, onItem, null);
}

function cleanupInternal(
  tree: TreeElement,
  type: 'EFFECT' | 'LAYOUT_EFFECT',
  onItem: (instance: Instance, force: boolean) => void,
  parentState: 'removed' | null
) {
  const state: TreeElementState = parentState || tree.state;
  if (state === 'stable') {
    return;
  }
  if (tree.type === 'NULL') {
    if (state === 'created' || state === 'updated') {
      if (tree.previous) {
        cleanupInternal(tree.previous, type, onItem, null);
        if (type === 'EFFECT') {
          tree.previous = null;
        }
      }
    }
    return;
  }
  if (tree.type === 'ARRAY') {
    if (state === 'removed') {
      tree.children.forEach(child => {
        cleanupInternal(child, type, onItem, 'removed');
      });
      return;
    }
    if (state === 'created' || state === 'updated') {
      if (tree.previous) {
        cleanupInternal(tree.previous, type, onItem, null);
        if (type === 'EFFECT') {
          tree.previous = null;
        }
        return;
      }
      tree.children.forEach(child => {
        cleanupInternal(child, type, onItem, null);
      });
      return;
    }
    return;
  }
  if (tree.type === 'OBJECT') {
    if (state === 'removed') {
      Object.keys(tree.children).forEach(key => {
        cleanupInternal(tree.children[key], type, onItem, 'removed');
      });
      return;
    }
    if (state === 'created' || state === 'updated') {
      if (tree.previous) {
        cleanupInternal(tree.previous, type, onItem, null);
        if (type === 'EFFECT') {
          tree.previous = null;
        }
        return;
      }
      Object.keys(tree.children).forEach(key => {
        cleanupInternal(tree.children[key], type, onItem, null);
      });
      return;
    }
    return;
  }
  if (tree.type === 'CHILD') {
    if (state === 'created') {
      // when a child is 'created' we don't need to cleanup
      return;
    }
    if (state === 'removed') {
      onItem(tree.instance, true);
      return;
    }
    if (state === 'updated') {
      onItem(tree.instance, false);
      return;
    }
    return;
  }
  throw new Error(`Unhandled tree type for cleanup`);
}
