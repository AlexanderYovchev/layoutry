export interface InspectorFieldRowData {
  kind: "field";
  id: string;
  label: string;
  value: string;
}

export interface InspectorSegmentedRowData {
  kind: "segmented";
  id: string;
  label: string;
  options: string[];
  activeOption: string;
}

export type InspectorRowData =
  InspectorFieldRowData | InspectorSegmentedRowData;

export interface InspectorSectionData {
  id: string;
  label: string;
  defaultOpen: boolean;
  rows: InspectorRowData[];
}

export interface MockSelectedElement {
  name: string;
  tag: string;
  sections: InspectorSectionData[];
}
