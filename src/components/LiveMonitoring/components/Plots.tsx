/** @format */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  DEFAULT_AXIS_COLOR,
} from "../config/chartConfig";

interface LiveMonitoringProps {
  drawerOpenState: boolean;
}

export interface DataChartFunction {
  updateChartDataOption: () => void;
}

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

    const { recordedDataTimeRangeRef, refreshTimeRangeRef, fetchRecordedData } =
      useRecordedLiveData();
    const chartRefs = useRef<{
      [key: string]: CanvasJSReact.CanvasJSChart | null;
    }>({ main: null });
    const isZoomedRefs = useRef<{ [key: string]: boolean }>({ main: false });
    const channelChart = useRef<{ [chid: number | string]: string | null }>({
      main: null,
    });

    const handlePlotChannelSelect = useCallback(
      (selectedChannelIds: string[]) => {
        // Use channelIdToPlotInfoRef directly - no splitting needed
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
              channelInfo.color || DEFAULT_AXIS_COLOR,
              axisIndex,
              enableChartLegend,
            );
          }
        });

        // Get labels for comparison with existing channel groups
        const selectedLabels = selectedChannelIds.map(
          (id) => channelIdToPlotInfoRef.current[id]?.label || id,
        );
        const assignedChannels = channelGroups.flatMap(
          (group) => group.channels,
        );

        setAvailableChannels((prev: string[]) => {
          console.log("selectedChannelIds", selectedChannelIds);
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
                // Find channelId from label
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
      }) =>
        fetch(recordingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((response) => response.json())
          .catch((error) => {
            console.error("Recording error:", error);
            alert("Failed to process recording request.");
            throw error;
          });

      if (isRecording && !isUpdateRecordingRequired) {
        fetchRecordingData({ ...commonPayload, channelList: [] }).then(() => {
          setIsRecording(false);
        });
      } else {
        const channelList = Object.keys(activePlotChannelsRef.current).map(
          (channel) => Number(channel),
        );
        fetchRecordingData({ ...commonPayload, channelList }).then(() => {
          setIsRecording(true);
          setIsUpdateRecordingRequired(false);
        });
      }
    }, [
      activePlotChannelsRef,
      isRecording,
      isUpdateRecordingRequired,
      setIsRecording,
      tabUniqueId,
    ]);

    useEffect(() => {
      const layout = buildLayoutFromOptionList(
        chartOptions,
        showChannelSection,
      );
      setGridLayout(layout);
    }, [
      buildLayoutFromOptionList,
      chartOptions,
      showChannelSection,
      setGridLayout,
    ]);

    useEffect(() => {
      Object.keys(chartRefs.current).forEach((chartId) => {
        const chart = chartRefs.current[chartId] as unknown as ChartInstance;
        if (chart?.options) {
          chart.options.rangeChanged = (e) => {
            const isZoomed =
              e.axisX[0].viewportMinimum != null ||
              e.axisX[0].viewportMaximum != null;
            isZoomedRefs.current[chartId] = isZoomed;
          };
        }
      });
    }, []);

    useEffect(() => {
      updateChartDataOption();
    }, [enableChartLegend, channelGroups, primaryGrpName, availableChannels]);

    // Watch for channel sync from LiveDataTable and update available channels
    useEffect(() => {
      console.log(
        "📊 Channel sync detected from LiveDataTable, syncing channels to plots...",
      );

      // Get all channels from channelIdToPlotInfoRef
      const allChannelLabels = Object.values(
        channelIdToPlotInfoRef.current,
      ).map((info) => info.label);

      // Filter out channels that are already in groups
      const assignedChannels = channelGroups.flatMap((group) => group.channels);
      const newAvailableChannels = allChannelLabels.filter(
        (label) => !assignedChannels.includes(label),
      );

      // Update available channels - this will trigger updateChartDataOption via the effect above
      setAvailableChannels((prev) => {
        const prevSet = new Set(prev);
        const newSet = new Set(newAvailableChannels);
        // Only update if there's a difference
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

          // unit → axis assignment: -1 = primary axisY, 0+ = axisY2 index
          const unitToAxisMap = new Map<string, number>();
          const axisY2Array: ReturnType<typeof makeSecondaryAxisY>[] = [];
          let primaryAxisY: ReturnType<typeof makePrimaryAxisY> | null = null;

          // Pass 1 — build Y-axes, one per unique unit, colour-matched to channel
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
            const color = channelInfo.color || DEFAULT_AXIS_COLOR;

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

          // Pass 2 — build data series, keeping colour consistent with the axis
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
            const color = channelInfo.color || DEFAULT_AXIS_COLOR;
            const assignedAxisIndex = unitToAxisMap.get(unit);

            const seriesEntry =
              assignedAxisIndex === -1
                ? {
                    ...data,
                    // ensure colour stays in sync even if ref was mutated
                    color,
                    lineColor: color,
                    markerColor: color,
                    showInLegend: enableChartLegend,
                  }
                : {
                    ...data,
                    color,
                    lineColor: color,
                    markerColor: color,
                    showInLegend: enableChartLegend,
                    axisYType: "secondary",
                    axisYIndex: assignedAxisIndex,
                  };

            dataArray.push(seriesEntry);
          }

          const axisY = primaryAxisY ?? FALLBACK_AXIS_Y;

          // Get the title for this chart
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
                    // Find channelId from label
                    const channelId = Object.keys(
                      channelIdToPlotInfoRef.current,
                    ).find(
                      (id) =>
                        channelIdToPlotInfoRef.current[id]?.label ===
                        channelLabel,
                    );

                    if (channelId && activePlotChannelsRef.current[channelId]) {
                      // Toggle visibility in both the chart and our ref
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
      setChartOptions,
      channelIdToPlotInfoRef,
      primaryGrpName,
    ]);

    /**
     * Shared helper — clears all live dataPoints, fills them with the API
     * response, then re-renders the chart.
     * Used by both handlePauseForAnalysis (on pause) and
     * updatePlotsWithRecordedData (on slider scrub).
     */
    const applyRecordedData = useCallback(
      (recordedData: Array<{ [key: string]: string | number }> | null) => {
        // Clear existing live data first
        Object.keys(activePlotChannelsRef.current).forEach((channel) => {
          activePlotChannelsRef.current[channel].dataPoints = [];
        });
        // Push fetched points into the correct channel buffers
        recordedData?.forEach((data) => {
          const channelId = data["ChannelId"] as string;
          const time = data["_time"] as string;
          const value = data["_value"];
          activePlotChannelsRef.current[channelId]?.dataPoints.push({
            x: new Date(time),
            y: Number(value),
          });
        });
        // Re-render all charts with the new data
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

        // Anchor the slider range to the latest live timestamp
        refreshTimeRangeRef(latestTime);

        const startTime = new Date(latestTime - 10000).toISOString();

        // Fetch recorded data FIRST, then flip to paused so the slider
        // and chart are fully populated before they become visible.
        fetchRecordedData(startTime, 10)?.then((recordedData) => {
          applyRecordedData(recordedData);
          // Only switch to paused AFTER data has been applied to the chart
          setIsPlotPausedForAnalysis(true);
        });
      } else {
        // Resuming — flip state immediately; live data resumes via WebSocket
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
        // Find channelId from label
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
                  setGridLayout(sorted);
                }}
              >
                {chartOptions.map((chart) => {
                  return (
                    <div className="chart-container" key={chart.id}>
                      <div className="plot-data-container">
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
                        <CanvasJSReact.CanvasJSChart
                          ref={(ref: ChartInstance) =>
                            (chartRefs.current[chart.id] = ref)
                          }
                          options={chart.options}
                        />
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

Plots.displayName = "Plots";
export default Plots;
