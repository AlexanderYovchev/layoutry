import { z } from "zod";
import { editorElementNodeSchema } from "@/features/editor/schemas/editorDocumentSchema";
import {
  CURRENT_PROJECT_FORMAT_VERSION,
  PROJECT_FILE_FORMAT,
  type ProjectFile,
  type ProjectMetadata,
} from "@/features/project/types/projectFile";

/** Project ids: UUIDs today; the pattern also admits future cloud ids. */
export const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_PROJECT_NAME_LENGTH = 256;

export const projectMetadataSchema = z.strictObject({
  id: z.string().regex(PROJECT_ID_PATTERN, { message: "invalid project id" }),
  name: z
    .string()
    .max(MAX_PROJECT_NAME_LENGTH)
    .refine((name) => name.trim().length > 0, {
      message: "project name must not be empty",
    }),
  createdAt: z.iso.datetime({ message: "timestamps must be ISO 8601 UTC" }),
  updatedAt: z.iso.datetime({ message: "timestamps must be ISO 8601 UTC" }),
});

/** Version 1 envelope. A new format version gets its own schema. */
export const projectFileV1Schema = z.strictObject({
  format: z.literal(PROJECT_FILE_FORMAT),
  formatVersion: z.literal(CURRENT_PROJECT_FORMAT_VERSION),
  project: projectMetadataSchema,
  document: editorElementNodeSchema,
});

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function assertSameType<Condition extends true>(): Condition | undefined {
  return undefined;
}
assertSameType<Equal<z.infer<typeof projectMetadataSchema>, ProjectMetadata>>();
assertSameType<Equal<z.infer<typeof projectFileV1Schema>, ProjectFile>>();
