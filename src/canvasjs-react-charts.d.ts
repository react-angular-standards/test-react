declare module 'canvasjs-react-charts' {
  import * as React from 'react';
  interface CanvasJSChartProps {
    options: any;
    onRef?: (ref: any) => void;
  }
  export class CanvasJSChart extends React.Component<CanvasJSChartProps & { ref?: React.Ref<any> }> {}
  const CanvasJS: any;
  export default CanvasJS;
}
