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
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-400 uppercase transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 dark:active:bg-zinc-800"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200 ease-out",
            isOpen && "rotate-90",
          )}
        />
        {label}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div inert={!isOpen} className="flex flex-col gap-2 px-3 pb-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
