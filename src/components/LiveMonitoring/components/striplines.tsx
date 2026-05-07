import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";
import { striplineTooltipStyles } from "./striplineStyles";
import { fmt, fmtDiff, fmtNum, findClosestValue } from "./striplineHelpers";


// --- Interfaces ---
export interface Option {
  value: number;
  label: string;
}

export interface ChannelGroup {
  id: string;
  name: string;
  channels: string[];
}

export interface StriplineMarker {
  timestamp: Date;
  channelValues: Record<string, { label: string; value: number | null }>;
}

export interface StriplineState {
  x1: StriplineMarker | null;
  x2: StriplineMarker | null;
}

export interface StriplineProps {
  chartId: string;
  chartRef: React.MutableRefObject<any>;
  isZoomedRef?: React.MutableRefObject<boolean>;
}

export interface StriplineHandle {
  applyStriplineAt: (ts: Date) => void;
  clearStriplines: () => void;
}

export const Stripline = forwardRef<StriplineHandle, StriplineProps>(
  ({ chartId, chartRef, isZoomedRef }, ref) => {
    const {
      activePlotChannelsRef,
      primaryChannelGroup,
      secondaryChannelGroups,
      channelIdToPlotInfoRef,
      setChartOptions,
      isPlotPausedForAnalysis,
    } = useLiveMonitoringContext();

    const [state, setState] = useState<StriplineState>({ x1: null, x2: null });
    const nextClickRef = useRef<"x1" | "x2">("x1");
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const isPlotPausedRef = useRef(isPlotPausedForAnalysis);


    const buildChannelSnapshot = useCallback(
      (ts: Date): Record<string, { label: string; value: number | null }> => {
        const group = secondaryChannelGroups.find((g) => g.id === chartId);
        const channelLabels: string[] = group
          ? group.channels
          : primaryChannelGroup.channels;

        const snapshot: Record<
          string,
          { label: string; value: number | null }
        > = {};

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
        chartId,
      ],
    );

    const clearStriplines = useCallback(() => {
      setState({ x1: null, x2: null });
      nextClickRef.current = "x1";

      const chartInst = chartRef?.current?.chart;
      if (chartInst?.options?.axisX) {
        chartInst.options.axisX.stripLines = [];
        chartInst.render?.();
      }

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
    }, [chartId, chartRef, setChartOptions]);

    useEffect(() => {
      isPlotPausedRef.current = isPlotPausedForAnalysis;
      if (!isPlotPausedForAnalysis) {
        clearStriplines();
      }
    }, [isPlotPausedForAnalysis, clearStriplines]);

    const applyStriplineAt = useCallback(
      (ts: Date) => {
        if (!isPlotPausedRef.current) return;
        if (!ts || isNaN(ts.getTime())) return;

        const which = nextClickRef.current;
        const snapshot = buildChannelSnapshot(ts);
        const marker: StriplineMarker = {
          timestamp: ts,
          channelValues: snapshot,
        };
        const color = which === "x1" ? "#34d399" : "#60a5fa";

        const chartInst = chartRef?.current?.chart;
        if (!chartInst?.options) return;

        const axisX = chartInst.options.axisX ?? {};
        const existingLines: any[] = axisX.stripLines ?? [];
        const filtered = existingLines.filter(
          (sl: any) => sl._marker !== which && sl._marker !== `${which}_b`,
        );

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

        chartInst.options.axisX = {
          ...axisX,
          stripLines: [...filtered, newLineTop, newLineBot],
        };
        chartInst.render();

        setState((prev) => ({ ...prev, [which]: marker }));

        setChartOptions((prevOpts) =>
          prevOpts.map((c) => {
            if (c.id !== chartId) return c;
            const stateLines: any[] =
              (c.options as any)?.axisX?.stripLines ?? [];
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

        nextClickRef.current = which === "x1" ? "x2" : "x1";
      },
      [buildChannelSnapshot, chartId, chartRef, setChartOptions],
    );

    useImperativeHandle(
      ref,
      () => ({
        applyStriplineAt,
        clearStriplines,
      }),
      [applyStriplineAt, clearStriplines],
    );


    if (!state.x1 && !state.x2) return null;

    const chartInst = chartRef?.current?.chart;
    if (!chartInst?.axisX?.[0]) return null;

    const containerRect = chartInst.container?.getBoundingClientRect();
    if (!containerRect) return null;

    const baseLeft = containerRect.width / 2 + tooltipPos.x;
    const baseTop = 40 + tooltipPos.y;

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!(e.target as HTMLElement).closest(".drag-handle")) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = tooltipPos.x;
      const origY = tooltipPos.y;

      const onMove = (me: MouseEvent) => {
        setTooltipPos({
          x: origX + (me.clientX - startX),
          y: origY + (me.clientY - startY),
        });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const allChannelIds = new Set<string>();
    if (state.x1)
      Object.keys(state.x1.channelValues).forEach((id) =>
        allChannelIds.add(id),
      );
    if (state.x2)
      Object.keys(state.x2.channelValues).forEach((id) =>
        allChannelIds.add(id),
      );

    const groupName =
      chartId === "main"
        ? primaryChannelGroup.name
        : (secondaryChannelGroups.find((g) => g.id === chartId)?.name ??
          "Group");

    return createPortal(
      <div
        style={{
          ...striplineTooltipStyles.container,
          position: "fixed",
          left: baseLeft,
          top: baseTop,
          transform: "translateX(-50%)",
          zIndex: 9999,
        }}
        onMouseDown={handleDragStart}
      >
        <div className="stripline-header" style={striplineTooltipStyles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="drag-handle" style={{ ...striplineTooltipStyles.icon, display: "flex", alignItems: "center" }}>
              <DragIndicatorIcon fontSize="small" />
            </span>
            <span style={striplineTooltipStyles.title}>
              {groupName} Analysis
            </span>
          </div>
          <button
            onClick={clearStriplines}
            style={striplineTooltipStyles.clearBtn}
            title="Clear Striplines"
          >
            ✕
          </button>
        </div>

        <div style={striplineTooltipStyles.tableWrapper}>
          <table style={striplineTooltipStyles.table}>
            <thead>
              <tr>
                <th style={striplineTooltipStyles.th}>Channel</th>
                <th style={{ ...striplineTooltipStyles.th, color: "#34d399" }}>
                  X1 {state.x1 ? fmt(state.x1.timestamp) : "--"}
                </th>
                <th style={{ ...striplineTooltipStyles.th, color: "#60a5fa" }}>
                  X2 {state.x2 ? fmt(state.x2.timestamp) : "--"}
                </th>
                <th style={{ ...striplineTooltipStyles.th, color: "#f59e0b" }}>
                  Diff {fmtDiff(state.x1?.timestamp, state.x2?.timestamp)}
                </th>
                <th style={{ ...striplineTooltipStyles.th, color: "#fb923c" }}>
                  Total
                </th>
                <th style={{ ...striplineTooltipStyles.th, color: "#c084fc" }}>
                  Avg
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(allChannelIds).map((chId) => {
                const v1 = state.x1?.channelValues[chId]?.value;
                const v2 = state.x2?.channelValues[chId]?.value;
                const label =
                  state.x1?.channelValues[chId]?.label ??
                  state.x2?.channelValues[chId]?.label ??
                  chId;
                const diff =
                  v1 != null && v2 != null ? Math.abs(v2 - v1) : null;
                const total = 
                  v1 != null && v2 != null ? v1 + v2 : null;
                const avg = 
                  v1 != null && v2 != null ? (v1 + v2) / 2 : null;

                return (
                  <tr key={chId} style={striplineTooltipStyles.tr}>
                    <td style={striplineTooltipStyles.td}>
                      <div
                        style={{
                          maxWidth: "120px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={label}
                      >
                        {label}
                      </div>
                    </td>
                    <td style={striplineTooltipStyles.td}>{fmtNum(v1)}</td>
                    <td style={striplineTooltipStyles.td}>{fmtNum(v2)}</td>
                    <td
                      style={{
                        ...striplineTooltipStyles.td,
                        color: "#f59e0b",
                      }}
                    >
                      {fmtNum(diff)}
                    </td>
                    <td
                      style={{
                        ...striplineTooltipStyles.td,
                        color: "#fb923c",
                      }}
                    >
                      {fmtNum(total)}
                    </td>
                    <td
                      style={{
                        ...striplineTooltipStyles.td,
                        color: "#c084fc",
                      }}
                    >
                      {fmtNum(avg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={striplineTooltipStyles.footer}>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Next click sets:{" "}
            <strong
              style={{
                color: nextClickRef.current === "x1" ? "#34d399" : "#60a5fa",
              }}
            >
              {nextClickRef.current.toUpperCase()}
            </strong>
          </span>
        </div>
      </div>,
      document.body
    );
  },
);
