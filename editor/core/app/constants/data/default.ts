import type { FlowExportObject } from '@vue-flow/core'

export const defaultElements: FlowExportObject = {
  nodes: [
    { type: 'fs/select_file', data: { filePath: '' }, events: {}, id: 'select_file_1', position: { x: -13.135234525191606, y: -1040.6521214397108 } },
    { type: 'image/sharp', data: { output: '' }, events: {}, id: 'image/sharp_2', position: { x: 307.62836770101484, y: -1024.899486636552 } },
    { type: 'fs/copy', data: { folderPath: '' }, events: {}, id: 'copy_3', position: { x: 589.674547696762, y: -1020.9402699737475 } },
  ],
  edges: [
    {
      sourceHandle: 'output',
      targetHandle: 'input',
      type: 'default',
      source: 'image/sharp_2',
      target: 'copy_3',
      data: {},
      events: {},
      id: 'vueflow__edge-image/sharp_2output-copy_3input',
      animated: false,
    },
    {
      sourceHandle: 'filePath',
      targetHandle: 'input',
      type: 'default',
      source: 'select_file_1',
      target: 'image/sharp_2',
      data: {},
      events: {},
      id: 'vueflow__edge-select_file_1filePath-image/sharp_2input',
      animated: false,
    },
  ],
  position: [52.82809365310425, 1311.4223380892768],
  zoom: 0.9270861263610717,
  viewport: { x: 52.82809365310425, y: 1311.4223380892768, zoom: 0.9270861263610717 },
}
