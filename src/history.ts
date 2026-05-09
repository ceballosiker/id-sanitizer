export interface History<T> {
  push(snapshot: T): void;
  undo(): T | undefined;
  redo(): T | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  reset(): void;
}

export function createHistory<T>(maxEntries: number): History<T> {
  let past: T[] = [];
  let future: T[] = [];

  return {
    push(snapshot: T): void {
      past.push(snapshot);
      future = [];
      if (past.length > maxEntries) past.shift();
    },

    undo(): T | undefined {
      if (past.length <= 1) return undefined;
      const popped = past.pop()!;
      future.push(popped);
      return past[past.length - 1];
    },

    redo(): T | undefined {
      if (future.length === 0) return undefined;
      const next = future.pop()!;
      past.push(next);
      if (past.length > maxEntries) past.shift();
      return next;
    },

    canUndo(): boolean {
      return past.length > 1;
    },

    canRedo(): boolean {
      return future.length > 0;
    },

    reset(): void {
      past = [];
      future = [];
    },
  };
}
