import { Context } from './types';

export interface ContextStack {
  context: Context<any>;
  value: any;
  parent: null | ContextStack;
}

export const ContextStack = {
  add<T>(stack: ContextStack | null, context: Context<T>, value: T): ContextStack {
    return {
      context,
      value,
      parent: stack,
    };
  },
  read<T>(stack: ContextStack | null, ctx: Context<T>): { found: boolean; value: T } {
    if (stack === null) {
      return {
        found: false,
        value: null as any,
      };
    }
    if (stack.context === ctx) {
      return {
        found: true,
        value: stack.value,
      };
    }
    return ContextStack.read(stack.parent, ctx);
  },
  create<T>(context: Context<T>, value: T): ContextStack {
    return {
      context,
      value,
      parent: null,
    };
  },
};
