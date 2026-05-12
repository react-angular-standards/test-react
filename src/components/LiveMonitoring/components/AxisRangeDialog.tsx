/** @format */

import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";

export interface AxisRangeDialogProps {
  chartId: string;
  chartRef: React.MutableRefObject<any>;
  onClose: () => void;
}

interface ChannelEntry {
  label: string;
  unit: string;
  axisKey: string; // "primary" | "sec0" | "sec1" | ...
}

interface AxisRange {
  min: string;
  max: string;
}

function buildAxisKey(axisIndex: number): string {
  return axisIndex === -1 ? "primary" : `sec${axisIndex}`;
}

// ─── Style helpers ──────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  color: "#94a3b8",
  borderBottom: "1px solid #334155",
  fontWeight: 600,
  fontSize: "11px",
  position: "sticky",
  top: 0,
  backgroundColor: "#0f172a",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  color: "#e2e8f0",
  fontSize: "12px",
};

const inputStyle = (accentColor: string): React.CSSProperties => ({
  width: "80px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "6px",
  color: accentColor,
  padding: "3px 6px",
  fontSize: "12px",
  outline: "none",
  textAlign: "center",
});

const resetBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #334155",
  color: "#94a3b8",
  padding: "5px 14px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
};

const applyBtnStyle: React.CSSProperties = {
  background: "#3b82f6",
  border: "none",
  color: "#fff",
  padding: "5px 14px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
};

// ─── Component ───────────────────────────────────────────────────────────────

