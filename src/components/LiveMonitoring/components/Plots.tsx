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
import { useStriplines, striplineTooltipStyles } from "./striplines";
import { useGridLayoutSettings } from "../../../hooks/useGridLayoutSettings";
import { LayoutItems, LiveMonitoringProps } from "../../../types/PotDashboard";
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

export interface DataChartFunction {
  updateChartDataOption: () => void;
}

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
      dataStreamWSRef,
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
    // ── Stripline logic (state, callbacks, tooltip renderer) ─────────────────
    const {
      allStriplines,
      nextClickRef,
      applyStriplineAtRef,
      attachChartClickHandler,
      clearStriplines,
      handleChartRef,
      renderStriplineTooltip,
    } = useStriplines({
      chartRefs,
      isZoomedRefs,
      channelGroups,
      availableChannels,
      channelIdToPlotInfoRef,
      activePlotChannelsRef,
      setChartOptions,
      isPlotPausedForAnalysis,
    });

    const handlePlotChannelSelect = useCallback(
      (selectedChannelIds: string[]) => {
        // Remove channels from the ref that are no longer in the selection.
        // This ensures stale channels from a previous streaming session don't
        // persist when the user updates the channel list and starts a new stream.
        Object.keys(activePlotChannelsRef.current).forEach((existingId) => {
          if (!selectedChannelIds.includes(existingId)) {
            delete activePlotChannelsRef.current[existingId];
          }
        });

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
        const activeIds = Object.keys(activePlotChannelsRef.current);
        const channelIds =
          activeIds.length > 0
            ? activeIds
            : Object.keys(channelIdToPlotInfoRef.current);
        const channelList = channelIds.map(Number);
        fetchRecordingData({ ...commonPayload, channelList }).then((ok) => {
          if (ok) {
            setIsRecording(true);
            setIsUpdateRecordingRequired(false);
          }
        });
      }
    }, [
      activePlotChannelsRef,
      channelIdToPlotInfoRef,
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

          // Single pass — register Y-axis for the unit (if new), then build the series
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

            // Register the axis the first time this unit is seen
            if (!unitToAxisMap.has(unit)) {
              if (unitToAxisMap.size === 0) {
                unitToAxisMap.set(unit, -1);
                primaryAxisY = makePrimaryAxisY(unit, color);
              } else {
                unitToAxisMap.set(unit, axisY2Array.length);
                axisY2Array.push(makeSecondaryAxisY(unit, color));
              }
            }

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

        // Pause immediately so the UI responds without waiting for the fetch
        setIsPlotPausedForAnalysis(true);
        fetchRecordedData(startTime, 10)?.then((recordedData) => {
          applyRecordedData(recordedData);
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

    // ── Stable refs so the onmessage closure never goes stale ────────────────
    const bufferTimeWindowRef = useRef(bufferTimeWindow);
    bufferTimeWindowRef.current = bufferTimeWindow;

    const isPlotPausedRef = useRef(isPlotPausedForAnalysis);
    isPlotPausedRef.current = isPlotPausedForAnalysis;

    // ── Wire live-data WebSocket → dataPoints → render ────────────────────────
    useEffect(() => {
      const ws = dataStreamWSRef.current;
      if (!ws) return;

      const handler = (event: MessageEvent) => {
        // Skip rendering while user is doing pause-analysis
        if (isPlotPausedRef.current) return;

        let messages: any[];
        try {
          const parsed = JSON.parse(event.data);
          // Accept both a single object and an array of objects
          messages = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return;
        }

        const cutoffMs = bufferTimeWindowRef.current * 1000;
        let hasNewData = false;

        messages.forEach((msg: any) => {
          // Support both { ChannelId, _time, _value } and { channelId, timestamp, value }
          const channelId =
            msg.ChannelId !== undefined
              ? String(msg.ChannelId)
              : msg.channelId !== undefined
                ? String(msg.channelId)
                : null;

          const rawTime = msg._time ?? msg.timestamp ?? msg.time;
          const rawValue = msg._value ?? msg.value;

          if (
            channelId === null ||
            rawTime === undefined ||
            rawValue === undefined
          )
            return;
          if (!activePlotChannelsRef.current[channelId]) return;

          const pt = { x: new Date(rawTime), y: Number(rawValue) };
          if (isNaN(pt.x.getTime()) || isNaN(pt.y)) return;

          const dp = activePlotChannelsRef.current[channelId].dataPoints;
          dp.push(pt);

          // Trim points older than the buffer window
          const cutoff = pt.x.getTime() - cutoffMs;
          let trimIdx = 0;
          while (trimIdx < dp.length && dp[trimIdx].x.getTime() < cutoff) {
            trimIdx++;
          }
          if (trimIdx > 0) dp.splice(0, trimIdx);

          hasNewData = true;
        });

        // Re-render all charts in one pass — no React state update, no re-render
        if (hasNewData) {
          Object.keys(chartRefs.current).forEach((chartId) => {
            const inst = (chartRefs.current[chartId] as any)?.chart;
            inst?.render?.();
          });
        }
      };

      ws.addEventListener("message", handler);
      return () => ws.removeEventListener("message", handler);
    }, [
      // Re-wire only when the socket instance itself changes
      dataStreamWSRef.current, // eslint-disable-line react-hooks/exhaustive-deps
      activePlotChannelsRef,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        // Called by the parent on every live-data tick to refresh the display.
        // Chart data lives in activePlotChannelsRef (already referenced by the
        // CanvasJS options), so a direct render() is all that's needed — no
        // React state update, no component re-render, no renderStriplineTooltip
        // re-call.  Structural rebuilds (new channels, axis changes, legend) are
        // handled automatically by the internal useEffect that watches
        // channelGroups / availableChannels / enableChartLegend / primaryGrpName.
        updateChartDataOption: () => {
          if (isPlotPausedForAnalysis) return;
          Object.keys(chartRefs.current).forEach((chartId) => {
            const inst = (chartRefs.current[chartId] as any)?.chart;
            inst?.render?.();
          });
        },
      }),
      [isPlotPausedForAnalysis],
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
                  const sorted: LayoutItems[] = handleLayoutChange(
                    newLayout,
                    chartOptions,
                    showChannelSection,
                  );
                  // Compare against current gridLayout from closure to avoid
                  // the onLayoutChange → setGridLayout → onLayoutChange loop.
                  const unchanged =
                    gridLayout.length === sorted.length &&
                    gridLayout.every(
                      (item, i) =>
                        item.i === sorted[i].i &&
                        item.x === sorted[i].x &&
                        item.y === sorted[i].y &&
                        item.w === sorted[i].w &&
                        item.h === sorted[i].h,
                    );
                  if (!unchanged) setGridLayout(sorted);
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

                        {/* Stripline instruction badge (shown only when paused and no striplines set yet) */}
                        {isPlotPausedForAnalysis && !hasAnyStripline && (
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

                        {/* Stripline tooltip overlay (only visible when paused for analysis) */}
                        {isPlotPausedForAnalysis &&
                          renderStriplineTooltip(chart.id)}

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
