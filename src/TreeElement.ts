import { DemocratElement, Instance } from './types';

export type TreeElementState = 'created' | 'stable' | 'updated' | 'removed';

type TreeElementCommon = {
  id: number;
  previous: TreeElement | null;
  value: any;
  state: TreeElementState;
};

type TreeElementData = {
  NULL: {};
  CHILD: {
    element: DemocratElement<any, any>;
    instance: Instance;
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

const nextId = (() => {
  let id = 0;
  return () => id++;
})();

export function createTreeElement<T extends TreeElementType>(
  type: T,
  data: Pick<TreeElementCommon, 'value' | 'previous'> & TreeElementData[T]
): TreeElement<T> {
  return {
    type,
    id: nextId(),
    state: 'created',
    ...data,
  } as any;
}
