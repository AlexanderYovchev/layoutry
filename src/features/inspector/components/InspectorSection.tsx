"use client";

import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
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
  const headerId = useId();
  const panelId = useId();

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      {/* h3: nested beneath the Inspector's own h2 title. */}
      <h3>
        <button
          id={headerId}
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 dark:active:bg-zinc-800"
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
      </h3>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={panelId}
            aria-labelledby={headerId}
            inert={!isOpen}
            className="flex flex-col gap-2 px-3 pb-3"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
