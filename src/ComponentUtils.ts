import { Instance, DemocratElement } from './types';
import { getInternalState } from './Global';
import { ChildrenUtils } from './ChildrenUtils';

export const ComponentUtils = {
  render: renderComponent,
  executeEffect,
  executeLayoutEffect,
};

function renderComponent<P, T>(
  element: DemocratElement<P, T>,
  instance: Instance,
  parent: Instance | null
): T {
  return withGlobalRenderingInstance(
    instance,
    () => {
      beforeRender(instance);
      const result = element.component(element.props);
      afterRender(instance);
      return result;
    },
    parent
  );
}

function withGlobalRenderingInstance<T>(
  current: Instance,
  exec: () => T,
  expectedParent: Instance | null
): T {
  if (getInternalState().rendering !== expectedParent) {
    throw new Error('Invalid parent !');
  }
  getInternalState().rendering = current;
  const result = exec();
  getInternalState().rendering = expectedParent;
  return result;
}

function runCleanupOfInstance(
  instance: Instance,
  parent: Instance | null,
  type: 'EFFECT' | 'LAYOUT_EFFECT',
  force: boolean
) {
  withGlobaleEffectsInstance(
    instance,
    () => {
      if (instance.hooks) {
        instance.hooks.forEach(hook => {
          if (hook.type === type && hook.cleanup && (hook.dirty || force)) {
            hook.cleanup();
          }
          if (hook.type === 'CHILDREN') {
            ChildrenUtils.cleanup(hook.children, type, (subInstance, force) => {
              runCleanupOfInstance(subInstance, instance, type, force);
            });
          }
        });
      }
    },
    parent
  );
}

function runEffectsOfInstance(
  instance: Instance,
  parent: Instance | null,
  type: 'EFFECT' | 'LAYOUT_EFFECT'
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
              ChildrenUtils.effects(hook.children, type, subInstance => {
                runEffectsOfInstance(subInstance, instance, type);
              });
            }
          }
        });
      }
    },
    parent
  );
}

function executeEffect(instance: Instance) {
  executeEffectInternal(instance, 'EFFECT');
}

function executeLayoutEffect(instance: Instance) {
  executeEffectInternal(instance, 'LAYOUT_EFFECT');
}

function executeEffectInternal(instance: Instance, type: 'EFFECT' | 'LAYOUT_EFFECT') {
  runCleanupOfInstance(instance, null, type, false);
  runEffectsOfInstance(instance, null, type);
}

function withGlobaleEffectsInstance(
  current: Instance,
  exec: () => void,
  expectedParent: Instance | null
) {
  if (getInternalState().effects !== expectedParent) {
    throw new Error('Invalid parent !');
  }
  getInternalState().effects = current;
  exec();
  getInternalState().effects = expectedParent;
}

function beforeRender(instance: Instance) {
  instance.nextHooks = [];
}

function afterRender(instance: Instance) {
  if (instance.hooks) {
    // not first render
    if (instance.hooks.length !== instance.nextHooks.length) {
      throw new Error('Hooks count mismatch !');
    }
  }
  const hooks = instance.nextHooks;
  instance.hooks = hooks;
  instance.dirty = false;
}
