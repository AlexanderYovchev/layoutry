import type { MockSelectedElement } from "@/features/inspector/types/inspector";

/**
 * Static demonstration data for the Inspector's selected-element state.
 * Not connected to the canvas — real element selection is a future
 * checkpoint. Used to validate the Inspector's information architecture
 * (element summary, collapsible sections, placeholder controls) before
 * any real CSS editing exists.
 */
export const mockContainerElement: MockSelectedElement = {
  name: "Container",
  tag: "<div>",
  sections: [
    {
      id: "layout",
      label: "Layout",
      defaultOpen: true,
      rows: [
        { kind: "field", id: "display", label: "Display", value: "Block" },
        { kind: "field", id: "direction", label: "Direction", value: "Row" },
        {
          kind: "segmented",
          id: "alignment",
          label: "Alignment",
          options: ["Start", "Center", "End"],
          activeOption: "Start",
        },
      ],
    },
    {
      id: "size",
      label: "Size",
      defaultOpen: true,
      rows: [
        { kind: "field", id: "width", label: "Width", value: "Auto" },
        { kind: "field", id: "height", label: "Height", value: "Auto" },
        { kind: "field", id: "min-width", label: "Min Width", value: "—" },
        { kind: "field", id: "max-width", label: "Max Width", value: "None" },
      ],
    },
    {
      id: "spacing",
      label: "Spacing",
      defaultOpen: false,
      rows: [
        { kind: "field", id: "padding", label: "Padding", value: "—" },
        { kind: "field", id: "margin", label: "Margin", value: "—" },
      ],
    },
    {
      id: "background",
      label: "Background",
      defaultOpen: false,
      rows: [
        { kind: "field", id: "bg-color", label: "Color", value: "—" },
        { kind: "field", id: "bg-image", label: "Image", value: "None" },
      ],
    },
    {
      id: "border",
      label: "Border",
      defaultOpen: false,
      rows: [
        { kind: "field", id: "border-width", label: "Width", value: "0" },
        { kind: "field", id: "border-radius", label: "Radius", value: "0" },
      ],
    },
    {
      id: "effects",
      label: "Effects",
      defaultOpen: false,
      rows: [
        { kind: "field", id: "shadow", label: "Shadow", value: "None" },
        { kind: "field", id: "opacity", label: "Opacity", value: "100%" },
      ],
    },
    {
      id: "advanced",
      label: "Advanced",
      defaultOpen: false,
      rows: [
        { kind: "field", id: "class", label: "Class", value: "—" },
        { kind: "field", id: "id", label: "ID", value: "—" },
      ],
    },
  ],
};
