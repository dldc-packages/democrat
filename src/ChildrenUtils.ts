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
import { ComponentUtils } from './ComponentUtils';

type TreeElementCommon = {
  previous: TreeElement | null;
  value: any;
  dirty: boolean;
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
  cleanupEffects,
  cleanupLayoutEffects,
};

function mountChildren(rawChildren: any, parent: Instance): TreeElement {
  if (rawChildren === null) {
    const item: TreeElementNull = {
      type: 'NULL',
      value: null,
      previous: null,
      dirty: false,
    };
    return item;
  }
  if (isValidElement(rawChildren)) {
    const instance = createInstance({
      onIdle: parent.onIdle,
      key: rawChildren.key,
      parent,
    });
    const value = ComponentUtils.render(rawChildren.component, rawChildren.props, instance, parent);
    const item: TreeElementChild = {
      type: 'CHILD',
      value,
      previous: null,
      element: rawChildren,
      instance,
      dirty: true,
    };
    return item;
  }
  if (Array.isArray(rawChildren)) {
    const children = rawChildren.map(item => mountChildren(item, parent));
    const item: TreeElementArray = {
      type: 'ARRAY',
      value: children.map(item => item.value),
      previous: null,
      children,
      dirty: true,
    };
    return item;
  }
  if (isPlainObject(rawChildren)) {
    const children = mapObject(rawChildren, item => {
      return mountChildren(item, parent);
    });
    const value = mapObject(children, v => v.value);
    const item: TreeElementObject = {
      type: 'OBJECT',
      value: value,
      previous: null,
      children: children,
      dirty: true,
    };
    return item;
  }

  throw new Error(`Invalid value in children`);
}

function cleanupEffects(tree: TreeElement) {
  // cleanupEffectsInternal(tree, 'EFFECT');
}

function cleanupLayoutEffects(tree: TreeElement) {
  // cleanupEffectsInternal(tree, 'LAYOUT_EFFECT');
}

// function unmountTree(tree: TreeElement, type: 'EFFECT' | 'LAYOUT_EFFECT') {
//   if (tree.type === 'NULL') {
//     return;
//   }
//   if (tree.type === 'CHILD') {
//     runCleanupOfInstance(subItem.instance, instance, type, true);
//   }
// }

// function cleanupEffectsInternal(tree: TreeElement, type: 'EFFECT' | 'LAYOUT_EFFECT') {
//   if (tree.updated === false) {
//     return;
//   }
//   if (tree.type === 'CHILD') {
//     if (tree.previous) {
//       cleanupEffectsInternal(tree.previous, type, true);

//     }
//   }
// }

/**
 * Returns
 *   1. The same reference if the structure is the same
 *      or a new reference if the struture has changed
 *   2. tree.updated if effects should run
 */
function updateChildren(prevTree: TreeElement, rawChildren: any, parent: Instance): TreeElement {
  if (prevTree.type === 'NULL') {
    if (rawChildren === null) {
      return prevTree;
    }
    const nextTree = mountChildren(rawChildren, parent);
    return nextTree;
  }
  if (prevTree.type === 'CHILD') {
    if (
      isValidElement(rawChildren) &&
      rawChildren.component === prevTree.element.component &&
      rawChildren.key === prevTree.element.key
    ) {
      // This is an update of a component
      const sameProps = objectShallowEqual(prevTree.element.props, rawChildren.props);
      if (sameProps && prevTree.instance.dirty === false) {
        // skip update because props are the same an the state hasn't changed (dirty === false)
        return prevTree;
      }
      // Re-render
      const value = ComponentUtils.render(
        rawChildren.component,
        rawChildren.props,
        prevTree.instance,
        parent
      );
      // update the tree
      prevTree.element = rawChildren;
      prevTree.value = value;
      prevTree.dirty = true;
      return prevTree;
    }
    // not the same type or not the same component
    // note: we don't need to set nextTree.updated because it's set by mountChildren;
    const nextTree = mountChildren(rawChildren, parent);
    nextTree.previous = prevTree;
    return nextTree;
  }
  if (prevTree.type === 'OBJECT') {
    if (isPlainObject(rawChildren)) {
      const sameKeys = sameObjectKeys(rawChildren, prevTree.children);
      if (sameKeys) {
        // the object has the same structure => update tree object
        let dirty = false;
        Object.keys(rawChildren).forEach(key => {
          const newItem = updateChildren(prevTree.children[key], rawChildren[key], parent);
          if (dirty === false && newItem.dirty) {
            dirty = true;
          }
          prevTree.children[key] = newItem;
        });
        prevTree.dirty = dirty;
        if (dirty) {
          // Update value
          prevTree.value = mapObject(prevTree.children, v => v.value);
        }
        return prevTree;
      }
      // keys have changed => build new tree
      const children = mapObject(rawChildren, (val, key) => {
        const prevItem = prevTree.children[key];
        return prevItem
          ? updateChildren(prevItem, val, parent)
          : mountChildren(rawChildren[key], parent);
      });
      const value = mapObject(children, v => v.value);
      const nextTree: TreeElementObject = {
        type: 'OBJECT',
        children,
        value,
        previous: prevTree,
        dirty: true,
      };
      return nextTree;
    }
    // not a the same structure
    const nextTree = mountChildren(rawChildren, parent);
    nextTree.previous = prevTree;
    return nextTree;
  }
  if (prevTree.type === 'ARRAY') {
    if (Array.isArray(rawChildren)) {
      const sameStructure = sameArrayStructure(prevTree.children, rawChildren);
      if (sameStructure) {
        let dirty = false;
        prevTree.children = rawChildren.map((child, index) => {
          const newItem = updateChildren(prevTree.children[index], child, parent);
          if (dirty === false && newItem.dirty) {
            dirty = true;
          }
          return newItem;
        });
        prevTree.dirty = dirty;
        if (dirty) {
          // Update value
          prevTree.value = prevTree.children.map(v => v.value);
        }
        return prevTree;
      }
      const prevKeys = prevTree.children.map(item =>
        item.type === 'CHILD' ? item.element.key : undefined
      );
      const children = rawChildren.map((item, index) => {
        const key = isValidElement(item) ? item.key : undefined;
        const prevIndex =
          key === undefined ? index : prevKeys.indexOf(key) >= 0 ? prevKeys.indexOf(key) : index;
        const prev = prevTree.children[prevIndex];
        if (!prev) {
          return mountChildren(item, parent);
        }
        return updateChildren(prev, item, parent);
      });
      const value = children.map(v => v.value);
      // rebuild array
      const nextTree: TreeElementArray = {
        type: 'ARRAY',
        children,
        value,
        previous: prevTree,
        dirty: true,
      };
      return nextTree;
    }
    // not an array anymore
    const nextTree = mountChildren(rawChildren, parent);
    nextTree.previous = prevTree;
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

// function traverse(
//   tree: TreeElement,
//   onElement: (element: TreeElement, next: () => void) => void
// ): void {
//   if (tree.type === 'NULL') {
//     return;
//   }
//   if (tree.type === 'CHILD') {
//     onElement(tree, ());
//     return;
//   }
//   if (tree.type === 'ARRAY') {
//     tree.children.forEach(item => traverse(item, onElement));
//     return;
//   }
//   if (tree.type === 'OBJECT') {
//     Object.keys(tree.children).forEach(key => traverse(tree.children[key], onElement));
//     return;
//   }
//   throw new Error('Invalid tree element');
// }
