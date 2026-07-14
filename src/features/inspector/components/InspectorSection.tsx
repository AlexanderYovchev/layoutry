"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InspectorSectionProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function InspectorSection({
  label,
  isOpen,
  onToggle,
  children,
}: InspectorSectionProps) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-400 uppercase hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isOpen && "rotate-90",
          )}
        />
        {label}
      </button>
      {isOpen && (
        <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>
      )}
    </div>
  );
}
