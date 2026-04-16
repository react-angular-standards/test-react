/** @format */

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ChartInstance, PlotOptions, SeriesData } from "../types/ChartSchema";

// Inlined here because ConfiguredChannelSchema is not yet on disk.
// Keep in sync with the real types once that module exists.
interface Option {
  label: string;
  unit?: string;
  yAxisIndex?: number;
}

interface ChannelGroup {
  id: string;
  name: string;
  channels: string[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StriplineMarker {
  timestamp: Date;
  channelValues: Record<string, { label: string; value: number | null }>;
}

export interface StriplineState {
  x1: StriplineMarker | null;
  x2: StriplineMarker | null;
}

export interface AllStriplines {
  [chartId: string]: StriplineState;
}

// ─── Tooltip overlay styles ───────────────────────────────────────────────────

export const striplineTooltipStyles = `
  .stripline-tooltip-overlay {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.93);
    color: #f1f5f9;
    border-radius: 10px;
    padding: 12px 18px;
    font-size: 12px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    z-index: 50;
    min-width: 320px;
    max-width: 480px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    pointer-events: none;
    user-select: none;
    border: 1px solid rgba(99,102,241,0.35);
  }
  .slt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    padding-bottom: 6px;
    cursor: grab;
    pointer-events: auto;
    user-select: none;
  }
  .slt-title {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.4px;
    color: #a5b4fc;
  }
  .slt-hint {
    font-size: 10px;
    color: #94a3b8;
    font-style: italic;
  }
  .slt-table {
    width: 100%;
    border-collapse: collapse;
  }
  .slt-table th {
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 6px 3px 0;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .slt-table td {
    padding: 3px 6px 3px 0;
    vertical-align: middle;
  }
  .slt-label {
    color: #e2e8f0;
    font-weight: 500;
  }
  .slt-x1-val {
    color: #34d399;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .slt-x2-val {
    color: #60a5fa;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .slt-diff-val {
    color: #f59e0b;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .slt-avg-val {
    color: #c084fc;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .slt-total-val {
    color: #fb923c;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .slt-ts-row {
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .slt-ts-label {
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .slt-ts-val {
    font-variant-numeric: tabular-nums;
    font-size: 11px;
  }
  .slt-timediff-row {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slt-badge {
    display: inline-block;
    border-radius: 4px;
    padding: 1px 7px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
  }
  .slt-badge-green  { background: rgba(52,211,153,0.18);  color: #34d399; }
  .slt-badge-blue   { background: rgba(96,165,250,0.18);  color: #60a5fa; }
  .slt-badge-yellow { background: rgba(245,158,11,0.18);  color: #f59e0b; }
  .slt-clear-btn {
    pointer-events: all;
    cursor: pointer;
    background: rgba(239,68,68,0.18);
    border: 1px solid rgba(239,68,68,0.4);
    color: #fca5a5;
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;
    padding: 2px 8px;
    margin-left: 8px;
    transition: background 0.15s;
  }
  .slt-clear-btn:hover {
    background: rgba(239,68,68,0.35);
  }
`;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export const fmt = (d: Date): string =>
  `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;

export const fmtDiff = (ms: number): string => {
  const abs = Math.abs(ms);
  if (abs < 1000) return `${abs} ms`;
  if (abs < 60000) return `${(abs / 1000).toFixed(3)} s`;
  const m = Math.floor(abs / 60000);
  const s = ((abs % 60000) / 1000).toFixed(1);
  return `${m}m ${s}s`;
};

export const fmtNum = (v: number | null): string =>
  v === null ? "—" : v.toFixed(4);

/** Find the dataPoint in a series closest to the clicked timestamp (within 30 s). */
export const findClosestValue = (
  dataPoints: { x: Date; y: number }[],
  ts: Date,
): number | null => {
  if (!dataPoints || dataPoints.length === 0) return null;
  let closest: { x: Date; y: number } | null = null;
  let minDiff = Infinity;
  for (const pt of dataPoints) {
    const diff = Math.abs(pt.x.getTime() - ts.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closest = pt;
    }
  }
  return closest && minDiff < 30000 ? closest.y : null;
};

// ─── Hook params / return types ───────────────────────────────────────────────

export interface UseStriplinesParams {
  /** chartRefs from Plots — keyed by chart id, value is a CanvasJS chart ref. */
  chartRefs: React.MutableRefObject<{ [chartId: string]: any }>;
  /** isZoomedRefs from Plots — tracks whether each chart is currently zoomed. */
  isZoomedRefs: React.MutableRefObject<{ [chartId: string]: boolean }>;
  primaryChannelGroup: ChannelGroup;
  secondaryChannelGroups: ChannelGroup[];
  channelIdToPlotInfoRef: React.MutableRefObject<{
    [channelId: string]: Option;
  }>;
  activePlotChannelsRef: React.MutableRefObject<Record<string, SeriesData>>;
  setChartOptions: React.Dispatch<React.SetStateAction<PlotOptions[]>>;
  /** Striplines are only active when the plot is paused for analysis. */
  isPlotPausedForAnalysis: boolean;
}

export interface UseStriplinesReturn {
  /** Per-chart stripline state (x1 / x2 markers). Consumed by renderStriplineTooltip. */
  allStriplines: AllStriplines;
  /** Tracks which marker position (x1 | x2) the next click will set, keyed by chart id. */
  nextClickRef: React.MutableRefObject<Record<string, "x1" | "x2">>;
  /**
   * Stable ref wrapping applyStriplineAt.
   * Always up-to-date — safe to call from series-click handlers that capture
   * this ref without needing to re-capture applyStriplineAt itself.
   */
  applyStriplineAtRef: React.MutableRefObject<
    (chartId: string, ts: Date) => void
  >;
  /** Attach the chart-area click handler to a CanvasJS instance. */
  attachChartClickHandler: (chartId: string) => void;
  /** Clear both stripline markers for a chart and remove the lines from the canvas. */
  clearStriplines: (chartId: string) => void;
  /**
   * Drop-in replacement for the inline ref callback on each CanvasJSChart.
   * Stores the chart instance in chartRefs and schedules attachChartClickHandler.
   */
  handleChartRef: (chartId: string, chartInst: ChartInstance | null) => void;
  /** Render the floating analysis tooltip for a given chart. Returns null when nothing is set. */
  renderStriplineTooltip: (chartId: string) => React.ReactNode;
}

// ─── useStriplines ────────────────────────────────────────────────────────────

export function useStriplines({
  chartRefs,
  isZoomedRefs,
  primaryChannelGroup,
  secondaryChannelGroups,
  channelIdToPlotInfoRef,
  activePlotChannelsRef,
  setChartOptions,
  isPlotPausedForAnalysis,
}: UseStriplinesParams): UseStriplinesReturn {
  // ── State / refs owned by this hook ────────────────────────────────────────
  const [allStriplines, setAllStriplines] = useState<AllStriplines>({});
  const nextClickRef = useRef<Record<string, "x1" | "x2">>({});
  // Per-chart tooltip drag offset in px — {x, y} relative to initial centred position
  const [tooltipPositions, setTooltipPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  // Keep a ref so the click handler always reads the latest pause state
  // without needing to be re-created on every render.
  const isPlotPausedRef = useRef(isPlotPausedForAnalysis);

  // Clear striplines whenever the plot resumes
  useEffect(() => {
    isPlotPausedRef.current = isPlotPausedForAnalysis;
    if (!isPlotPausedForAnalysis) {
      Object.keys(allStriplines).forEach((chartId) => {
        clearStriplines(chartId);
      });
    }
  }, [isPlotPausedForAnalysis, allStriplines, clearStriplines]);

  // ── Build a per-channel value snapshot at a given timestamp ────────────────
  const buildChannelSnapshot = useCallback(
    (
      ts: Date,
      chartId: string,
    ): Record<string, { label: string; value: number | null }> => {
      const group = secondaryChannelGroups.find((g) => g.id === chartId);
      const channelLabels: string[] = group
        ? group.channels
        : primaryChannelGroup.channels;

      const snapshot: Record<string, { label: string; value: number | null }> =
        {};

      channelLabels.forEach((label) => {
        const channelId = Object.keys(channelIdToPlotInfoRef.current).find(
          (id) => channelIdToPlotInfoRef.current[id]?.label === label,
        );
        if (!channelId) return;
        const series = activePlotChannelsRef.current[channelId];
        const value = series ? findClosestValue(series.dataPoints, ts) : null;
        snapshot[channelId] = { label, value };
      });

      return snapshot;
    },
    [
      activePlotChannelsRef,
      primaryChannelGroup,
      secondaryChannelGroups,
      channelIdToPlotInfoRef,
    ],
  );

  // ── Clear striplines for a chart ───────────────────────────────────────────
  const clearStriplines = useCallback(
    (chartId: string) => {
      setAllStriplines((prev) => ({
        ...prev,
        [chartId]: { x1: null, x2: null },
      }));
      nextClickRef.current[chartId] = "x1";

      // Remove lines from the live CanvasJS instance
      const chartInst = (chartRefs.current[chartId] as any)?.chart as
        | ChartInstance
        | undefined;
      if (chartInst?.options?.axisX) {
        (chartInst.options.axisX as any).stripLines = [];
        (chartInst as any).render?.();
      }

      // Also purge from React state so they don't reappear after an option rebuild
      setChartOptions((prevOpts) =>
        prevOpts.map((c) => {
          if (c.id !== chartId) return c;
          return {
            ...c,
            options: {
              ...c.options,
              axisX: {
                ...(c.options as any)?.axisX,
                stripLines: [],
              },
            },
          };
        }),
      );
    },
    [chartRefs, setChartOptions],
  );

  // ── Core stripline setter ──────────────────────────────────────────────────
  const applyStriplineAt = useCallback(
    (chartId: string, ts: Date) => {
      // Never place striplines during live streaming — only when paused for analysis.
      if (!isPlotPausedRef.current) return;
      if (!ts || isNaN(ts.getTime())) return;

      const which = nextClickRef.current[chartId] ?? "x1";
      const snapshot = buildChannelSnapshot(ts, chartId);
      const marker: StriplineMarker = {
        timestamp: ts,
        channelValues: snapshot,
      };
      const color = which === "x1" ? "#34d399" : "#60a5fa";

      // Draw on the live CanvasJS instance
      const chartInst = (chartRefs.current[chartId] as any)?.chart as
        | (ChartInstance & { render: () => void })
        | undefined;
      if (!chartInst?.options) return;

      const axisX = (chartInst.options as any).axisX ?? {};
      const existingLines: any[] = axisX.stripLines ?? [];
      // Filter out both the main line and the bottom-label ghost for this marker.
      const filtered = existingLines.filter(
        (sl: any) => sl._marker !== which && sl._marker !== `${which}_b`,
      );

      // Top label — inside the plot area, at the top end of the vertical line.
      const newLineTop = {
        _marker: which,
        value: ts,
        thickness: 2,
        color,
        lineDashType: "dash",
        label: which.toUpperCase(),
        labelFontColor: color,
        labelFontSize: 11,
        labelFontWeight: "bold",
        labelBackgroundColor: "rgba(15,23,42,0.85)",
        labelPlacement: "inside",
      };

      // Bottom label — ghost (invisible line) whose label appears outside the
      // axis at the bottom end of the vertical line.
      const newLineBot = {
        _marker: `${which}_b`,
        value: ts,
        thickness: 1,
        color: "rgba(0,0,0,0)",
        label: which.toUpperCase(),
        labelFontColor: color,
        labelFontSize: 11,
        labelFontWeight: "bold",
        labelBackgroundColor: "rgba(15,23,42,0.85)",
        labelPlacement: "outside",
      };

      (chartInst.options as any).axisX = {
        ...axisX,
        stripLines: [...filtered, newLineTop, newLineBot],
      };
      chartInst.render();

      setAllStriplines((prev) => {
        const current = prev[chartId] ?? { x1: null, x2: null };
        return { ...prev, [chartId]: { ...current, [which]: marker } };
      });

      // Persist into React state so lines survive option rebuilds
      setChartOptions((prevOpts) =>
        prevOpts.map((c) => {
          if (c.id !== chartId) return c;
          const stateLines: any[] = (c.options as any)?.axisX?.stripLines ?? [];
          const filteredState = stateLines.filter(
            (sl: any) => sl._marker !== which && sl._marker !== `${which}_b`,
          );
          return {
            ...c,
            options: {
              ...c.options,
              axisX: {
                ...(c.options as any)?.axisX,
                stripLines: [...filteredState, newLineTop, newLineBot],
              },
            },
          };
        }),
      );

      // Advance the sequence: x1 → x2 → x1 → …
      nextClickRef.current[chartId] = which === "x1" ? "x2" : "x1";
    },
    [buildChannelSnapshot, chartRefs, setChartOptions],
  );

  // Stable ref so series-click handlers and attachChartClickHandler never
  // need to re-capture applyStriplineAt itself.
  const applyStriplineAtRef = useRef(applyStriplineAt);
  applyStriplineAtRef.current = applyStriplineAt;

  // ── Attach the chart-area click handler to a CanvasJS instance ─────────────
  const attachChartClickHandler = useCallback((chartId: string) => {
    const chartInst = (chartRefs.current[chartId] as any)?.chart as
      | (ChartInstance & { render: () => void })
      | undefined;
    if (!chartInst?.options) return;

    (chartInst.options as any).click = (e: any) => {
      // Only allow stripline placement when the plot is paused for analysis.
      if (!isPlotPausedRef.current) return;
      // e.axisX[0].value is only populated near the axis edge.
      // convertPixelToValue(e.x) works for any click anywhere in the chart area.
      const axis = (e.chart ?? chartInst)?.axisX?.[0];
      if (!axis) return;
      const xValue = axis.convertPixelToValue(e.x);
      if (xValue == null || isNaN(xValue)) return;
      const ts = new Date(xValue);
      if (isNaN(ts.getTime())) return;
      applyStriplineAtRef.current(chartId, ts);
    };

    chartInst.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-attach handlers (and rangeChanged) whenever chartRefs change ─────────
  useEffect(() => {
    Object.keys(chartRefs.current).forEach((chartId) => {
      const chart = (chartRefs.current[chartId] as any)?.chart as
        | ChartInstance
        | undefined;
      if (chart?.options) {
        chart.options.rangeChanged = (e: any) => {
          const isZoomed =
            e.axisX[0].viewportMinimum != null ||
            e.axisX[0].viewportMaximum != null;
          isZoomedRefs.current[chartId] = isZoomed;
        };
        attachChartClickHandler(chartId);
      }
    });
  }, [attachChartClickHandler, chartRefs, isZoomedRefs]);

  // ── Chart ref callback ─────────────────────────────────────────────────────
  const handleChartRef = useCallback(
    (chartId: string, chartInst: ChartInstance | null) => {
      chartRefs.current[chartId] = chartInst as any;
      if (chartInst) {
        // Small defer so CanvasJS finishes its own internal setup first
        setTimeout(() => attachChartClickHandler(chartId), 0);
      }
    },
    [attachChartClickHandler, chartRefs],
  );

  // ── Tooltip renderer ───────────────────────────────────────────────────────
  const renderStriplineTooltip = useCallback(
    (chartId: string): React.ReactNode => {
      const sl = allStriplines[chartId];
      if (!sl) return null;

      const { x1, x2 } = sl;
      const hasX1 = x1 !== null;
      const hasX2 = x2 !== null;

      if (!hasX1 && !hasX2) return null;

      // Get chart container position for initial fixed positioning
      const chartRef = chartRefs.current[chartId];
      const chart = (chartRef as any)?.chart;
      const containerRect = chart?.container?.getBoundingClientRect();
      const baseLeft = containerRect
        ? containerRect.left + containerRect.width / 2
        : window.innerWidth / 2;
      const baseTop = containerRect ? containerRect.top + 8 : 100;

      const nextClick = nextClickRef.current[chartId] ?? "x1";
      const pos = tooltipPositions[chartId] ?? { x: 0, y: 0 };

      const allChannelIds = Array.from(
        new Set([
          ...Object.keys(x1?.channelValues ?? {}),
          ...Object.keys(x2?.channelValues ?? {}),
        ]),
      );

      const groupName =
        chartId === "main"
          ? primaryChannelGroup.name
          : secondaryChannelGroups.find((g) => g.id === chartId)?.name ||
            "Group";

      const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = pos.x;
        const origY = pos.y;
        const onMove = (ev: MouseEvent) => {
          setTooltipPositions((prev) => ({
            ...prev,
            [chartId]: {
              x: origX + ev.clientX - startX,
              y: origY + ev.clientY - startY,
            },
          }));
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };

      return ReactDOM.createPortal(
        <div
          className="stripline-tooltip-overlay"
          style={{
            position: "fixed",
            left: `${baseLeft + pos.x}px`,
            top: `${baseTop + pos.y}px`,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
        >
          {/* Header */}
          <div className="slt-header" onMouseDown={handleDragStart}>
            <span className="slt-title">⠿ {groupName}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="slt-hint">
                {!hasX1
                  ? "Click chart to set X1"
                  : !hasX2
                    ? "Click chart to set X2"
                    : "Both markers set"}
              </span>
              {(hasX1 || hasX2) && (
                <button
                  className="slt-clear-btn"
                  onClick={() => clearStriplines(chartId)}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="slt-ts-row">
            <table className="slt-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Marker</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {hasX1 && (
                  <tr>
                    <td>
                      <span className="slt-badge slt-badge-green">X1</span>
                    </td>
                    <td className="slt-x1-val">{fmt(x1!.timestamp)}</td>
                  </tr>
                )}
                {hasX2 && (
                  <tr>
                    <td>
                      <span className="slt-badge slt-badge-blue">X2</span>
                    </td>
                    <td className="slt-x2-val">{fmt(x2!.timestamp)}</td>
                  </tr>
                )}
                {hasX1 && hasX2 && (
                  <tr>
                    <td>
                      <span className="slt-badge slt-badge-yellow">ΔT</span>
                    </td>
                    <td className="slt-diff-val">
                      {fmtDiff(
                        x2!.timestamp.getTime() - x1!.timestamp.getTime(),
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Per-channel values */}
          {allChannelIds.length > 0 && (
            <table className="slt-table" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Channel</th>
                  {hasX1 && <th style={{ color: "#34d399" }}>X1 Value</th>}
                  {hasX2 && <th style={{ color: "#60a5fa" }}>X2 Value</th>}
                  {hasX1 && hasX2 && (
                    <>
                      <th style={{ color: "#f59e0b" }}>Diff</th>
                      <th style={{ color: "#fb923c" }}>Total</th>
                      <th style={{ color: "#c084fc" }}>Avg</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {allChannelIds.map((cid) => {
                  const v1 = x1?.channelValues[cid]?.value ?? null;
                  const v2 = x2?.channelValues[cid]?.value ?? null;
                  const label =
                    x1?.channelValues[cid]?.label ||
                    x2?.channelValues[cid]?.label ||
                    cid;
                  const diff = v1 !== null && v2 !== null ? v2 - v1 : null;
                  const total = v1 !== null && v2 !== null ? v1 + v2 : null;
                  const avg = v1 !== null && v2 !== null ? (v1 + v2) / 2 : null;

                  return (
                    <tr key={cid}>
                      <td
                        className="slt-label"
                        style={{
                          maxWidth: 110,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </td>
                      {hasX1 && <td className="slt-x1-val">{fmtNum(v1)}</td>}
                      {hasX2 && <td className="slt-x2-val">{fmtNum(v2)}</td>}
                      {hasX1 && hasX2 && (
                        <>
                          <td className="slt-diff-val">
                            {diff !== null
                              ? (diff >= 0 ? "+" : "") + fmtNum(diff)
                              : "—"}
                          </td>
                          <td className="slt-total-val">{fmtNum(total)}</td>
                          <td className="slt-avg-val">{fmtNum(avg)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Next-click indicator */}
          <div className="slt-timediff-row">
            <span style={{ fontSize: 10, color: "#94a3b8" }}>
              Next click sets:
            </span>
            <span
              className={`slt-badge ${
                nextClick === "x1" ? "slt-badge-green" : "slt-badge-blue"
              }`}
            >
              {nextClick.toUpperCase()}
            </span>
          </div>
        </div>,
        document.body,
      );
    },
    [
      allStriplines,
      chartRefs,
      clearStriplines,
      tooltipPositions,
      primaryChannelGroup,
      secondaryChannelGroups,
    ],
  );

  return {
    allStriplines,
    nextClickRef,
    applyStriplineAtRef,
    attachChartClickHandler,
    clearStriplines,
    handleChartRef,
    renderStriplineTooltip,
  };
}
