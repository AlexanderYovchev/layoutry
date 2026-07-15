import { Dialog } from "@/components/ui/Dialog";
import type { HelpDialogId } from "@/components/layout/applicationMenus";

interface HelpDialogsProps {
  openDialogId: HelpDialogId | null;
  onClose: () => void;
}

export function HelpDialogs({ openDialogId, onClose }: HelpDialogsProps) {
  return (
    <>
      <Dialog
        open={openDialogId === "getting-started"}
        onClose={onClose}
        title="Getting Started"
      >
        <ul className="list-disc space-y-2 pl-4">
          <li>
            The Creation Toolbar reserves space for elements you&apos;ll be able
            to add.
          </li>
          <li>
            The Resource Panel will hold elements, components, and templates.
          </li>
          <li>
            The Inspector will show editable properties once you can select
            something.
          </li>
        </ul>
        <p className="mt-3 text-zinc-500 dark:text-zinc-400">
          Layoutry is still in active development — most menu commands are
          placeholders until their underlying systems are built.
        </p>
      </Dialog>

      <Dialog
        open={openDialogId === "keyboard-shortcuts"}
        onClose={onClose}
        title="Keyboard Shortcuts"
      >
        <p className="mb-3">
          This is an initial shortcut reference. These labels reflect planned
          shortcuts and are not yet registered as active keyboard commands.
        </p>
        <dl className="space-y-1.5">
          {[
            { label: "Save", keys: "Ctrl+S" },
            { label: "Undo", keys: "Ctrl+Z" },
            { label: "Redo", keys: "Ctrl+Shift+Z" },
            { label: "Copy", keys: "Ctrl+C" },
            { label: "Paste", keys: "Ctrl+V" },
          ].map(({ label, keys }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4"
            >
              <dt>{label}</dt>
              <dd className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs dark:border-zinc-800">
                {keys}
              </dd>
            </div>
          ))}
        </dl>
      </Dialog>

      <Dialog
        open={openDialogId === "about"}
        onClose={onClose}
        title="About Layoutry"
      >
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Layoutry</p>
        <p>Build layouts visually. Own the code.</p>
        <p className="mt-3 text-zinc-500 dark:text-zinc-400">
          Version 0.1.0 — development preview.
        </p>
      </Dialog>
    </>
  );
}
