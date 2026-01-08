/** @format */

export interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  axisYIndex?: number;
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
    axisY?:
      | {
          title?: string;
          titleFontSize?: number;
          labelFontSize?: number;
          gridThickness?: number;
          interlacedColor?: string;
          lineThickness?: number;
          lineColor?: string;
          tickColor?: string;
          labelFontColor?: string;
          opposite?: boolean;
        }
      | Array<{
          title?: string;
          titleFontSize?: number;
          labelFontSize?: number;
          gridThickness?: number;
          interlacedColor?: string;
          lineThickness?: number;
          lineColor?: string;
          tickColor?: string;
          labelFontColor?: string;
          opposite?: boolean;
        }>;
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
