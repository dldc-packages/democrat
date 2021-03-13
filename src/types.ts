/* istanbul ignore next */
import { DEMOCRAT_ELEMENT, DEMOCRAT_CONTEXT, DEMOCRAT_ROOT, DEMOCRAT_COMPONENT } from './symbols';

export type Dispatch<A> = (value: A) => void;
export type SetStateAction<S> = S | ((prevState: S) => S);
export type DependencyList = ReadonlyArray<any>;
export type EffectCleanup = () => void | undefined;
export type EffectCallback = () => void | EffectCleanup;

export interface MutableRefObject<T> {
  current: T;
}

export type EffectType = 'EFFECT' | 'LAYOUT_EFFECT';

export interface StatePatch {
  path: Array<TreeElementPath>;
  type: 'STATE';
  hookIndex: number;
  value: any;
}

export interface ReducerPatch {
  path: Array<TreeElementPath>;
  type: 'REDUCER';
  hookIndex: number;
  action: any;
}

export type Patch = StatePatch | ReducerPatch;

export type Patches = Array<Patch>;

export type Key = string | number | undefined;

export interface DemocratContextProvider<P> {
  [DEMOCRAT_CONTEXT]: 'PROVIDER';
  context: Context<P>;
  createElement: <T>(
    props: ContextProviderProps<P, T>,
    key?: Key
  ) => ElementProvider<ResolveType<T>>;
}

export type ContextProviderProps<P, T> = {
  value: P;
  children: T;
};

export type FunctionComponent<P, T> = (props: P) => T;

export type Factory<P, T> = {
  Component: FunctionComponent<P, T>;
  [DEMOCRAT_COMPONENT]: true;
  createElement: P extends void
    ? (props?: undefined | {}, key?: Key) => ElementComponent<T>
    : (props: P, key?: Key) => ElementComponent<T>;
  useChildren: P extends void
    ? (props?: undefined | {}, key?: Key) => T
    : (props: P, key?: Key) => T;
};

export type GenericFactory<Fn extends FunctionComponent<any, any>> = {
  Component: Fn;
  [DEMOCRAT_COMPONENT]: true;
  createElement: <R>(runner: (create: Fn) => R, key?: Key) => ElementComponent<R>;
  useChildren: <R>(runner: (create: Fn) => R, key?: Key) => R;
};

export type AnyProps = { [key: string]: any };

export interface ElementComponent<T> {
  [DEMOCRAT_ELEMENT]: true;
  type: FunctionComponent<unknown, T>;
  props: AnyProps;
  key: Key;
}

export interface ElementProvider<T> {
  [DEMOCRAT_ELEMENT]: true;
  type: DemocratContextProvider<unknown>;
  props: ContextProviderProps<unknown, T>;
  key: Key;
}

export type Element<T> = ElementComponent<T> | ElementProvider<T>;

export interface DemocratRootElement {
  [DEMOCRAT_ELEMENT]: true;
  [DEMOCRAT_ROOT]: true;
  children: Children;
}

export interface Context<T, HasDefault extends boolean = boolean> {
  [DEMOCRAT_CONTEXT]: {
    hasDefault: HasDefault;
    defaultValue: T;
  };
  Provider: DemocratContextProvider<T>;
}

export type Children =
  | Element<any>
  | null
  | Array<Children>
  | Map<any, Children>
  | { [key: string]: Children };

export type ResolveType<C> = C extends Element<infer T>
  ? T
  : C extends null
  ? null
  : C extends Array<infer T>
  ? Array<ResolveType<T>>
  : C extends Map<infer K, infer V>
  ? Map<K, ResolveType<V>>
  : C extends { [key: string]: Children }
  ? { [K in keyof C]: ResolveType<C[K]> }
  : never;

export interface StateHookData {
  type: 'STATE';
  value: any;
  setValue: Dispatch<SetStateAction<any>>;
}

export interface ReducerHookData {
  type: 'REDUCER';
  value: any;
  dispatch: Dispatch<ReducerAction<any>>;
  reducer: Reducer<any, any>;
}

