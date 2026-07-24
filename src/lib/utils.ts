import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Combines multiple callback refs into one, for elements that need refs from more than one hook (e.g. dnd-kit's draggable and droppable). */
export function mergeRefs<T>(
  ...refs: Array<((element: T | null) => void) | undefined>
) {
  return (element: T | null) => {
    for (const ref of refs) {
      ref?.(element);
    }
  };
}
