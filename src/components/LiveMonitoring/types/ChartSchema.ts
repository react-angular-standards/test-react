/** @format */

import type { AxisYConfig } from "../config/chartConfig";

export interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  color?: string;
  lineColor?: string;
  markerColor?: string;
  markerType?: string;
  axisYIndex?: number;
  axisYType?: string;
  dataPoints: { x: Date; y: number }[];
}

export interface PlotOptions {
  id: string;
  options?: {
    animationEnabled?: boolean;
    zoomEnabled?: boolean;
    zoomType?: string;
    theme?: string;
    title?: { text: string; fontSize: number };
    axisX?: {
      title?: string;
      valueFormatString?: string;
      labelAngle?: number;
      titleFontSize?: number;
      gridThickness?: number;
      labelAutoFit?: boolean;
      lineThickness?: number;
      labelFontSize?: number;
      viewportMinimum?: number | null;
      viewportMaximum?: number | null;
    };
    axisY?: AxisYConfig | AxisYConfig[];
    axisY2?: AxisYConfig[];
    legend?: {
      cursor?: string;
      fontSize?: number;
      itemclick?: (e: any) => boolean;
    };
    data?: SeriesData[];
    width?: number;
    height?: number;
    rangeChanged?: (e: any) => void;
  };
  width: number;
  height: number;
}

export interface ChartInstance {
  options: PlotOptions["options"];
  render: () => void;
}
