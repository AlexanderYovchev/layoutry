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
        <p className="text-fg-secondary mt-3">
          Layoutry is still in active development — most menu commands are
          placeholders until their underlying systems are built.
        </p>
      </Dialog>

      <Dialog
        open={openDialogId === "keyboard-shortcuts"}
        onClose={onClose}
        title="Keyboard Shortcuts"
      >
        <p className="mb-3">On macOS, use Cmd instead of Ctrl.</p>
        <dl className="space-y-1.5">
          {[
            { label: "Save", keys: "Ctrl+S" },
            { label: "Save As", keys: "Ctrl+Shift+S" },
            { label: "Open Project", keys: "Ctrl+O" },
            { label: "Undo", keys: "Ctrl+Z" },
            { label: "Redo", keys: "Ctrl+Shift+Z" },
            { label: "Copy", keys: "Ctrl+C" },
            { label: "Paste", keys: "Ctrl+V" },
            { label: "Copy CSS", keys: "Ctrl+Alt+C" },
            { label: "Paste CSS", keys: "Ctrl+Alt+V" },
            { label: "Move up / down (Structure)", keys: "Alt+↑ / Alt+↓" },
            {
              label: "Move into previous / out of parent (Structure)",
              keys: "Alt+→ / Alt+←",
            },
          ].map(({ label, keys }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4"
            >
              <dt>{label}</dt>
              <dd className="rounded-control-sm border-line bg-surface-panel-secondary text-fg-primary border px-1.5 py-0.5 font-mono text-xs">
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
        <p className="text-fg-primary font-medium">Layoutry</p>
        <p>Build layouts visually. Own the code.</p>
        <p className="text-fg-secondary mt-3">
          Version 0.1.0 — development preview.
        </p>
      </Dialog>
    </>
  );
}
