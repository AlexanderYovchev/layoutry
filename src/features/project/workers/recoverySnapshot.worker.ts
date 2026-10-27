import { handleSnapshotRequest } from "@/features/project/workers/snapshotWorkerProtocol";

/**
 * The recovery snapshot worker (PROJECT-1.5): serializes, self-checks and
 * hashes a captured project off the editor's main thread. Stateless — every
 * message is one complete, independent request.
 */
globalThis.addEventListener("message", (event: MessageEvent<unknown>) => {
  void handleSnapshotRequest(event.data).then((response) => {
    if (response) globalThis.postMessage(response);
  });
});
