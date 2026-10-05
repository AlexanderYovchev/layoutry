import { AudioElement } from "@/features/canvas/components/document/elements/AudioElement";
import { BodyElement } from "@/features/canvas/components/document/elements/BodyElement";
import { ButtonElement } from "@/features/canvas/components/document/elements/ButtonElement";
import { CaptionElement } from "@/features/canvas/components/document/elements/CaptionElement";
import { ContainerElement } from "@/features/canvas/components/document/elements/ContainerElement";
import { DialogElement } from "@/features/canvas/components/document/elements/DialogElement";
import { DividerElement } from "@/features/canvas/components/document/elements/DividerElement";
import { DocumentRootElement } from "@/features/canvas/components/document/elements/DocumentRootElement";
import { FigcaptionElement } from "@/features/canvas/components/document/elements/FigcaptionElement";
import { HeadingElement } from "@/features/canvas/components/document/elements/HeadingElement";
import { IframeElement } from "@/features/canvas/components/document/elements/IframeElement";
import { ImageElement } from "@/features/canvas/components/document/elements/ImageElement";
import { InputElement } from "@/features/canvas/components/document/elements/InputElement";
import { LegendElement } from "@/features/canvas/components/document/elements/LegendElement";
import { LinkElement } from "@/features/canvas/components/document/elements/LinkElement";
import { ListItemElement } from "@/features/canvas/components/document/elements/ListItemElement";
import { OptionElement } from "@/features/canvas/components/document/elements/OptionElement";
import { ParagraphElement } from "@/features/canvas/components/document/elements/ParagraphElement";
import { ProgressElement } from "@/features/canvas/components/document/elements/ProgressElement";
import { SelectElement } from "@/features/canvas/components/document/elements/SelectElement";
import { SvgElement } from "@/features/canvas/components/document/elements/SvgElement";
import { TableCellElement } from "@/features/canvas/components/document/elements/TableCellElement";
import { TableElement } from "@/features/canvas/components/document/elements/TableElement";
import { TableRowElement } from "@/features/canvas/components/document/elements/TableRowElement";
import { TableSectionElement } from "@/features/canvas/components/document/elements/TableSectionElement";
import { TextareaElement } from "@/features/canvas/components/document/elements/TextareaElement";
import { VideoElement } from "@/features/canvas/components/document/elements/VideoElement";
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
    ul: ContainerElement,
    ol: ContainerElement,
    li: ListItemElement,
    header: ContainerElement,
    nav: ContainerElement,
    main: ContainerElement,
    article: ContainerElement,
    aside: ContainerElement,
    footer: ContainerElement,
    form: ContainerElement,
    label: ContainerElement,
    input: InputElement,
    textarea: TextareaElement,
    select: SelectElement,
    option: OptionElement,
    table: TableElement,
    caption: CaptionElement,
    thead: TableSectionElement,
    tbody: TableSectionElement,
    tfoot: TableSectionElement,
    tr: TableRowElement,
    th: TableCellElement,
    td: TableCellElement,
    video: VideoElement,
    audio: AudioElement,
    iframe: IframeElement,
    svg: SvgElement,
    dialog: DialogElement,
    hr: DividerElement,
    fieldset: ContainerElement,
    legend: LegendElement,
    figure: ContainerElement,
    figcaption: FigcaptionElement,
    progress: ProgressElement,
  };
