import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

function isHeadingTag(tag: string): tag is HeadingTag {
  return (HEADING_TAGS as readonly string[]).includes(tag);
}

export function HeadingElement({ node, parentId }: DocumentElementProps) {
  const Tag = isHeadingTag(node.tag) ? node.tag : "h2";

  return (
    <Tag
      {...documentNodeAttributes(node, parentId)}
      className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
    >
      {node.text}
    </Tag>
  );
}