export const AxisRangeDialog: React.FC<AxisRangeDialogProps> = ({
  chartId,
  chartRef,
  onClose,
}) => {
  const {
    primaryChannelGroup,
    secondaryChannelGroups,
    channelIdToPlotInfoRef,
    setChartOptions,
  } = useLiveMonitoringContext();

  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Determine group info ────────────────────────────────────────────────
  const group = secondaryChannelGroups.find((g) => g.id === chartId);
  const channels = group ? group.channels : primaryChannelGroup.channels;
  const groupName =
    chartId === "main"
      ? primaryChannelGroup.name
      : (secondaryChannelGroups.find((g) => g.id === chartId)?.name ?? "Group");

  // ── Build channel → axis mapping (mirrors updateChartDataOption logic) ──
  const buildChannelEntries = (): ChannelEntry[] => {
    const unitToAxisMap = new Map<string, number>();
    let secCount = 0;
    const entries: ChannelEntry[] = [];

    for (const channelLabel of channels) {
      const channelId = Object.keys(channelIdToPlotInfoRef.current).find(
        (id) => channelIdToPlotInfoRef.current[id]?.label === channelLabel,
      );
      const unit = channelId
        ? channelIdToPlotInfoRef.current[channelId]?.unit || "Value"
        : "Value";

      let axisIndex = unitToAxisMap.get(unit);
      if (axisIndex === undefined) {
        if (unitToAxisMap.size === 0) {
          axisIndex = -1; // primary axisY
        } else {
          axisIndex = secCount; // axisY2[secCount]
          secCount++;
        }
        unitToAxisMap.set(unit, axisIndex);
      }

      entries.push({ label: channelLabel, unit, axisKey: buildAxisKey(axisIndex) });
    }
    return entries;
  };

  const channelEntries = buildChannelEntries();

  // ── Initialise ranges from live chart instance ──────────────────────────
  const getInitialRanges = (): Record<string, AxisRange> => {
    const ranges: Record<string, AxisRange> = {};
    const chartInst = chartRef?.current?.chart;
    const opts = chartInst?.options;

    channelEntries.forEach(({ axisKey }) => {
      if (ranges[axisKey]) return;
      if (axisKey === "primary") {
        const axisY = opts?.axisY;
        ranges[axisKey] = {
          min: axisY?.minimum != null ? String(axisY.minimum) : "",
          max: axisY?.maximum != null ? String(axisY.maximum) : "",
        };
      } else {
        const idx = parseInt(axisKey.replace("sec", ""), 10);
        const axis = opts?.axisY2?.[idx];
        ranges[axisKey] = {
          min: axis?.minimum != null ? String(axis.minimum) : "",
          max: axis?.maximum != null ? String(axis.maximum) : "",
        };
      }
    });
    return ranges;
  };

  const [axisRanges, setAxisRanges] = useState<Record<string, AxisRange>>(getInitialRanges);

  // ── Apply handler ───────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    // 1. Update live chart instance immediately
    const chartInst = chartRef?.current?.chart;
    if (chartInst?.options) {
      const primaryRange = axisRanges["primary"];
      if (primaryRange && chartInst.options.axisY) {
        chartInst.options.axisY.minimum =
          primaryRange.min !== "" ? Number(primaryRange.min) : null;
        chartInst.options.axisY.maximum =
          primaryRange.max !== "" ? Number(primaryRange.max) : null;
      }
      Object.entries(axisRanges).forEach(([key, range]) => {
        if (!key.startsWith("sec")) return;
        const idx = parseInt(key.replace("sec", ""), 10);
        const axis = chartInst.options.axisY2?.[idx];
        if (axis) {
          axis.minimum = range.min !== "" ? Number(range.min) : null;
          axis.maximum = range.max !== "" ? Number(range.max) : null;
        }
      });
      chartInst.render?.();
    }

    // 2. Persist into React state so re-renders keep the values
    setChartOptions((prevOpts) =>
      prevOpts.map((c) => {
        if (c.id !== chartId) return c;
        const opts = c.options as any;
        const primaryRange = axisRanges["primary"];

        const newAxisY = { ...opts?.axisY };
        if (primaryRange) {
          if (primaryRange.min !== "") newAxisY.minimum = Number(primaryRange.min);
          else delete newAxisY.minimum;
          if (primaryRange.max !== "") newAxisY.maximum = Number(primaryRange.max);
          else delete newAxisY.maximum;
        }

        const newAxisY2 = (opts?.axisY2 ?? []).map((axis: any, idx: number) => {
          const key = `sec${idx}`;
          const range = axisRanges[key];
          if (!range) return axis;
          const updated = { ...axis };
          if (range.min !== "") updated.minimum = Number(range.min);
          else delete updated.minimum;
          if (range.max !== "") updated.maximum = Number(range.max);
          else delete updated.maximum;
          return updated;
        });

        return { ...c, options: { ...opts, axisY: newAxisY, axisY2: newAxisY2 } };
      }),
    );
  }, [axisRanges, chartId, chartRef, setChartOptions]);

  // ── Reset handler ───────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const cleared: Record<string, AxisRange> = {};
    Object.keys(axisRanges).forEach((k) => (cleared[k] = { min: "", max: "" }));
    setAxisRanges(cleared);

    const chartInst = chartRef?.current?.chart;
    if (chartInst?.options) {
      if (chartInst.options.axisY) {
        chartInst.options.axisY.minimum = null;
        chartInst.options.axisY.maximum = null;
      }
      (chartInst.options.axisY2 ?? []).forEach((axis: any) => {
        axis.minimum = null;
        axis.maximum = null;
      });
      chartInst.render?.();
    }

    setChartOptions((prevOpts) =>
      prevOpts.map((c) => {
        if (c.id !== chartId) return c;
        const opts = c.options as any;
        const newAxisY = { ...opts?.axisY };
        delete newAxisY.minimum;
        delete newAxisY.maximum;
        const newAxisY2 = (opts?.axisY2 ?? []).map((axis: any) => {
          const u = { ...axis };
          delete u.minimum;
          delete u.maximum;
          return u;
        });
        return { ...c, options: { ...opts, axisY: newAxisY, axisY2: newAxisY2 } };
      }),
    );
  }, [axisRanges, chartId, chartRef, setChartOptions]);

  // ── Drag logic ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest(".axis-range-drag-handle")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = tooltipPos.x;
    const origY = tooltipPos.y;
    const onMove = (me: MouseEvent) =>
      setTooltipPos({ x: origX + (me.clientX - startX), y: origY + (me.clientY - startY) });
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Position ────────────────────────────────────────────────────────────
  const chartInst = chartRef?.current?.chart;
  const containerRect = chartInst?.container?.getBoundingClientRect();
  const baseLeft = containerRect
    ? containerRect.left + containerRect.width / 2 + tooltipPos.x
    : window.innerWidth / 2 + tooltipPos.x;
  const baseTop = containerRect
    ? containerRect.top + 60 + tooltipPos.y
    : 120 + tooltipPos.y;

  const hasSharedAxes =
    new Set(channelEntries.map((e) => e.axisKey)).size < channelEntries.length;

  // ── Render ──────────────────────────────────────────────────────────────
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: baseLeft,
        top: baseTop,
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        minWidth: "420px",
        maxWidth: "560px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#e2e8f0",
        fontSize: "13px",
        userSelect: "none",
        pointerEvents: "auto",
      }}
      onMouseDown={handleDragStart}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid #1e293b",
          background: "#1e293b",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="axis-range-drag-handle"
            style={{ cursor: "grab", display: "flex", alignItems: "center", color: "#64748b" }}
          >
            <DragIndicatorIcon fontSize="small" />
          </span>
          <span style={{ fontWeight: 700, fontSize: "13px", color: "#e2e8f0", letterSpacing: "0.3px" }}>
            {groupName} — Axis Range
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: "14px",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ padding: "12px 14px", overflowY: "auto", maxHeight: "380px" }}>
        {channelEntries.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>
            No channels assigned to this group
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Channel</th>
                <th style={thStyle}>Unit</th>
                <th style={{ ...thStyle, color: "#34d399", textAlign: "center" }}>Min</th>
                <th style={{ ...thStyle, color: "#60a5fa", textAlign: "center" }}>Max</th>
              </tr>
            </thead>
            <tbody>
              {channelEntries.map((entry, idx) => {
                const range = axisRanges[entry.axisKey] ?? { min: "", max: "" };
                const isShared =
                  channelEntries.filter((e) => e.axisKey === entry.axisKey).length > 1;
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={tdStyle} title={entry.label}>
                      <div
                        style={{
                          maxWidth: "140px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.label}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: "#94a3b8" }}>
                      {entry.unit}
                      {isShared && (
                        <span
                          title="Channels with this unit share the same Y-axis"
                          style={{ marginLeft: 4, color: "#f59e0b", fontSize: "10px" }}
                        >
                          ⬡
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <input
                        type="number"
                        value={range.min}
                        placeholder="auto"
                        onChange={(e) =>
                          setAxisRanges((prev) => ({
                            ...prev,
                            [entry.axisKey]: {
                              ...(prev[entry.axisKey] ?? { min: "", max: "" }),
                              min: e.target.value,
                            },
                          }))
                        }
                        style={inputStyle("#34d399")}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <input
                        type="number"
                        value={range.max}
                        placeholder="auto"
                        onChange={(e) =>
                          setAxisRanges((prev) => ({
                            ...prev,
                            [entry.axisKey]: {
                              ...(prev[entry.axisKey] ?? { min: "", max: "" }),
                              max: e.target.value,
                            },
                          }))
                        }
                        style={inputStyle("#60a5fa")}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {hasSharedAxes && (
          <div style={{ marginTop: 8, fontSize: "11px", color: "#64748b" }}>
            <span style={{ color: "#f59e0b" }}>⬡</span> Channels with the same
            unit share a Y-axis — ranges are applied together
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          padding: "10px 14px",
          borderTop: "1px solid #1e293b",
          background: "#1e293b",
          borderRadius: "0 0 12px 12px",
        }}
      >
        <button onClick={handleReset} style={resetBtnStyle}>
          Reset
        </button>
        <button onClick={handleApply} style={applyBtnStyle}>
          Apply
        </button>
      </div>
    </div>,
    document.body,
  );
};
