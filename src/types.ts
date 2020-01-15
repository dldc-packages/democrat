import { DEMOCRAT_ELEMENT, DEMOCRAT_CONTEXT, DEMOCRAT_ROOT } from './symbols';

export type Dispatch<A> = (value: A) => void;
export type SetStateAction<S> = S | ((prevState: S) => S);
export type DependencyList = ReadonlyArray<any>;
export type EffectCleanup = () => void | undefined;
export type EffectCallback = () => void | EffectCleanup;

export interface MutableRefObject<T> {
  current: T;
}

export type EffectType = 'EFFECT' | 'LAYOUT_EFFECT';

type Unsubscribe = () => void;

export interface Store<S> {
  getState: () => S;
  subscribe: (onChange: () => void) => Unsubscribe;
  destroy: () => void;
}

export type Key = string | number | undefined;

export interface DemocratContextProvider<P> {
  [DEMOCRAT_CONTEXT]: 'PROVIDER';
  context: Context<P>;
}

export type ContextConsumerRender<T, HasDefault extends boolean, C> = (
  value: HasDefault extends true ? T : T | undefined
) => C;

export interface DemocratContextConsumer<P> {
  [DEMOCRAT_CONTEXT]: 'CONSUMER';
  context: Context<P>;
}

export type ContextProviderProps<P, T> = Props<{
  value: P;
  children: T;
}>;

export type ContextConsumerProps<P, T> = Props<{
  children: ContextConsumerRender<P, boolean, T>;
}>;

export interface DemocratElementComponent<P, T> {
  [DEMOCRAT_ELEMENT]: true;
  type: Component<P, T>;
  props: P;
  key: Key;
}

export interface DemocratElementProvider<P, T> {
  [DEMOCRAT_ELEMENT]: true;
  type: DemocratContextProvider<P>;
  props: ContextProviderProps<P, T>;
  key: Key;
}

export interface DemocratElementConsumer<P, T> {
  [DEMOCRAT_ELEMENT]: true;
  type: DemocratContextConsumer<P>;
  props: ContextConsumerProps<P, T>;
  key: Key;
}

export interface DemocratRootElement {
  [DEMOCRAT_ELEMENT]: true;
  [DEMOCRAT_ROOT]: true;
  children: Children;
}

/**
 * For components: P is Props, T is return type
 * For contexts: P is Context value, T is return type
 */
export type DemocratElement<P, T> =
  | DemocratElementComponent<P, T>
  | DemocratElementProvider<P, T>
  | DemocratElementConsumer<P, T>;

export interface Context<T, HasDefault extends boolean = boolean> {
  [DEMOCRAT_CONTEXT]: {
    hasDefault: HasDefault;
    defaultValue: T;
  };
  Consumer: DemocratContextConsumer<T>;
  Provider: DemocratContextProvider<T>;
}

export type Children =
  | DemocratElement<any, any>
  | null
  | Array<Children>
  | { [key: string]: Children };

export type ResolveType<C> = C extends DemocratElement<any, infer T>
  ? T
  : C extends null
  ? null
  : C extends Array<infer T>
  ? Array<ResolveType<T>>
  : C extends { [key: string]: Children }
  ? { [K in keyof C]: ResolveType<C[K]> }
  : never;

export interface StateHookData {
  type: 'STATE';
  value: any;
  setValue: Dispatch<SetStateAction<any>>;
}

export interface ChildrenHookData {
  type: 'CHILDREN';
  tree: TreeElement;
}

export type RefHookData = {
  type: 'REF';
  ref: MutableRefObject<any>;
};

export type EffectHookData = {
  type: 'EFFECT';
  effect: EffectCallback;
  cleanup: undefined | EffectCleanup;
  deps: DependencyList | undefined;
  dirty: boolean;
};

export type LayoutEffectHookData = {
  type: 'LAYOUT_EFFECT';
  effect: EffectCallback;
  cleanup: undefined | EffectCleanup;
  deps: DependencyList | undefined;
  dirty: boolean;
};

export type MemoHookData = {
  type: 'MEMO';
  value: any;
  deps: DependencyList | undefined;
};

export type ContextHookData = {
  type: 'CONTEXT';
  context: Context<any>;
  provider: TreeElement<'PROVIDER'> | null;
  value: any;
};

export type HooksData =
  | StateHookData
  | ChildrenHookData
  | EffectHookData
  | MemoHookData
  | LayoutEffectHookData
  | RefHookData
  | ContextHookData;

export type OnIdleExec = () => void;
export type OnIdle = (exec: OnIdleExec) => void;

export type InternalState = {
  rendering: null | TreeElement;
  effects: null | TreeElement;
  reactHooksSupported: boolean;
};

export type Props<P> = P & { key?: string | number };

export type Component<P, S> = (props: Props<P>) => S;

export type AllOptional<P = {}> = {} extends P ? true : P extends Required<P> ? false : true;

export type TreeElementState = 'created' | 'stable' | 'updated' | 'removed';

export type TreeElementCommon = {
  id: number;
  parent: TreeElement;
  previous: TreeElement | null;
  value: any;
  state: TreeElementState;
  root: TreeElement<'ROOT'>;
};

export type TreeElementData = {
  ROOT: {
    onIdle: OnIdle;
    requestRender: () => void;
    mounted: boolean;
    children: TreeElement;
    context: Map<Context<any>, Set<TreeElement<'CHILD'>>>;
  };
  NULL: {};
  PROVIDER: {
    element: DemocratElementProvider<any, any>;
    children: TreeElement;
  };
  CONSUMER: {
    element: DemocratElementConsumer<any, any>;
  };
  CHILD: {
    element: DemocratElementComponent<any, any>;
    hooks: Array<HooksData> | null;
    nextHooks: Array<HooksData>;
    // is set to true when the component or one of it's children has a new state
    // and thus need to be rendered even if props are equal
    dirty: boolean;
  };
  OBJECT: { children: { [key: string]: TreeElement } };
  ARRAY: { children: Array<TreeElement> };
  MAP: {
    children: Map<any, TreeElement>;
  };
  SET: {
    children: Set<TreeElement>;
  };
};

type TreeElementResolved = {
  [K in keyof TreeElementData]: TreeElementCommon & {
    type: K;
  } & TreeElementData[K];
};

export type TreeElementType = keyof TreeElementResolved;

export type TreeElement<K extends TreeElementType = TreeElementType> = TreeElementResolved[K];
