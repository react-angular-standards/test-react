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
import { LayoutItems } from "../../../types/PlotDashboard";
import { useGridLayoutSettings } from "../../../hooks/useGridLayoutSettings";
import { CustomSlider } from "../../Widgets/CustomSlider";
import { UrlConstant } from "../../../util/UrlConstans";
import { useRecordedLiveData } from "../../../hooks/useRecordedLiveData";
import { PlotGroupSelection } from "./PlotGroupSelection";

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

    const handleLegendClick = useCallback(
      (channelIdOrName: string) => {
        // Extract numeric ID if it contains " - " separator
        const numericId = channelIdOrName.includes(" - ")
          ? channelIdOrName.split(" - ")[0]
          : channelIdOrName;

        if (activePlotChannelsRef.current[numericId]) {
          activePlotChannelsRef.current[numericId].visible = !(
            activePlotChannelsRef?.current[numericId]?.visible || false
          );
        }
      },
      [activePlotChannelsRef],
    );

    const updatePlotsWithRecordedData = useCallback(
      async (id: string, value: number[]) => {
        const dateObject = new Date(value[0]);
        const utcString = dateObject.toISOString();
        const duration = 10;
        const response = fetchRecordedData(utcString, duration);
        Object.keys(activePlotChannelsRef.current).forEach((channel) => {
          activePlotChannelsRef.current[channel].dataPoints = [];
        });
        const recordedData = await response;
        recordedData?.forEach((data) => {
          activePlotChannelsRef.current[data.ChannelId]?.dataPoints.push({
            x: new Date(data._time),
            y: Number(data._value),
          });
        });
      },
      [activePlotChannelsRef, fetchRecordedData],
    );

    const handlePauseForAnalysis = useCallback(() => {
      const SomeChannel = Object.keys(activePlotChannelsRef.current)[0];
      const channelData = activePlotChannelsRef.current[SomeChannel];
      const latestTime =
        channelData?.dataPoints[
          channelData.dataPoints.length - 1
        ]?.x.getTime() || Date.now();
      refreshTimeRangeRef(latestTime);
      setIsPlotPausedForAnalysis((state) => !state);
    }, [
      activePlotChannelsRef,
      refreshTimeRangeRef,
      setIsPlotPausedForAnalysis,
    ]);

    const handlePlotChannelSelect = useCallback(
      (selectedChannels: string[]) => {
        selectedChannels.forEach((channel) => {
          // Extract numeric ID from "channelId - channelName" format
          const numericId = channel.split(" - ")[0];
          const channelName = `${channel}`;
          const channelInfo = channelIdToPlotInfoRef.current[numericId];

          if (!channelInfo) {
            console.warn("Channel info not found for:", numericId, channel);
            return;
          }

          const axisIndex = channelInfo.yAxisIndex;
          if (!activePlotChannelsRef.current[numericId]) {
            activePlotChannelsRef.current[numericId] = {
              type: "line",
              name: channelName,
              showInLegend: enableChartLegend,
              visible: true,
              axisYIndex: axisIndex,
              lineColor: channelInfo.color,
              markerColor: channelInfo.color,
              dataPoints: [],
            };
          }
        });

        const assignedChannels = channelGroups.flatMap(
          (group) => group.channels,
        );

        setAvailableChannels((prev: string[]) => {
          console.log("selectedChannels", selectedChannels);
          const newAvailable = prev.filter((ch) =>
            selectedChannels.includes(ch),
          );
          const newChannels = selectedChannels.filter((ch) => {
            const numericId = ch.split(" - ")[0];
            channelChart.current[numericId] = "main";
            return !assignedChannels.includes(ch) && !newAvailable.includes(ch);
          });

          return [...newAvailable, ...newChannels].sort((a, b) =>
            a.localeCompare(b),
          );
        });

        setChannelGroups((prevGroups: ChannelGroup[]) => {
          const newGroups = prevGroups.map((group) => ({
            ...group,
            channels: group.channels.filter((ch) => {
              const res = selectedChannels.includes(ch);

              if (res) {
                const numericId = ch.split(" - ")[0];
                channelChart.current[numericId] = group.id;
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
    }, [enableChartLegend, channelGroups]);

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
          const stripLinesArray = [];

          // Collect data for each channel and create stripLines
          let stripLineIndex = 0;
          for (const channelId of channels) {
            const numericId = channelId.includes(" - ")
              ? channelId.split(" - ")[0]
              : channelId;
            const data = activePlotChannelsRef.current[numericId];

            if (data !== undefined) {
              data.showInLegend = enableChartLegend;
              dataArray.push(data);
            }

            // Create stripLine for each channel regardless of data
            const channelInfo = channelIdToPlotInfoRef.current[numericId];
            console.log("Channel Info:", numericId, channelInfo);
            console.log("Data points:", data?.dataPoints?.length);

            if (channelInfo) {
              // Use current time or latest data point
              let xPosition;
              if (data?.dataPoints && data.dataPoints.length > 0) {
                xPosition = data.dataPoints[data.dataPoints.length - 1].x;
              } else {
                // Use current time offset by index to space them out
                xPosition = new Date(Date.now() + stripLineIndex * 10000);
              }

              const stripLine = {
                value: xPosition,
                label: channelInfo.unit || "Value",
                labelFontColor: channelInfo.color || "#369EAD",
                labelFontSize: 14,
                labelAlign: "center",
                labelPlacement: "outside",
                color: channelInfo.color || "#369EAD",
                thickness: 3,
                lineDashType: "solid",
                showOnTop: true,
              };

              console.log("Adding stripLine:", stripLine);
              stripLinesArray.push(stripLine);
              stripLineIndex++;
            }
          }

          console.log(
            "Total stripLines:",
            stripLinesArray.length,
            stripLinesArray,
          );

          // Single Y-axis for all channels
          const axisYArray = [
            {
              title: "Value",
              titleFontSize: 14,
              lineColor: "#369EAD",
              tickColor: "#369EAD",
              labelFontColor: "#369EAD",
              gridThickness: 1,
            },
          ];

          // If no axes defined, use default single axis
          const finalAxisY =
            axisYArray.length > 0
              ? axisYArray
              : [
                  {
                    title: "Values",
                    titleFontSize: 14,
                    lineColor: "#369EAD",
                  },
                ];

          return {
            ...chart,
            ...(chart.options && {
              options: {
                ...chart.options,
                axisX: {
                  ...chart.options.axisX,
                  stripLines: stripLinesArray,
                },
                legend: {
                  cursor: "pointer",
                  fontSize: 16,
                  itemclick: ((e: any) => {
                    handleLegendClick(e.dataSeries.name.replace(/-.*$/g, ""));
                    return false;
                  }) as any,
                },
                axisY: finalAxisY,
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
      handleLegendClick,
      setChartOptions,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        updateChartDataOption,
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
          (ch) => ch !== channelId,
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

        const channelId = result.draggableId;
        const numericId = channelId.split(" - ")[0];
        channelChart.current[numericId] =
          destId === "available-channels" ? "main" : destId;
        setChannelGroups((prevGroups: ChannelGroup[]) => {
          if (sourceId === "available-channels") {
            setAvailableChannels((prev: string[]) =>
              prev.filter((ch) => ch !== channelId),
            );
            return addChannelToTargetGroup(prevGroups, channelId, destId);
          } else if (destId === "available-channels") {
            setAvailableChannels((prev: string[]) =>
              [...prev, channelId].sort((a, b) => a.localeCompare(b)),
            );
            return deleteChannelFromSourceGroup(
              prevGroups,
              channelId,
              sourceId,
            );
          } else {
            const newGroups = addChannelToTargetGroup(
              prevGroups,
              channelId,
              destId,
            );
            return deleteChannelFromSourceGroup(newGroups, channelId, sourceId);
          }
        });
      },
      [setAvailableChannels, setChannelGroups],
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
        return mainChart
          ? [
              ...prevCharts,
              {
                ...mainChart,
                id: newGroup.id,
                ...(mainChart.options && {
                  options: {
                    ...mainChart.options,
                    title: { text: newGroup.name, fontSize: 20 },
                    data: [],
                  },
                }),
              },
            ]
          : prevCharts;
      });
      setChannelGroups((prev: ChannelGroup[]) => [...prev, newGroup]);
    };

    const removeChannelFromGroup = (groupId: string, channel: string) => {
      setChannelGroups((prevGroups: ChannelGroup[]) => {
        const newGroups = [...prevGroups];
        const targetGroup = newGroups.find((group) => group.id === groupId);
        if (targetGroup) {
          targetGroup.channels = targetGroup.channels.filter(
            (ch) => ch !== channel,
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
        setChartOptions((chartOp) =>
          chartOp.map((chat) => {
            if (chat.id === groupId) {
              return {
                ...chat,
                ...(chat.options && {
                  options: {
                    ...chat.options,
                    title: { text: newName, fontSize: 20 },
                  },
                }),
              };
            }
            return chat;
          }),
        );
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
                  return (
                    <div className="chart-container" key={chart.id}>
                      <div className="draggable-handle">
                        <span className="title-text">
                          {chart.options?.title?.text || "Untitled"}
                        </span>
                      </div>
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
