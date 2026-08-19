import { BodyElement } from "@/features/canvas/components/document/elements/BodyElement";
import { ButtonElement } from "@/features/canvas/components/document/elements/ButtonElement";
import { ContainerElement } from "@/features/canvas/components/document/elements/ContainerElement";
import { DocumentRootElement } from "@/features/canvas/components/document/elements/DocumentRootElement";
import { HeadingElement } from "@/features/canvas/components/document/elements/HeadingElement";
import { ImageElement } from "@/features/canvas/components/document/elements/ImageElement";
import { LinkElement } from "@/features/canvas/components/document/elements/LinkElement";
import { ParagraphElement } from "@/features/canvas/components/document/elements/ParagraphElement";
import type { DocumentElementComponent } from "@/features/canvas/types/documentRenderer";

/**
 * Tag-to-component lookup driving the canvas renderer — adding a new node
 * type is a new entry here plus its element component, never a switch
 * statement. Tags without an entry fall back to FallbackElement in
 * DocumentNodeRenderer.
 */
export const documentNodeComponents: Record<string, DocumentElementComponent> =
  {
    page: DocumentRootElement,
    body: BodyElement,
    div: ContainerElement,
    section: ContainerElement,
    h1: HeadingElement,
    h2: HeadingElement,
    h3: HeadingElement,
    h4: HeadingElement,
    h5: HeadingElement,
    h6: HeadingElement,
    p: ParagraphElement,
    button: ButtonElement,
    img: ImageElement,
    a: LinkElement,
  };
