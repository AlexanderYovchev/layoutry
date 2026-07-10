import { AppHeader } from "@/components/layout/AppHeader";
import { EditorPlaceholder } from "@/features/editor/components/EditorPlaceholder";
import { InspectorPlaceholder } from "@/features/inspector/components/InspectorPlaceholder";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Development foundation operational.
        </p>
        <div className="flex flex-1 gap-4">
          <EditorPlaceholder />
          <InspectorPlaceholder />
        </div>
      </main>
    </div>
  );
}
