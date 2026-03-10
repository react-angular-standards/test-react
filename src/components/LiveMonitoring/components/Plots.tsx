/** @format */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import CanvasJSReact from "@canvasjs/react-charts";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import { v4 as uuidv4 } from "uuid";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { ThreeBarsIcon, TabIcon } from "@primer/octicons-react";
import Tooltip from "@mui/material/Tooltip";
import { DropResult } from "react-beautiful-dnd";

import CascadingMultiSelect from "./CascadingMultiSelect";
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";
import { ChannelGroup } from "../types/ConfiguredChannelSchema";
import { customPlotsStyles } from "../../Widgets/CustomStyle";
import { ChartInstance } from "../types/ChartSchema";
import { useGridLayoutSettings } from "../../../hooks/useGridLayoutSettings";
import { CustomSlider } from "../../Widgets/CustomSlider";
import { UrlConstant } from "../../../util/UrlConstans";
import { useRecordedLiveData } from "../../../hooks/useRecordedLiveData";
import { PlotGroupSelection } from "./PlotGroupSelection";
import {
  makeSeriesData,
  makePrimaryAxisY,
  makeSecondaryAxisY,
  FALLBACK_AXIS_Y,
  LEGEND_DEFAULTS,
  makePlotOption,
  CHANNEL_COLORS,
} from "../config/chartConfig";

// ─── Stripline marker types ───────────────────────────────────────────────────

interface StriplineMarker {
  timestamp: Date;
  channelValues: Record<string, { label: string; value: number | null }>;
}

interface StriplineState {
  x1: StriplineMarker | null;
  x2: StriplineMarker | null;
}

// Per-chart stripline state keyed by chart id
interface AllStriplines {
  [chartId: string]: StriplineState;
}

interface LiveMonitoringProps {
  drawerOpenState: boolean;
}

export interface DataChartFunction {
  updateChartDataOption: () => void;
}

// ─── Tooltip overlay styles ───────────────────────────────────────────────────

const striplineTooltipStyles = `
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
    border: 1px solid rgba(99,102,241,0.35);
  }
  .slt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    padding-bottom: 6px;
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
  .slt-badge-green  { background: rgba(52,211,153,0.18); color: #34d399; }
  .slt-badge-blue   { background: rgba(96,165,250,0.18); color: #60a5fa; }
  .slt-badge-yellow { background: rgba(245,158,11,0.18); color: #f59e0b; }
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: Date): string =>
  `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;

const fmtDiff = (ms: number): string => {
  const abs = Math.abs(ms);
  if (abs < 1000) return `${abs} ms`;
  if (abs < 60000) return `${(abs / 1000).toFixed(3)} s`;
  const m = Math.floor(abs / 60000);
  const s = ((abs % 60000) / 1000).toFixed(1);
  return `${m}m ${s}s`;
};

const fmtNum = (v: number | null): string => (v === null ? "—" : v.toFixed(4));

/** Find the dataPoint in a series closest to the clicked timestamp */
const findClosestValue = (
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
  // Accept within a 30-second window
  return closest && minDiff < 30000 ? closest.y : null;
};

// ─── Component ────────────────────────────────────────────────────────────────

