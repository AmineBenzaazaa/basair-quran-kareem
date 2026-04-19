import { useSyncExternalStore } from "react";

let contentVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return contentVersion;
}

export function bumpContentVersion() {
  contentVersion += 1;
  listeners.forEach((listener) => listener());
}

export function useContentVersion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
