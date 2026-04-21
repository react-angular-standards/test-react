/** @format */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CanvasJSReact from "@canvasjs/react-charts";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";

import CascadingMultiSelect from "./ChannelSelection";
import { useLiveMonitoringContext } from "../../context/LiveMonitorContext";
import { v4 as uuidv4 } from "uuid";
import { DropResult } from "react-beautiful-dnd";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { ThreeBarsIcon, TabIcon, LocationIcon } from "@primer/octicons-react";
import Tooltip from "@mui/material/Tooltip";
import { ChannelGroup } from "../ConfiguredChannelSchema";
import { customPlotsStyles } from "../../Widgets/CustomStyle";
import { ChartInstance } from "../ChartSchema";
import { LayoutItems, LiveMonitoringProps } from "../../../types/PlotDashboard";
import { useGridLayoutSettings } from "../../../hooks/useGridLayoutSettings";
import { CustomSlider } from "../../Widgets/CustomSlider";
import { UrlConstant } from "../../util/UrlConstans";
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
import { striplineTooltipStyles, useStriplines } from "./striplines";

export interface DataChartFunction {
  updateChartDataOption: () => void;
}
interface DataStreamSwitch {
  stop?: boolean;
  commandID?: number;
}

const Plots = forwardRef((props: LiveMonitoringProps, ref) => {
  const { drawerOpenState } = props;
  const {
    activePlotChannelsRef,
    bufferTimeWindow,
    enableChartLegend,
    isRecording,
    isPlotPausedForAnalysis,
    primaryChannelGroup,
    secondaryChannelGroups,
    tabUniqueId,
    chartOptions,
    channelIdToPlotInfoRef,
    connectionState,
    triggerChannelSync,
    setBufferTimeWindow,
    setEnableChartLegend,
    setIsRecording,
    setIsPlotPausedForAnalysis,
    setPrimaryChannelGroup,
    setSecondaryChannelGroups,
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
  const [showChannelSection, setShowChannelSection] = useState(false);

  const {
    recordedDataTimeRangeRef,
    refreshTimeRangeRef,
    fetchRecordedData,
    loading,
  } = useRecordedLiveData();
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

  // ── Stripline logic (state, callbacks, tooltip renderer) ─────────────────
  const {
    allStriplines,
    nextClickRef,
    applyStriplineAtRef,
    clearStriplines,
    handleChartRef,
    renderStriplineTooltip,
  } = useStriplines({
    chartRefs,
    isZoomedRefs,
    primaryChannelGroup,
    secondaryChannelGroups,
    channelIdToPlotInfoRef,
    activePlotChannelsRef,
    setChartOptions,
    isPlotPausedForAnalysis,
  });

  // ── Attach chart-level click handler (fires on empty-area clicks too) ──────
  const attachChartClickHandler = useCallback((chartId: string) => {
    const chartInst = (chartRefs.current[chartId] as any)?.chart as
      | (ChartInstance & { render: () => void })
      | undefined;
    if (!chartInst?.options) return;

    (chartInst.options as any).click = (e: any) => {
      const ts: Date | null = e.axisX?.[0] ? new Date(e.axisX[0].value) : null;
      if (!ts || isNaN(ts.getTime())) return;
      // applyStriplineAtRef.current(chartId, ts);
    };

    chartInst.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartStructureKey = useMemo(
    () => chartOptions.map((c) => `${c.id}-${c.width}-${c.height}`).join(","),
    [chartOptions],
  );
  const chartOptionsRef = useRef(chartOptions);
  chartOptionsRef.current = chartOptions;

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
      const assignedChannels = secondaryChannelGroups.flatMap(
        (group) => group.channels,
      );

      setPrimaryChannelGroup((prev) => {
        const prevGroup = prev;
        const newAvailable = prevGroup.channels.filter((ch) =>
          selectedLabels.includes(ch),
        );
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

        return {
          ...prevGroup,
          channels: [...newAvailable, ...newChannels].sort((a, b) =>
            a.localeCompare(b),
          ),
        };
      });

      setSecondaryChannelGroups((prevGroups: ChannelGroup[]) => {
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
      secondaryChannelGroups,
      enableChartLegend,
      getChannelColor,
      setPrimaryChannelGroup,
      setSecondaryChannelGroups,
    ],
  );

  const toggleDataStreamNRecording = useCallback(
    (option?: DataStreamSwitch) => {
      const recordingUrl = UrlConstant.LIVE_DATA_RECORDING_URL;
      const commonPayload = {
        commandId: option?.commandID ?? 170,
        tabId: tabUniqueId,
      };
      //Todo: Need change this and reuse exist post hook
      const fetchRecordingData = (payload: {
        commandId: number;
        tabId: string;
        channelList?: number[];
      }): Promise<boolean> =>
        fetch(recordingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            if (!response.ok) {
              console.error(`recording request failed: ${response.statusText}`);
              return false;
            }
            return true;
          })
          .catch((error) => {
            console.error("Recording error:", error);
            // alert('Failed to process recording request.');
            return false;
          });

      let channelList: number[] = [];
      if (!option || option.stop === false) {
        const activeIds = Object.keys(activePlotChannelsRef.current);
        const channelIds =
          activeIds.length > 0
            ? activeIds
            : Object.keys(channelIdToPlotInfoRef.current);
        channelList = channelIds.map(Number);
      }
      fetchRecordingData({ ...commonPayload, channelList }).then((ok) => {
        if (ok) {
          setIsRecording(true);
          setIsUpdateRecordingRequired(false);
        }
      });
    },
    [
      activePlotChannelsRef,
      channelIdToPlotInfoRef,
      isRecording,
      isUpdateRecordingRequired,
      setIsRecording,
      tabUniqueId,
    ],
  );

  useEffect(() => {
    toggleDataStreamNRecording({ commandID: 170, stop: true });
    toggleDataStreamNRecording({ commandID: 171, stop: true });
  }, [connectionState]);
  useEffect(() => {
    // const layout = buildLayoutFromOptionList(chartOptions, showChannelSection);
    setGridLayout(
      buildLayoutFromOptionList(chartOptionsRef.current, showChannelSection, isPlotPausedForAnalysis),
    );
  }, [buildLayoutFromOptionList, chartStructureKey, showChannelSection]);

  useEffect(() => {
    updateChartDataOption();
  }, [enableChartLegend, secondaryChannelGroups, primaryChannelGroup]);

  useEffect(() => {
    console.log(
      "📊 Channel sync detected from LiveDataTable, syncing channels to plots...",
    );

    const allChannelLabels = Object.values(channelIdToPlotInfoRef.current).map(
      (info) => info.label,
    );

    const assignedChannels = secondaryChannelGroups.flatMap(
      (group) => group.channels,
    );
    const newAvailableChannels = allChannelLabels.filter(
      (label) => !assignedChannels.includes(label),
    );

    setPrimaryChannelGroup((prev) => {
      const prevGroup = prev;
      if (
        prevGroup.channels.length !== newAvailableChannels.length ||
        !prevGroup.channels.every((ch) => newAvailableChannels.includes(ch))
      ) {
        return {
          ...prevGroup,
          channels: newAvailableChannels.sort((a, b) => a.localeCompare(b)),
        };
      }
      return prev;
    });
  }, [triggerChannelSync, secondaryChannelGroups, setPrimaryChannelGroup]);

  useEffect(() => {
    const fullWidth = Math.round(
      (window.innerWidth - (drawerOpenState ? 240 : 65)) *
        (showChannelSection ? 0.65 : 0.94),
    );
    setChartOptions((prev) =>
      prev.map((chart) => {
        const width =
          fullWidth * (secondaryChannelGroups.length === 0 ? 1 : 0.485);
        const height =
          window.innerHeight *
          0.55 *
          (secondaryChannelGroups.length < 2 ? 1 : 0.5);
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
  }, [
    secondaryChannelGroups,
    drawerOpenState,
    showChannelSection,
    setChartOptions,
  ]);

  const updateChartDataOption = useCallback(() => {
    setChartOptions((prevOptions) => {
      const updatedOptions = prevOptions.map((chart) => {
        const channels =
          secondaryChannelGroups?.find((group) => group.id === chart.id)
            ?.channels ??
          primaryChannelGroup?.channels ??
          [];
        const dataArray = [];

        const unitToAxisMap = new Map<string, number>();
        const axisY2Array: ReturnType<typeof makeSecondaryAxisY>[] = [];
        let primaryAxisY: ReturnType<typeof makePrimaryAxisY> | null = null;

        // Pass 1 — build Y-axes
        for (let i = 0; i < channels.length; i++) {
          //channels.forEach((channelLabel) => {
          const channelLabel = channels[i];
          const channelId = Object.keys(channelIdToPlotInfoRef.current).find(
            (id) => channelIdToPlotInfoRef.current[id]?.label === channelLabel,
          );
          if (!channelId) continue;
          const channelInfo = channelIdToPlotInfoRef.current[channelId];
          if (!channelInfo) continue;

          const data = activePlotChannelsRef.current[channelId];
          if (data === undefined) continue;

          const unit = channelInfo.unit || "Value";
          const color = getChannelColor(channelId);
          let assignedAxisIndex = unitToAxisMap.get(unit);
          if (assignedAxisIndex === undefined) {
            if (unitToAxisMap.size === 0) {
              assignedAxisIndex = -1;
              unitToAxisMap.set(unit, assignedAxisIndex);
              primaryAxisY = makePrimaryAxisY(unit, color);
            } else {
              assignedAxisIndex = axisY2Array.length;
              unitToAxisMap.set(unit, assignedAxisIndex);
              axisY2Array.push(makeSecondaryAxisY(unit, color));
            }
          }
          const seriesClick = (e: any) => {
            const ts = new Date(e.dataPoint.x);
            applyStriplineAtRef.current(chart.id, ts);
          };
          const seriesEntry =
            assignedAxisIndex === -1
              ? {
                  ...data,
                  showInLegend: enableChartLegend,
                  click: seriesClick,
                }
              : {
                  ...data,
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
            ? primaryChannelGroup.name
            : secondaryChannelGroups?.find((group) => group.id === chart.id)
                ?.name || "";

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
    primaryChannelGroup,
    secondaryChannelGroups,
    enableChartLegend,
    getChannelColor,
    setChartOptions,
    channelIdToPlotInfoRef,
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
      setIsPlotPausedForAnalysis(true);
      fetchRecordedData(startTime, 10)?.then((recordedData) => {
        // applyRecordedData(recordedData);
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
      setSecondaryChannelGroups((prevGroups: ChannelGroup[]) => {
        if (sourceId === "available-channels") {
          setPrimaryChannelGroup((prev) => {
            return {
              ...prev,
              channels: prev.channels.filter((ch) => ch !== channelLabel),
            };
          });
          return addChannelToTargetGroup(prevGroups, channelLabel, destId);
        } else if (destId === "available-channels") {
          setPrimaryChannelGroup((prev) => {
            return {
              ...prev,
              channels: [...prev.channels, channelLabel].sort((a, b) =>
                a.localeCompare(b),
              ),
            };
          });
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
    [channelIdToPlotInfoRef, setPrimaryChannelGroup, setSecondaryChannelGroups],
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
      return [...prevCharts, makePlotOption(newGroup.id, newGroup.name, dims)];
    });
    setSecondaryChannelGroups((prev: ChannelGroup[]) => [...prev, newGroup]);
  };

  const removeChannelFromGroup = (groupId: string, channel: string) => {
    setSecondaryChannelGroups((prevGroups: ChannelGroup[]) => {
      const newGroups = [...prevGroups];
      const targetGroup = newGroups.find((group) => group.id === groupId);
      if (targetGroup) {
        targetGroup.channels = targetGroup.channels.filter(
          (ch: string) => ch !== channel,
        );
        setPrimaryChannelGroup((prev) => {
          return {
            ...prev,
            channels: [...prev.channels, channel].sort((a, b) =>
              a.localeCompare(b),
            ),
          };
        });
      }
      return newGroups;
    });
  };

  const deleteGroup = (groupId: string) => {
    setChartOptions((prevCharts) =>
      prevCharts.filter((chart) => chart.id !== groupId),
    );

    setSecondaryChannelGroups((prevGroups: ChannelGroup[]) => {
      const groupToDelete = prevGroups.find((group) => group.id === groupId);
      if (groupToDelete) {
        setPrimaryChannelGroup((prev) => {
          return {
            ...prev,
            channels: [...prev.channels, ...groupToDelete.channels].sort(
              (a, b) => a.localeCompare(b),
            ),
          };
        });
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
    setSecondaryChannelGroups((prevGroups: ChannelGroup[]) => {
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

      <div className="main-content row position-relative">
        {!showChannelSection && (
          <div className="col-12">
            <div className="controls-section bg-custom-green rounded-lg shadow round-border p-2 m-4 mt-1">
              <div
                className="align-items-center"
                style={{ display: "contents" }}
              >
                <CascadingMultiSelect
                  onChannelSelect={handlePlotChannelSelect}
                  connectionStatus={connectionState}
                  onRecordCall={toggleDataStreamNRecording}
                />
              </div>
            </div>
          </div>
        )}
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
              compactType="vertical"
              draggableHandle=".draggable-handle"
              onLayoutChange={(newLayout: LayoutItems[]) => {
                setChartOptions((options) => {
                  const sortedOptions = handleLayoutChange(
                    newLayout,
                    options,
                    showChannelSection,
                  );
                  return sortedOptions;
                });
              }}
            >
              {chartOptions.map((chart) => {
                const sl = allStriplines[chart.id];
                const hasAnyStripline = sl?.x1 !== null || sl?.x2 !== null;

                return (
                  <div key={chart.id} className="chart-container"
                    style={{
                      zIndex: resizeID === chart.id ? 10 : 1,
                      position: "relative",
                      backgroundColor: "#fff",
                    }}
                  >
                    {loading && (
                      <div className="loader-container">
                        <img
                          style={{ float: "unset" }}
                          src="./server_loader.gif"
                          width={30}
                          alt="Loading..."
                        />
                      </div>
                    )}
                    <div
                      className="bg-white rounded-lg shadow round-border chart-wrapper "
                      style={{
                        width: `${chart.width + 30}px`,
                        height: `${chart.height + 30}px`,
                        position: "relative",
                        boxSizing: "border-box",
                      }}
                    >
                      <span className="draggable-handle">
                        <Tooltip title="Relocate">
                          <LocationIcon size={22} />
                        </Tooltip>
                      </span>{" "}
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
                      {/* <CanvasJSReact.CanvasJSChart
                        ref={(ref: ChartInstance) => (chartRefs.current[chart.id] = ref)}
                        options={chart.options}
                      /> */}
                      <CanvasJSReact.CanvasJSChart
                        ref={(chartInst: ChartInstance) =>
                          handleChartRef(chart.id, chartInst)
                        }
                        options={chart.options}
                      />
                      {isPlotPausedForAnalysis &&
                        renderStriplineTooltip(chart.id)}
                      {isPlotPausedForAnalysis && (
                        <span className="time-range-handle">
                          <CustomSlider
                            id={chart.id}
                            initValue={[
                              recordedDataTimeRangeRef.current[1] - 5000,
                              recordedDataTimeRangeRef.current[1],
                            ]}
                            range={recordedDataTimeRangeRef.current}
                            onChange={updatePlotsWithRecordedData}
                          />
                        </span>
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
            <div
              className="toggle-icon-hidden"
              onClick={toggleChannelSection}
              title="Show dashboard settings"
            >
              <ThreeBarsIcon size={24} />
            </div>
          )}
          {showChannelSection && (
            <PlotGroupSelection
              primaryChannelGroup={primaryChannelGroup}
              bufferTimeWindow={bufferTimeWindow}
              secondaryChannelGroups={secondaryChannelGroups}
              legendStatus={enableChartLegend}
              selectedGroup={selectedGroup}
              createNewGroup={createNewGroup}
              deleteGroup={deleteGroup}
              handleDragEnd={handleDragEnd}
              removeChannelFromGroup={removeChannelFromGroup}
              setBufferTimeWindow={setBufferTimeWindow}
              setSelectedGroup={setSelectedGroup}
              toggleChannelSection={toggleChannelSection}
              toggleChartLagend={() => setEnableChartLegend((state) => !state)}
              updateChartTitle={updateChartTitle}
              updateGroup={updateGroup}
            />
          )}
        </div>
      </div>
    </>
  );
});
Plots.displayName = "Plots";
export default Plots;
