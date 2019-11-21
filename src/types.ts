import { SubscribeMethod } from 'suub';
import { DEMOCRAT_ELEMENT, DEMOCRAT_INSTANCE } from './symbols';
import { TreeElement } from './ChildrenUtils';

export type Dispatch<A> = (value: A) => void;
export type SetStateAction<S> = S | ((prevState: S) => S);
export type DependencyList = ReadonlyArray<any>;
export type EffectCleanup = () => void | undefined;
export type EffectCallback = () => void | EffectCleanup;
// interface MutableRefObject<T> {
//   current: T;
// }

export interface Store<S> {
  getState: () => S;
  subscribe: SubscribeMethod<void>;
}

export type Key = string | number | undefined;

export interface DemocratElement<P, T> {
  [DEMOCRAT_ELEMENT]: true;
  component: Component<P, T>;
  props: P;
  key: Key;
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
  children: TreeElement;
}

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

export type HooksData =
  | StateHookData
  | ChildrenHookData
  | EffectHookData
  | MemoHookData
  | LayoutEffectHookData;

export type OnIdleExec = (render: () => void) => void;
export type OnIdle = (exec: OnIdleExec) => void;

export interface Instance {
  [DEMOCRAT_INSTANCE]: true;
  id: number;
  parent: null | Instance;
  hooks: Array<HooksData> | null;
  nextHooks: Array<HooksData>;
  onIdle: OnIdle;
  key: Key;
  dirty: boolean;
}

export type InternalState = {
  rendering: null | Instance;
  effects: null | Instance;
};

export type Props<P> = P & { key?: string | number };

export type Component<P, S> = (props: Props<P>) => S;

export type AllOptional<P = {}> = {} extends P ? true : P extends Required<P> ? false : true;