const Plots = forwardRef<DataChartFunction, LiveMonitoringProps>(
  (props, ref) => {
    const { drawerOpenState } = props;
    const {
      activePlotChannelsRef,
      bufferTimeWindow,
      enableChartLegend,
      isRecording,
      isPlotPausedForAnalysis,
      availableChannels,
      channelGroups,
      tabUniqueId,
      chartOptions,
      channelIdToPlotInfoRef,
      connectionState,
      primaryGrpName,
      triggerChannelSync,
      setBufferTimeWindow,
      setEnableChartLegend,
      setPrimaryGrpName,
      setIsRecording,
      setIsPlotPausedForAnalysis,
      setAvailableChannels,
      setChannelGroups,
      setChartOptions,
    } = useLiveMonitoringContext();

    const {
      gridLayout,
      resizeID,
      resizeRef,
      buildLayoutFromOptionList,
      handleResizeStart,
      handleLayoutChange,
      setGridLayout,
      setResizeID,
    } = useGridLayoutSettings();

    const divRef = useRef<HTMLDivElement | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [isUpdateRecordingRequired, setIsUpdateRecordingRequired] =
      useState(false);
    const [showChannelSection, setShowChannelSection] = useState(true);

    // ── Stripline state ──────────────────────────────────────────────────────
    const [allStriplines, setAllStriplines] = useState<AllStriplines>({});
    // Tracks which click is next: "x1" or "x2" per chart
    const nextClickRef = useRef<Record<string, "x1" | "x2">>({});

    const { recordedDataTimeRangeRef, refreshTimeRangeRef, fetchRecordedData } =
      useRecordedLiveData();
    const chartRefs = useRef<{
      [key: string]: CanvasJSReact.CanvasJSChart | null;
    }>({ main: null });
    const isZoomedRefs = useRef<{ [key: string]: boolean }>({ main: false });
    const channelChart = useRef<{ [chid: number | string]: string | null }>({
      main: null,
    });

    // ── Per-channel colour assignment (stable across re-renders) ─────────────
    const channelColorMapRef = useRef<Record<string, string>>({});
    const channelColorCursorRef = useRef(0);
    const getChannelColor = useCallback((channelId: string): string => {
      if (!channelColorMapRef.current[channelId]) {
        channelColorMapRef.current[channelId] =
          CHANNEL_COLORS[channelColorCursorRef.current % CHANNEL_COLORS.length];
        channelColorCursorRef.current++;
      }
      return channelColorMapRef.current[channelId];
    }, []);

    // ── Build channel-value snapshot at a given timestamp ────────────────────
    const buildChannelSnapshot = useCallback(
      (
        ts: Date,
        chartId: string,
      ): Record<string, { label: string; value: number | null }> => {
        // Determine which channels belong to this chart
        const group = channelGroups.find((g) => g.id === chartId);
        const channelLabels: string[] = group
          ? group.channels
          : availableChannels;

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
        availableChannels,
        channelGroups,
        channelIdToPlotInfoRef,
      ],
    );

    // ── Clear striplines for a chart ─────────────────────────────────────────
    const clearStriplines = useCallback(
      (chartId: string) => {
        setAllStriplines((prev) => ({
          ...prev,
          [chartId]: { x1: null, x2: null },
        }));
        nextClickRef.current[chartId] = "x1";

        // Remove striplines from the live chart instance
        const chartInst = (chartRefs.current[chartId] as any)?.chart as
          | ChartInstance
          | undefined;
        if (chartInst?.options?.axisX) {
          (chartInst.options.axisX as any).stripLines = [];
          (chartInst as any).render?.();
        }

        // Clear striplines from React state so they don't reappear on rebuild
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
      [setChartOptions],
    );

    // ── Core stripline setter — shared by chart-level and series-level clicks ──
    const applyStriplineAt = useCallback(
      (chartId: string, ts: Date) => {
        if (!ts || isNaN(ts.getTime())) return;

        const which = nextClickRef.current[chartId] ?? "x1";
        const snapshot = buildChannelSnapshot(ts, chartId);
        const marker: StriplineMarker = {
          timestamp: ts,
          channelValues: snapshot,
        };
        const color = which === "x1" ? "#34d399" : "#60a5fa";

        // Draw stripline on the actual CanvasJS chart instance
        const chartInst = (chartRefs.current[chartId] as any)?.chart as
          | (ChartInstance & { render: () => void })
          | undefined;
        if (!chartInst?.options) return;

        const axisX = (chartInst.options as any).axisX ?? {};
        const existingLines: any[] = axisX.stripLines ?? [];
        const filtered = existingLines.filter(
          (sl: any) => sl._marker !== which,
        );
        const newLine = {
          _marker: which,
          value: ts,
          thickness: 2,
          color,
          lineDashType: "dash",
          label: which.toUpperCase(),
          labelFontColor: color,
          labelFontSize: 11,
          labelFontWeight: "bold",
          labelBackgroundColor: "transparent",
          labelPlacement: "outside",
        };
        (chartInst.options as any).axisX = {
          ...axisX,
          stripLines: [...filtered, newLine],
        };
        chartInst.render();

        setAllStriplines((prev) => {
          const current = prev[chartId] ?? { x1: null, x2: null };
          return { ...prev, [chartId]: { ...current, [which]: marker } };
        });

        // Persist striplines into React state so they survive option rebuilds
        setChartOptions((prevOpts) =>
          prevOpts.map((c) => {
            if (c.id !== chartId) return c;
            const stateLines: any[] =
              (c.options as any)?.axisX?.stripLines ?? [];
            const filteredState = stateLines.filter(
              (sl: any) => sl._marker !== which,
            );
            return {
              ...c,
              options: {
                ...c.options,
                axisX: {
                  ...(c.options as any)?.axisX,
                  stripLines: [...filteredState, newLine],
                },
              },
            };
          }),
        );

        // Advance click sequence: x1 → x2 → x1
        nextClickRef.current[chartId] = which === "x1" ? "x2" : "x1";
      },
      [buildChannelSnapshot, setChartOptions],
    );

    // Keep a stable ref to applyStriplineAt so attachChartClickHandler
    // doesn't need to be recreated every time live-data deps change.
    const applyStriplineAtRef = useRef(applyStriplineAt);
    applyStriplineAtRef.current = applyStriplineAt;

    // ── Attach chart-level click handler (fires on empty-area clicks too) ──────
    const attachChartClickHandler = useCallback((chartId: string) => {
      const chartInst = (chartRefs.current[chartId] as any)?.chart as
        | (ChartInstance & { render: () => void })
        | undefined;
      if (!chartInst?.options) return;

      (chartInst.options as any).click = (e: any) => {
        const ts: Date | null = e.axisX?.[0]
          ? new Date(e.axisX[0].value)
          : null;
        if (!ts || isNaN(ts.getTime())) return;
        applyStriplineAtRef.current(chartId, ts);
      };

      chartInst.render();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Re-attach handlers when chart refs change ────────────────────────────
    useEffect(() => {
      Object.keys(chartRefs.current).forEach((chartId) => {
        const chart = (chartRefs.current[chartId] as any)?.chart as
          | ChartInstance
          | undefined;
        if (chart?.options) {
          chart.options.rangeChanged = (e) => {
            const isZoomed =
              e.axisX[0].viewportMinimum != null ||
              e.axisX[0].viewportMaximum != null;
            isZoomedRefs.current[chartId] = isZoomed;
          };
          // Attach click handler
          attachChartClickHandler(chartId);
        }
      });
    }, [attachChartClickHandler]);

    const handlePlotChannelSelect = useCallback(
      (selectedChannelIds: string[]) => {
        selectedChannelIds.forEach((channelId) => {
          const channelInfo = channelIdToPlotInfoRef.current[channelId];

          if (!channelInfo) {
            console.warn("Channel info not found for:", channelId);
            return;
          }

          const axisIndex = channelInfo.yAxisIndex ?? 0;
          if (!activePlotChannelsRef.current[channelId]) {
            activePlotChannelsRef.current[channelId] = makeSeriesData(
              channelId,
              channelInfo.label,
              getChannelColor(channelId),
              axisIndex,
              enableChartLegend,
            );
          }
        });

        const selectedLabels = selectedChannelIds.map(
          (id) => channelIdToPlotInfoRef.current[id]?.label || id,
        );
        const assignedChannels = channelGroups.flatMap(
          (group) => group.channels,
        );

        setAvailableChannels((prev: string[]) => {
          const newAvailable = prev.filter((ch) => selectedLabels.includes(ch));
          const newChannels = selectedLabels.filter((label) => {
            const channelId = selectedChannelIds.find(
              (id) => channelIdToPlotInfoRef.current[id]?.label === label,
            );
            if (channelId) {
              channelChart.current[channelId] = "main";
            }
            return (
              !assignedChannels.includes(label) && !newAvailable.includes(label)
            );
          });

          return [...newAvailable, ...newChannels].sort((a, b) =>
            a.localeCompare(b),
          );
        });

        setChannelGroups((prevGroups: ChannelGroup[]) => {
          const newGroups = prevGroups.map((group) => ({
            ...group,
            channels: group.channels.filter((label: string) => {
              const res = selectedLabels.includes(label);

              if (res) {
                const channelId = selectedChannelIds.find(
                  (id) => channelIdToPlotInfoRef.current[id]?.label === label,
                );
                if (channelId) {
                  channelChart.current[channelId] = group.id;
                }
              }
              return res;
            }),
          }));
          return newGroups;
        });
      },
      [
        activePlotChannelsRef,
        channelIdToPlotInfoRef,
        channelGroups,
        enableChartLegend,
        getChannelColor,
        setAvailableChannels,
        setChannelGroups,
      ],
    );

    const toggleRecording = useCallback(() => {
      const recordingUrl =
        UrlConstant.LIVE_DATA_RECORDING_URL ||
        "http://localhost:5000/api/recording";
      const commonPayload = { commandId: 170, tabId: tabUniqueId };

      const fetchRecordingData = (payload: {
        commandId: number;
        tabId: string;
        channelList?: number[];
      }): Promise<boolean> =>
        fetch(recordingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) {
              console.error(
                `Recording request failed: ${response.status} ${response.statusText}`,
              );
              return false;
            }
            return true;
          })
          .catch((error: Error) => {
            console.error("Recording fetch error:", error.message);
            return false;
          });

      if (isRecording && !isUpdateRecordingRequired) {
        fetchRecordingData({ ...commonPayload, channelList: [] }).then(
          (ok) => ok && setIsRecording(false),
        );
      } else {
        const channelList = Object.keys(activePlotChannelsRef.current).map(
          (channel) => Number(channel),
        );
        fetchRecordingData({ ...commonPayload, channelList }).then((ok) => {
          if (ok) {
            setIsRecording(true);
            setIsUpdateRecordingRequired(false);
          }
        });
      }
    }, [
      activePlotChannelsRef,
      isRecording,
      isUpdateRecordingRequired,
      setIsRecording,
      tabUniqueId,
    ]);

    // Stable key that only changes when charts are added / removed.
    // Using full chartOptions as a dep would re-fire the layout effect on every
    // live data tick (setChartOptions is called frequently), which feeds back
    // into onLayoutChange → setGridLayout → infinite loop.
    const chartStructureKey = useMemo(
      () => chartOptions.map((c) => c.id).join(","),
      [chartOptions],
    );
    // Keep a ref so the layout effect can read the latest options without
    // listing the full chartOptions array as a dep.
    const chartOptionsRef = useRef(chartOptions);
    chartOptionsRef.current = chartOptions;

    useEffect(() => {
      setGridLayout(
        buildLayoutFromOptionList(chartOptionsRef.current, showChannelSection),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildLayoutFromOptionList, chartStructureKey, showChannelSection]);

    useEffect(() => {
      updateChartDataOption();
    }, [enableChartLegend, channelGroups, primaryGrpName, availableChannels]);

    useEffect(() => {
      console.log(
        "📊 Channel sync detected from LiveDataTable, syncing channels to plots...",
      );

      const allChannelLabels = Object.values(
        channelIdToPlotInfoRef.current,
      ).map((info) => info.label);

      const assignedChannels = channelGroups.flatMap((group) => group.channels);
      const newAvailableChannels = allChannelLabels.filter(
        (label) => !assignedChannels.includes(label),
      );

      setAvailableChannels((prev) => {
        const prevSet = new Set(prev);
        const newSet = new Set(newAvailableChannels);
        if (
          prev.length !== newAvailableChannels.length ||
          !prev.every((ch) => newSet.has(ch))
        ) {
          console.log("📊 Updating availableChannels:", newAvailableChannels);
          return newAvailableChannels.sort((a, b) => a.localeCompare(b));
        }
        return prev;
      });
    }, [triggerChannelSync, channelGroups, setAvailableChannels]);

    useEffect(() => {
      const fullWidth = Math.round(
        (window.innerWidth - (drawerOpenState ? 240 : 65)) *
          (showChannelSection ? 0.65 : 0.94),
      );
      setChartOptions((prev) =>
        prev.map((chart) => {
          const width = fullWidth * (channelGroups.length === 0 ? 1 : 0.485);
          const height =
            window.innerHeight * 0.55 * (channelGroups.length < 2 ? 1 : 0.5);
          return {
            ...chart,
            width,
            height,
            ...(chart.options && {
              options: {
                ...chart.options,
                width,
                height,
              },
            }),
          };
        }),
      );
    }, [channelGroups, drawerOpenState, showChannelSection, setChartOptions]);

    const updateChartDataOption = useCallback(() => {
      setChartOptions((prevOptions) => {
        const updatedOptions = prevOptions.map((chart) => {
          const channels =
            channelGroups?.find((group) => group.id === chart.id)?.channels ??
            availableChannels;
          const dataArray = [];

          const unitToAxisMap = new Map<string, number>();
          const axisY2Array: ReturnType<typeof makeSecondaryAxisY>[] = [];
          let primaryAxisY: ReturnType<typeof makePrimaryAxisY> | null = null;

          // Pass 1 — build Y-axes
          for (let i = 0; i < channels.length; i++) {
            const channelLabel = channels[i];
            const channelId = Object.keys(channelIdToPlotInfoRef.current).find(
              (id) =>
                channelIdToPlotInfoRef.current[id]?.label === channelLabel,
            );
            if (!channelId) continue;
            const channelInfo = channelIdToPlotInfoRef.current[channelId];
            if (!channelInfo) continue;

            const unit = channelInfo.unit || "Value";
            const color = getChannelColor(channelId);

            if (!unitToAxisMap.has(unit)) {
              if (unitToAxisMap.size === 0) {
                unitToAxisMap.set(unit, -1);
                primaryAxisY = makePrimaryAxisY(unit, color);
              } else {
                unitToAxisMap.set(unit, axisY2Array.length);
                axisY2Array.push(makeSecondaryAxisY(unit, color));
              }
            }
          }

          // Pass 2 — build data series
          for (let i = 0; i < channels.length; i++) {
            const channelLabel = channels[i];
            const channelId = Object.keys(channelIdToPlotInfoRef.current).find(
              (id) =>
                channelIdToPlotInfoRef.current[id]?.label === channelLabel,
            );
            if (!channelId) continue;
            const data = activePlotChannelsRef.current[channelId];
            const channelInfo = channelIdToPlotInfoRef.current[channelId];
            if (data === undefined || !channelInfo) continue;

            const unit = channelInfo.unit || "Value";
            const color = getChannelColor(channelId);
            const assignedAxisIndex = unitToAxisMap.get(unit);

            const seriesClick = (e: any) => {
              const ts = new Date(e.dataPoint.x);
              applyStriplineAtRef.current(chart.id, ts);
            };

            const seriesEntry =
              assignedAxisIndex === -1
                ? {
                    ...data,
                    color,
                    lineColor: color,
                    markerColor: color,
                    showInLegend: enableChartLegend,
                    click: seriesClick,
                  }
                : {
                    ...data,
                    color,
                    lineColor: color,
                    markerColor: color,
                    showInLegend: enableChartLegend,
                    axisYType: "secondary",
                    axisYIndex: assignedAxisIndex,
                    click: seriesClick,
                  };

            dataArray.push(seriesEntry);
          }

          const axisY = primaryAxisY ?? FALLBACK_AXIS_Y;

          const chartTitle =
            chart.id === "main"
              ? primaryGrpName
              : channelGroups?.find((group) => group.id === chart.id)?.name ||
                "";

          return {
            ...chart,
            ...(chart.options && {
              options: {
                ...chart.options,
                title: {
                  text: chartTitle,
                  fontSize: 16,
                },
                legend: {
                  ...LEGEND_DEFAULTS,
                  itemclick: ((e: any) => {
                    const channelLabel = e.dataSeries.name;
                    const channelId = Object.keys(
                      channelIdToPlotInfoRef.current,
                    ).find(
                      (id) =>
                        channelIdToPlotInfoRef.current[id]?.label ===
                        channelLabel,
                    );

                    if (channelId && activePlotChannelsRef.current[channelId]) {
                      const newVisibility = !e.dataSeries.visible;
                      e.dataSeries.visible = newVisibility;
                      activePlotChannelsRef.current[channelId].visible =
                        newVisibility;
                      e.chart.render();
                    }

                    return false;
                  }) as any,
                },
                axisY: axisY,
                axisY2: axisY2Array,
                data: dataArray,
              },
            }),
          };
        });

        return updatedOptions;
      });
    }, [
      activePlotChannelsRef,
      availableChannels,
      channelGroups,
      enableChartLegend,
      getChannelColor,
      setChartOptions,
      channelIdToPlotInfoRef,
      primaryGrpName,
    ]);

    const applyRecordedData = useCallback(
      (recordedData: Array<{ [key: string]: string | number }> | null) => {
        Object.keys(activePlotChannelsRef.current).forEach((channel) => {
          activePlotChannelsRef.current[channel].dataPoints = [];
        });
        recordedData?.forEach((data) => {
          const channelId = data["ChannelId"] as string;
          const time = data["_time"] as string;
          const value = data["_value"];
          activePlotChannelsRef.current[channelId]?.dataPoints.push({
            x: new Date(time),
            y: Number(value),
          });
        });
        updateChartDataOption();
      },
      [activePlotChannelsRef, updateChartDataOption],
    );

    const updatePlotsWithRecordedData = useCallback(
      async (id: string, value: number[]) => {
        const utcString = new Date(value[0]).toISOString();
        const recordedData = await fetchRecordedData(utcString, 10);
        applyRecordedData(recordedData);
      },
      [applyRecordedData, fetchRecordedData],
    );

    const handlePauseForAnalysis = useCallback(() => {
      const isPausing = !isPlotPausedForAnalysis;

      if (isPausing) {
        const SomeChannel = Object.keys(activePlotChannelsRef.current)[0];
        const channelData = activePlotChannelsRef.current[SomeChannel];
        const latestTime =
          channelData?.dataPoints[
            channelData.dataPoints.length - 1
          ]?.x.getTime() || Date.now();

        refreshTimeRangeRef(latestTime);

        const startTime = new Date(latestTime - 10000).toISOString();

        fetchRecordedData(startTime, 10)?.then((recordedData) => {
          applyRecordedData(recordedData);
          setIsPlotPausedForAnalysis(true);
        });
      } else {
        setIsPlotPausedForAnalysis(false);
      }
    }, [
      activePlotChannelsRef,
      applyRecordedData,
      fetchRecordedData,
      isPlotPausedForAnalysis,
      refreshTimeRangeRef,
      setIsPlotPausedForAnalysis,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        updateChartDataOption: () => {
          updateChartDataOption();
        },
      }),
      [updateChartDataOption],
    );

    const addChannelToTargetGroup = (
      prevGroups: ChannelGroup[],
      channelId: string,
      destId: string,
    ): ChannelGroup[] => {
      const newGroups = [...prevGroups];
      const targetGroup = newGroups.find((group) => group.id === destId);
      if (targetGroup && !targetGroup.channels.includes(channelId)) {
        targetGroup.channels.push(channelId);
      }
      return newGroups;
    };

    const deleteChannelFromSourceGroup = (
      prevGroups: ChannelGroup[],
      channelId: string,
      sourceId: string,
    ): ChannelGroup[] => {
      const newGroups = [...prevGroups];
      const sourceGroup = newGroups.find((group) => group.id === sourceId);
      if (sourceGroup) {
        sourceGroup.channels = sourceGroup.channels.filter(
          (ch: string) => ch !== channelId,
        );
      }
      return newGroups;
    };

    const handleDragEnd = useCallback(
      (result: DropResult) => {
        if (!result.destination) {
          return;
        }

        const sourceId = result.source.droppableId;
        const destId = result.destination.droppableId;

        if (sourceId === destId) {
          return;
        }

        const channelLabel = result.draggableId;
        const channelId = Object.keys(channelIdToPlotInfoRef.current).find(
          (id) => channelIdToPlotInfoRef.current[id]?.label === channelLabel,
        );
        if (channelId) {
          channelChart.current[channelId] =
            destId === "available-channels" ? "main" : destId;
        }
        setChannelGroups((prevGroups: ChannelGroup[]) => {
          if (sourceId === "available-channels") {
            setAvailableChannels((prev: string[]) =>
              prev.filter((ch) => ch !== channelLabel),
            );
            return addChannelToTargetGroup(prevGroups, channelLabel, destId);
          } else if (destId === "available-channels") {
            setAvailableChannels((prev: string[]) =>
              [...prev, channelLabel].sort((a, b) => a.localeCompare(b)),
            );
            return deleteChannelFromSourceGroup(
              prevGroups,
              channelLabel,
              sourceId,
            );
          } else {
            const newGroups = addChannelToTargetGroup(
              prevGroups,
              channelLabel,
              destId,
            );
            return deleteChannelFromSourceGroup(
              newGroups,
              channelLabel,
              sourceId,
            );
          }
        });
      },
      [channelIdToPlotInfoRef, setAvailableChannels, setChannelGroups],
    );

    const handleResizeMove = useCallback(
      (e: MouseEvent) => {
        if (!resizeRef.current || !resizeID) return;

        const { startX, startY, startWidth, startHeight } = resizeRef.current;
        const newWidth = Math.round(
          Math.max(
            300,
            Math.min(window.innerWidth - 65, startWidth + (e.clientX - startX)),
          ),
        );
        const newHeight = Math.round(
          Math.max(200, Math.min(600, startHeight + (e.clientY - startY) + 50)),
        );

        setChartOptions((prev) =>
          prev.map((chart) =>
            chart.id === resizeID
              ? {
                  ...chart,
                  width: newWidth,
                  height: newHeight,
                  ...(chart.options && {
                    options: {
                      ...chart.options,
                      width: newWidth,
                      height: newHeight - 70,
                    },
                  }),
                }
              : chart,
          ),
        );
      },
      [resizeID, resizeRef, setChartOptions],
    );

    const handleResizeEnd = useCallback(() => {
      setResizeID(null);
      resizeRef.current = null;
    }, [resizeRef, setResizeID]);

    useEffect(() => {
      if (resizeID) {
        window.addEventListener("mousemove", handleResizeMove);
        window.addEventListener("mouseup", handleResizeEnd);
        return () => {
          window.removeEventListener("mousemove", handleResizeMove);
          window.removeEventListener("mouseup", handleResizeEnd);
        };
      }
    }, [resizeID, handleResizeMove, handleResizeEnd]);

    const createNewGroup = () => {
      const uid = uuidv4();
      const newGroup: ChannelGroup = {
        id: uid,
        name: `Group **${uid.slice(-4)}**`,
        channels: [],
      };
      setChartOptions((prevCharts) => {
        const mainChart = prevCharts.find((chart) => chart.id === "main");
        if (!mainChart) return prevCharts;
        const dims = { width: mainChart.width, height: mainChart.height };
        return [
          ...prevCharts,
          makePlotOption(newGroup.id, newGroup.name, dims),
        ];
      });
      setChannelGroups((prev: ChannelGroup[]) => [...prev, newGroup]);
    };

    const removeChannelFromGroup = (groupId: string, channel: string) => {
      setChannelGroups((prevGroups: ChannelGroup[]) => {
        const newGroups = [...prevGroups];
        const targetGroup = newGroups.find((group) => group.id === groupId);
        if (targetGroup) {
          targetGroup.channels = targetGroup.channels.filter(
            (ch: string) => ch !== channel,
          );
          setAvailableChannels((prev: string[]) =>
            [...prev, channel].sort((a, b) => a.localeCompare(b)),
          );
        }
        return newGroups;
      });
    };

    const deleteGroup = (groupId: string) => {
      setChartOptions((prevCharts) =>
        prevCharts.filter((chart) => chart.id !== groupId),
      );

      setChannelGroups((prevGroups: ChannelGroup[]) => {
        const groupToDelete = prevGroups.find((group) => group.id === groupId);
        if (groupToDelete) {
          setAvailableChannels((prev: string[]) =>
            [...prev, ...groupToDelete.channels].sort((a, b) =>
              a.localeCompare(b),
            ),
          );
        }
        return prevGroups.filter((group) => group.id !== groupId);
      });
      if (selectedGroup === groupId) setSelectedGroup(null);
    };

    const updateChartTitle = useCallback(
      (groupId: string, newName: string) => {
        setChartOptions((prevCharts) => {
          return prevCharts.map((chart) => {
            if (chart.id === groupId) {
              return {
                ...chart,
                ...(chart.options && {
                  options: {
                    ...chart.options,
                    title: {
                      text: newName,
                      fontSize: 16,
                    },
                  },
                }),
              };
            }
            return chart;
          });
        });
      },
      [setChartOptions],
    );

    const updateGroup = (groupId: string, newName: string) => {
      setChannelGroups((prevGroups: ChannelGroup[]) => {
        const newGroups = [...prevGroups];
        const targetGroup = newGroups.find((group) => group.id === groupId);
        if (targetGroup) {
          targetGroup.name = newName;
        }
        return newGroups;
      });
      updateChartTitle(groupId, newName);
    };

    const toggleChannelSection = () => {
      setShowChannelSection(!showChannelSection);
    };

    // ── Re-attach click handlers after chart renders ──────────────────────────
    const handleChartRef = useCallback(
      (chartId: string, chartInst: ChartInstance | null) => {
        chartRefs.current[chartId] = chartInst as any;
        if (chartInst) {
          // Small defer so CanvasJS finishes its own setup first
          setTimeout(() => attachChartClickHandler(chartId), 0);
        }
      },
      [attachChartClickHandler],
    );

    // ── Stripline comparison tooltip renderer ─────────────────────────────────
    const renderStriplineTooltip = (chartId: string) => {
      const sl = allStriplines[chartId];
      if (!sl) return null;

      const { x1, x2 } = sl;
      const hasX1 = x1 !== null;
      const hasX2 = x2 !== null;

      if (!hasX1 && !hasX2) return null;

      const nextClick = nextClickRef.current[chartId] ?? "x1";

      // Gather all channel ids present in either marker
      const allChannelIds = Array.from(
        new Set([
          ...Object.keys(x1?.channelValues ?? {}),
          ...Object.keys(x2?.channelValues ?? {}),
        ]),
      );

      return (
        <div className="stripline-tooltip-overlay">
          <div className="slt-header">
            <span className="slt-title">📍 Stripline Analysis</span>
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

          {/* Timestamps row */}
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

          {/* Channel values table */}
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

          {/* Next click indicator */}
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
        </div>
      );
    };

    return (
      <>
        <style>{customPlotsStyles}</style>
        <style>{striplineTooltipStyles}</style>
        <div className="row">
          <div
            className={showChannelSection ? "col-9" : "col-12"}
            style={{ paddingLeft: "20px" }}
          >
            {showChannelSection && (
              <div
                className="align-items-center"
                style={{ display: "contents" }}
              >
                <div
                  className="align-items-center"
                  style={{ display: "contents" }}
                >
                  <CascadingMultiSelect
                    onChannelSelect={handlePlotChannelSelect}
                    connectionStatus={connectionState}
                    onRecordCall={toggleRecording}
                  />
                </div>
              </div>
            )}
          </div>
          <div className={showChannelSection ? "col-9" : "col-12"} ref={divRef}>
            <div className="row plot-margin">
              <GridLayout
                className="layout"
                layout={gridLayout}
                cols={12}
                rowHeight={window.innerHeight * 0.11}
                width={Math.round(
                  (window.innerWidth - (drawerOpenState ? 240 : 65)) *
                    (showChannelSection ? 0.73 : 0.985),
                )}
                isDraggable={true}
                isResizable={false}
                draggableHandle=".draggable-handle"
                onLayoutChange={(newLayout: any) => {
                  const sorted = handleLayoutChange(
                    newLayout,
                    chartOptions,
                    showChannelSection,
                  );
                  setGridLayout((prev) => {
                    // Bail out if nothing actually changed so we don't
                    // feed react-grid-layout's onLayoutChange → setGridLayout
                    // → onLayoutChange infinite loop.
                    if (
                      prev.length === sorted.length &&
                      prev.every(
                        (item, i) =>
                          item.i === sorted[i].i &&
                          item.x === sorted[i].x &&
                          item.y === sorted[i].y &&
                          item.w === sorted[i].w &&
                          item.h === sorted[i].h,
                      )
                    )
                      return prev;
                    return sorted;
                  });
                }}
              >
                {chartOptions.map((chart) => {
                  const sl = allStriplines[chart.id];
                  const hasAnyStripline = sl?.x1 !== null || sl?.x2 !== null;

                  return (
                    <div className="chart-container" key={chart.id}>
                      <div className="plot-data-container">
                        {/* Pause/Resume button */}
                        <Tooltip
                          title={
                            isPlotPausedForAnalysis
                              ? "Resume Monitoring"
                              : "Pause Monitoring"
                          }
                        >
                          <span
                            className="plot-pause-handle"
                            onClick={handlePauseForAnalysis}
                          >
                            {(isPlotPausedForAnalysis && (
                              <PlayCircleOutlineIcon
                                fontSize="medium"
                                color="primary"
                              />
                            )) || (
                              <PauseCircleOutlineIcon
                                fontSize="medium"
                                color="warning"
                              />
                            )}
                          </span>
                        </Tooltip>

                        {/* Stripline instruction badge (shown when no striplines set yet) */}
                        {!hasAnyStripline && (
                          <div
                            style={{
                              position: "absolute",
                              top: 10,
                              left: "50%",
                              transform: "translateX(-50%)",
                              background: "rgba(99,102,241,0.12)",
                              border: "1px dashed rgba(99,102,241,0.4)",
                              borderRadius: 6,
                              padding: "2px 10px",
                              fontSize: 10,
                              color: "#6366f1",
                              fontWeight: 600,
                              zIndex: 20,
                              pointerEvents: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Click chart to set X1 stripline
                          </div>
                        )}

                        <CanvasJSReact.CanvasJSChart
                          ref={(chartInst: ChartInstance) =>
                            handleChartRef(chart.id, chartInst)
                          }
                          options={chart.options}
                        />

                        {/* Stripline tooltip overlay */}
                        {renderStriplineTooltip(chart.id)}

                        {isPlotPausedForAnalysis && (
                          <div className="time-range-handle">
                            <CustomSlider
                              id={chart.id}
                              initValue={[
                                recordedDataTimeRangeRef.current[1] - 5000,
                                recordedDataTimeRangeRef.current[1],
                              ]}
                              range={recordedDataTimeRangeRef.current}
                              onChange={updatePlotsWithRecordedData}
                            />
                          </div>
                        )}
                        <span
                          className="resize-handle"
                          onMouseDown={(e) =>
                            handleResizeStart(
                              e,
                              chart.id,
                              chart.width,
                              chart.height,
                            )
                          }
                        >
                          <Tooltip title="Resize">
                            <TabIcon size={22} />
                          </Tooltip>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
            </div>
          </div>
          <div className="col-3">
            {!showChannelSection && (
              <PlotGroupSelection
                availableChannels={availableChannels}
                bufferTimeWindow={bufferTimeWindow}
                channelGroups={channelGroups}
                legendStatus={enableChartLegend}
                primaryGrpName={primaryGrpName}
                selectedGroup={selectedGroup}
                createNewGroup={createNewGroup}
                deleteGroup={deleteGroup}
                handleDragEnd={handleDragEnd}
                removeChannelFromGroup={removeChannelFromGroup}
                setBufferTimeWindow={setBufferTimeWindow}
                setPrimaryGrpName={setPrimaryGrpName}
                setSelectedGroup={setSelectedGroup}
                toggleChannelSection={toggleChannelSection}
                toggleChartLagend={() =>
                  setEnableChartLegend((state) => !state)
                }
                updateChartTitle={updateChartTitle}
                updateGroup={updateGroup}
              />
            )}
          </div>
        </div>
      </>
    );
  },
);

export default Plots;
