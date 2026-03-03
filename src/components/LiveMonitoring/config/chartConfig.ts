/** @format */

// ─────────────────────────────────────────────────────────────────────────────
// chartConfig.ts
// Single source of truth for every CanvasJS chart / axis / legend / series
// default used across LiveMonitoring.
//
// Import what you need:
//   import { AXIS_X_DEFAULTS, makeAxisY, makeSeriesData, DEFAULT_CHART_OPTIONS } from '../config/chartConfig';
// ─────────────────────────────────────────────────────────────────────────────

// ─── Colours ─────────────────────────────────────────────────────────────────

/** Rotating palette used to assign a distinct colour to each new channel. */
export const CHANNEL_COLORS: string[] = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
  "#C9CBCF",
  "#00A896",
  "#F4A261",
  "#E76F51",
];

let _colorCursor = 0;
/** Returns the next colour from the palette (round-robin). */
export const nextChannelColor = (): string =>
  CHANNEL_COLORS[_colorCursor++ % CHANNEL_COLORS.length];

/** Resets the colour cursor — call when all channels are cleared. */
export const resetColorCursor = (): void => {
  _colorCursor = 0;
};

// ─── Fallback colour when no channel colour is available ─────────────────────
export const DEFAULT_AXIS_COLOR = "#369EAD";

// ─── AxisX ───────────────────────────────────────────────────────────────────

export interface AxisXConfig {
  title: string;
  valueFormatString: string;
  labelAngle: number;
  titleFontSize: number;
  gridThickness: number;
  labelAutoFit: boolean;
  lineThickness: number;
  labelFontSize: number;
  viewportMinimum?: number | null;
  viewportMaximum?: number | null;
}

/** Default X-axis (time axis) configuration shared by all charts. */
export const AXIS_X_DEFAULTS: AxisXConfig = {
  title: "Timestamp",
  valueFormatString: "HH:mm:ss",
  labelAngle: 90,
  titleFontSize: 14,
  gridThickness: 0.3,
  labelAutoFit: true,
  lineThickness: 0.5,
  labelFontSize: 14,
};

// ─── AxisY ───────────────────────────────────────────────────────────────────

export interface AxisYConfig {
  title: string;
  titleFontSize: number;
  labelFontSize: number;
  gridThickness: number;
  lineColor: string;
  tickColor: string;
  labelFontColor: string;
  interlacedColor?: string;
  lineThickness?: number;
  opposite?: boolean;
}

/**
 * Builds a primary (left) Y-axis config for the given unit and channel colour.
 * Used as `axisY` in CanvasJS (not axisY2).
 */
export const makePrimaryAxisY = (unit: string, color: string): AxisYConfig => ({
  title: unit,
  titleFontSize: 14,
  labelFontSize: 14,
  gridThickness: 0.4,
  lineColor: color,
  tickColor: color,
  labelFontColor: color,
  interlacedColor: "#F0F8FF",
  lineThickness: 0.5,
});

/**
 * Builds a secondary (right) Y-axis config for the given unit and channel colour.
 * Used as entries in `axisY2` in CanvasJS.
 */
export const makeSecondaryAxisY = (unit: string, color: string): AxisYConfig => ({
  title: unit,
  titleFontSize: 14,
  labelFontSize: 14,
  gridThickness: 0,        // no grid lines for secondary axes — keeps chart clean
  lineColor: color,
  tickColor: color,
  labelFontColor: color,
  lineThickness: 0.5,
});

/**
 * Fallback primary Y-axis used when no channel info is available yet.
 * Colour is the neutral DEFAULT_AXIS_COLOR.
 */
export const FALLBACK_AXIS_Y: AxisYConfig = makePrimaryAxisY("Value", DEFAULT_AXIS_COLOR);

// ─── Legend ──────────────────────────────────────────────────────────────────

export interface LegendConfig {
  cursor: string;
  fontSize: number;
  /** itemclick is wired per-chart in updateChartDataOption — not a static default. */
  itemclick?: (e: any) => boolean;
}

export const LEGEND_DEFAULTS: LegendConfig = {
  cursor: "pointer",
  fontSize: 14,
};

// ─── Series / data-series ────────────────────────────────────────────────────

export interface SeriesDefaults {
  type: string;
  showInLegend: boolean;
  visible: boolean;
  markerType: string;
}

export const SERIES_DEFAULTS: SeriesDefaults = {
  type: "line",
  showInLegend: true,
  visible: true,
  markerType: "none",      // hide per-point markers for dense live data
};

/**
 * Builds the initial SeriesData object pushed into activePlotChannelsRef
 * when a channel is first selected.
 *
 * @param channelId   Numeric string id of the channel.
 * @param label       Human-readable label shown in the legend.
 * @param color       Line and legend swatch colour — MUST be the same value.
 * @param axisYIndex  Index into axisY2 (or -1 / omit for primary axisY).
 * @param showLegend  Whether the legend entry is visible (from enableChartLegend).
 */
export const makeSeriesData = (
  channelId: string,
  label: string,
  color: string,
  axisYIndex: number,
  showLegend: boolean,
) => ({
  ...SERIES_DEFAULTS,
  name: label,
  showInLegend: showLegend,
  // lineColor and color MUST match so the legend swatch = line colour
  color,
  lineColor: color,
  markerColor: color,
  axisYIndex,
  dataPoints: [] as { x: Date; y: number }[],
});

// ─── Full chart options template ─────────────────────────────────────────────

export interface ChartDimensions {
  width: number;
  height: number;
}

/**
 * Returns a complete CanvasJS options object for a new chart panel.
 * Axis, legend, and title defaults are all pulled from the constants above.
 *
 * @param title      Chart title text.
 * @param dimensions Initial pixel width/height.
 */
export const makeDefaultChartOptions = (
  title: string,
  dimensions: ChartDimensions,
) => ({
  animationEnabled: false,
  zoomEnabled: true,
  zoomType: "xy",
  theme: "light2",
  title: {
    text: title,
    fontSize: 16,
  },
  legend: { ...LEGEND_DEFAULTS },
  axisX: { ...AXIS_X_DEFAULTS },
  axisY: FALLBACK_AXIS_Y,
  axisY2: [] as AxisYConfig[],
  data: [] as ReturnType<typeof makeSeriesData>[],
  width: dimensions.width,
  height: dimensions.height,
});

/**
 * Builds the full PlotOptions entry (id + options + dimensions) used
 * in the chartOptions state array.
 *
 * @param id         Chart id (e.g. "main" or a group uuid).
 * @param title      Chart title text.
 * @param dimensions Initial pixel width/height.
 */
export const makePlotOption = (
  id: string,
  title: string,
  dimensions: ChartDimensions,
) => ({
  id,
  options: makeDefaultChartOptions(title, dimensions),
  width: dimensions.width,
  height: dimensions.height,
});

// ─── Initial chart dimensions ─────────────────────────────────────────────────

export const INITIAL_CHART_DIMENSIONS: ChartDimensions = {
  width: window.innerWidth * 0.9,
  height: 400,
};