export interface ChildrenHookData {
  type: 'CHILDREN';
  tree: TreeElement;
  path: TreeElementPath<'CHILD'>;
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
  | ReducerHookData
  | ChildrenHookData
  | EffectHookData
  | MemoHookData
  | LayoutEffectHookData
  | RefHookData
  | ContextHookData;

export type OnIdleExec = () => void;
export type OnIdle = (exec: OnIdleExec) => void;

export type TreeElementState = 'created' | 'stable' | 'updated' | 'removed';

export type TreeElementCommon = {
  id: number;
  parent: TreeElement;
  path: TreeElementPath;
  // when structure change we keep the previous one to cleanup
  previous: TreeElement | null;
  value: any;
  state: TreeElementState;
  root: TreeElement<'ROOT'>;
};

export type TreeElementData = {
  ROOT: {
    onIdle: OnIdle;
    mounted: boolean;
    passiveMode: boolean;
    children: TreeElement;
    context: Map<Context<any>, Set<TreeElement<'CHILD'>>>;
    requestRender: (pathch: Patch | null) => void;
    supportReactHooks: (ReactInstance: any, Hooks: any) => void;
    isRendering: () => boolean;
    applyPatches: (patches: Patches) => void;
    findProvider: (context: Context<any>) => TreeElement<'PROVIDER'> | null;
    markDirty: (instance: TreeElement<'CHILD'>, limit?: TreeElement | null) => void;
    withGlobalRenderingInstance: <T>(current: TreeElement, exec: () => T) => T;
    getCurrentRenderingChildInstance: () => TreeElement<'CHILD'>;
    getCurrentHook: () => HooksData | null;
    getCurrentHookIndex: () => number;
    setCurrentHook: (hook: HooksData) => void;
  };
  NULL: {};
  PROVIDER: {
    element: ElementProvider<any>;
    children: TreeElement;
  };
  CHILD: {
    snapshot: TreeElementSnapshot<'CHILD'> | undefined;
    element: ElementComponent<any>;
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
};

export type TreeElementType = keyof TreeElementData;

type TreeElementResolved = {
  [K in keyof TreeElementData]: TreeElementCommon & {
    type: K;
  } & TreeElementData[K];
};

export type TreeElement<K extends TreeElementType = TreeElementType> = TreeElementResolved[K];

type CreateTreeElementMap<T extends { [K in TreeElementType]: any }> = T;

export type TreeElementRaw = CreateTreeElementMap<{
  ROOT: DemocratRootElement;
  NULL: null;
  CHILD: ElementComponent<any>;
  PROVIDER: ElementProvider<any>;
  ARRAY: Array<any>;
  OBJECT: { [key: string]: any };
  MAP: Map<any, any>;
}>;

type TreeElementPathData = CreateTreeElementMap<{
  ROOT: {};
  NULL: {};
  CHILD: {
    hookIndex: number;
  };
  PROVIDER: {};
  ARRAY: { index: number };
  OBJECT: { objectKey: string };
  MAP: { mapKey: any };
}>;

type TreeElementPathResolved = {
  [K in keyof TreeElementData]: {
    type: K;
  } & TreeElementPathData[K];
};

export type TreeElementPath<
  K extends TreeElementType = TreeElementType
> = TreeElementPathResolved[K];

export type HookSnapshot =
  | { type: 'CHILDREN'; child: TreeElementSnapshot }
  | { type: 'STATE'; value: any }
  | { type: 'REDUCER'; value: any }
  | null;

type TreeElementSnapshotData = CreateTreeElementMap<{
  ROOT: {
    children: TreeElementSnapshot;
  };
  NULL: {};
  CHILD: {
    hooks: Array<HookSnapshot>;
  };
  PROVIDER: {
    children: TreeElementSnapshot;
  };
  ARRAY: { children: Array<TreeElementSnapshot> };
  OBJECT: { children: { [key: string]: TreeElementSnapshot } };
  MAP: { children: Map<any, TreeElementSnapshot> };
}>;

type TreeElementSnapshotResolved = {
  [K in keyof TreeElementData]: {
    type: K;
  } & TreeElementSnapshotData[K];
};

export type TreeElementSnapshot<
  K extends TreeElementType = TreeElementType
> = TreeElementSnapshotResolved[K];

export type Snapshot = TreeElementSnapshot<'ROOT'>;

export type ReducerWithoutAction<S> = (prevState: S) => S;
export type ReducerStateWithoutAction<
  R extends ReducerWithoutAction<any>
> = R extends ReducerWithoutAction<infer S> ? S : never;
export type DispatchWithoutAction = () => void;
export type Reducer<S, A> = (prevState: S, action: A) => S;
export type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
export type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A>
  ? A
  : never;
