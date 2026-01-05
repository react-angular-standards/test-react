import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasJSChart } from 'canvasjs-react-charts';
import { v4 as uuidv4 } from 'uuid';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { ThreeBarsIcon } from '@primer/octicons-react';

// Placeholder for CascadingMultiSelect (replace with actual implementation)
const CascadingMultiSelect: React.FC<{
  onChannelSelect: (channels: number[]) => void;
  initialSelection: number[];
}> = ({ onChannelSelect, initialSelection }) => {
  // Mock implementation for demonstration
  return (
    <select
      multiple
      onChange={(e) =>
        onChannelSelect(
          Array.from(e.target.selectedOptions).map((opt) => Number(opt.value))
        )
      }
    >
      {initialSelection.map((ch) => (
        <option key={ch} value={ch}>
          Channel {ch}
        </option>
      ))}
    </select>
  );
};

// Placeholder for PlotContext (replace with actual context)
interface PlotContextType {
  socket: WebSocket | null;
  isStreaming: boolean;
  isRecording: boolean;
  connectionStatus: string;
  channelList: number[];
  availableChannels: number[];
  channelGroups: ChannelGroup[];
  visibleSeries: Record<string, boolean>;
  seriesDataRef: React.MutableRefObject<Record<string, SeriesData>>;
  tabUniqueId: string;
  chartOptions: ChartConfig[];
  setSocket: (socket: WebSocket | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  setConnectionStatus: (status: string) => void;
  setChannelList: (channels: number[]) => void;
  setAvailableChannels: (channels: number[]) => void;
  setChannelGroups: (groups: ChannelGroup[]) => void;
  setVisibleSeries: (series: Record<string, boolean>) => void;
  setChartOptions: (options: ChartConfig[]) => void;
  connectWebSocket: () => void;
  sendDynamicChannelRequest: (
    socket: WebSocket,
    payload: {
      commandId: string;
      tabIdLength: number;
      finalChannelCount: number;
      channelList: number[];
      tabUniqueId: string;
    }
  ) => void;
}

const PlotContext = React.createContext<PlotContextType | undefined>(undefined);

const usePlotContext = () => {
  const context = React.useContext(PlotContext);
  if (!context) {
    throw new Error('usePlotContext must be used within a PlotContextProvider');
  }
  return context;
};

// Interfaces
interface ChannelGroup {
  id: string;
  name: string;
  channels: number[];
}

interface TimeWindow {
  startTime: number;
  endTime: number;
}

interface DataPoint {
  x: Date;
  y: number;
}

interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  dataPoints: DataPoint[];
}

interface ChartOptions {
  animationEnabled: boolean;
  zoomEnabled: boolean;
  zoomType: string;
  theme: string;
  title: { text: string };
  axisX: {
    title: string;
    valueFormatString: string;
    labelAngle: number;
    titleFontSize: number;
    gridThickness: number;
    labelAutoFit: boolean;
    lineThickness: number;
    viewportMinimum?: Date | null;
    viewportMaximum?: Date | null;
  };
  axisY: {
    title: string;
    titleFontSize: number;
    gridThickness: number;
    interlacedColor: string;
    lineThickness: number;
  };
  legend?: {
    cursor: string;
    fontSize: number;
    itemclick: (e: any) => void;
  };
  data: SeriesData[];
  width?: number;
  height?: number;
}

interface ChartConfig {
  id: string;
  options: ChartOptions;
  width: number;
  height: number;
}

interface ChartInstance {
  options: {
    rangeChanged?: (e: {
      axisX: Array<{
        viewportMinimum: number | null;
        viewportMaximum: number | null;
      }>;
    }) => void;
    [key: string]: any;
  };
  render: () => void;
}

enum DataBytePosition {
  Size = 0,
  Version = 2,
  PktType = 3,
  ChannelCount = 4,
  DataCount = 6,
  ChannelUniqueId = 8,
  TimeStamp = 12,
  TimeDelta = 20,
  Payload = 28,
}

const TIME_WINDOW = 3 * 60;
const MAX_DATA_POINTS = 1000;

const Plots: React.FC = () => {
  const {
    socket,
    isStreaming,
    isRecording,
    connectionStatus,
    channelList,
    availableChannels,
    channelGroups,
    visibleSeries,
    seriesDataRef,
    tabUniqueId,
    chartOptions,
    setSocket,
    setIsStreaming,
    setIsRecording,
    setConnectionStatus,
    setChannelList,
    setAvailableChannels,
    setChannelGroups,
    setVisibleSeries,
    setChartOptions,
    connectWebSocket,
    sendDynamicChannelRequest,
  } = usePlotContext();

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isChannelListChanged, setIsChannelListChanged] = useState(false);
  const [isUpdateRecordingRequired, setIsUpdateRecordingRequired] =
    useState(false);
  const [showChannelSection, setShowChannelSection] = useState(true);
  const [resizingChartId, setResizingChartId] = useState<string | null>(null);

  const timeWindowRef = useRef<TimeWindow>({ startTime: 0, endTime: 0 });
  const activeChannelsRef = useRef<number[]>([]);
  const chartRefs = useRef<{ [key: string]: CanvasJSChart | null }>({
    main: null,
  });
  const isZoomedRefs = useRef<{ [key: string]: boolean }>({ main: false });
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Calculate full width dynamically
  const calculateFullWidth = useCallback(() => {
    const windowWidth = window.innerWidth;
    const margin = 30; // Total horizontal margin
    return Math.round(windowWidth * (showChannelSection ? 0.75 : 1) - margin);
  }, [showChannelSection]);

  useEffect(() => {
    chartOptions.forEach((chart) => {
      if (!chartRefs.current[chart.id]) chartRefs.current[chart.id] = null;
      if (isZoomedRefs.current[chart.id] === undefined)
        isZoomedRefs.current[chart.id] = false;
    });
  }, [chartOptions]);

  useEffect(() => {
    Object.keys(chartRefs.current).forEach((chartId) => {
      const chart = chartRefs.current[chartId] as unknown as ChartInstance;
      if (chart) {
        chart.options.rangeChanged = (e) => {
          const isZoomed =
            e.axisX[0].viewportMinimum != null || e.axisX[0].viewportMaximum != null;
          isZoomedRefs.current[chartId] = isZoomed;
        };
      }
    });
  }, [chartOptions]);

  useEffect(() => {
    if (channelList.length > 0) {
      const newVisibleSeries: Record<string, boolean> = {};
      channelList.forEach((channel: number) => {
        const channelKey = `Channel ${channel}`;
        newVisibleSeries[channelKey] =
          visibleSeries[channelKey] !== undefined
            ? visibleSeries[channelKey]
            : true;
      });

      Object.keys(seriesDataRef.current).forEach((key) => {
        const channelName = `Channel ${key}`;
        seriesDataRef.current[key].visible =
          newVisibleSeries[channelName] !== false;
      });
      setVisibleSeries(newVisibleSeries);
    }
  }, [channelList, seriesDataRef, setVisibleSeries]);

  useEffect(() => {
    if (
      isStreaming &&
      !arraysEqual(channelList, activeChannelsRef.current)
    ) {
      setIsChannelListChanged(true);
    } else if (
      isStreaming &&
      arraysEqual(channelList, activeChannelsRef.current)
    ) {
      setIsChannelListChanged(false);
    }
  }, [channelList, isStreaming]);

  const arraysEqual = (a: number[], b: number[]) => {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  };

  const handleChannelSelect = (selectedChannels: number[]) => {
    setChannelList(selectedChannels);

    const assignedChannels = channelGroups.flatMap((group) => group.channels);

    setAvailableChannels((prev: number[]) => {
      const newAvailable = prev.filter((ch) => selectedChannels.includes(ch));
      const newChannels = selectedChannels.filter(
        (ch) => !assignedChannels.includes(ch) && !newAvailable.includes(ch)
      );
      return [...newAvailable, ...newChannels].sort((a, b) => a - b);
    });

    setChannelGroups((prevGroups: ChannelGroup[]) => {
      return prevGroups.map((group) => ({
        ...group,
        channels: group.channels.filter((ch) => selectedChannels.includes(ch)),
      }));
    });
  };

  const handleLegendClick = useCallback(
    (channelName: string, chartId: string) => {
      const currentVisibleSeries = { ...visibleSeries };
      const newState = {
        ...currentVisibleSeries,
        [channelName]: !currentVisibleSeries[channelName],
      };
      setVisibleSeries(newState);

      const channelID = channelName.replace('Channel ', '');
      if (seriesDataRef.current[channelID]) {
        seriesDataRef.current[channelID].visible =
          newState[channelName] !== false;
      }

      setChartOptions((prevOptions) => {
        return prevOptions.map((chart) => {
          if (chart.id === chartId) {
            return {
              ...chart,
              options: {
                ...chart.options,
                data: Object.values(seriesDataRef.current).filter((series) =>
                  chart.id === 'main'
                    ? availableChannels.includes(
                        Number(series.name.replace('Channel ', ''))
                      )
                    : channelGroups
                        .find((g) => g.id === chart.id)
                        ?.channels.includes(
                          Number(series.name.replace('Channel ', ''))
                        )
                ),
              },
            };
          }
          return chart;
        });
      });
    },
    [
      seriesDataRef,
      setVisibleSeries,
      visibleSeries,
      availableChannels,
      channelGroups,
      setChartOptions,
    ]
  );

  const parseData = (arrayBuffer: ArrayBuffer): { uidArray: number[] } => {
    const dataView = new DataView(arrayBuffer);
    const uidArray: number[] = [];
    const dataSize = 4;

    const updateValue = (inTime: number, key: number, newValue: number): void => {
      const channelName = `Channel ${key}`;
      const timestamp = new Date(inTime * 1000);

      if (!seriesDataRef.current[key]) {
        if (activeChannelsRef.current.includes(key)) {
          const isVisible = visibleSeries[channelName] !== false;
          seriesDataRef.current[key] = {
            type: 'line',
            name: channelName,
            showInLegend: true,
            visible: isVisible,
            dataPoints: [],
          };
        } else {
          return;
        }
      }

      const existingPointIndex = seriesDataRef.current[key].dataPoints.findIndex(
        (point: DataPoint) => point.x.getTime() === timestamp.getTime()
      );

      if (existingPointIndex >= 0) {
        seriesDataRef.current[key].dataPoints[existingPointIndex].y = newValue;
      } else {
        seriesDataRef.current[key].dataPoints.push({ x: timestamp, y: newValue });
      }

      if (
        !isZoomedRefs.current[
          channelGroups.find((g) => g.channels.includes(key))?.id || 'main'
        ] &&
        seriesDataRef.current[key].dataPoints.length > MAX_DATA_POINTS
      ) {
        seriesDataRef.current[key].dataPoints = seriesDataRef.current[
          key
        ].dataPoints.slice(-MAX_DATA_POINTS);
      }
    };

    let byteOffset = 0;
    const channelCount = dataView.getUint16(DataBytePosition.ChannelCount, true);

    for (let chnl_count = 0; chnl_count < channelCount; chnl_count++) {
      const dataCount = dataView.getUint16(
        byteOffset + DataBytePosition.DataCount,
        true
      );
      const channelID = dataView.getUint32(
        byteOffset + DataBytePosition.ChannelUniqueId,
        true
      );
      const timeStamp = dataView.getFloat64(
        byteOffset + DataBytePosition.TimeStamp,
        true
      );
      const timeDelta = dataView.getFloat64(
        byteOffset + DataBytePosition.TimeDelta,
        true
      );
      let dataPointTime = timeStamp;

      for (let dataPosition = 0; dataPosition < dataCount; dataPosition++) {
        const data = dataView.getFloat32(
          byteOffset + DataBytePosition.Payload,
          true
        );
        updateValue(dataPointTime, channelID, data);
        byteOffset += dataSize;
        dataPointTime += timeDelta;
      }

      byteOffset += 22;
      uidArray.push(channelID);
    }
    return { uidArray };
  };

  const processWebSocketMessage = useCallback(
    (arrayBuffer: ArrayBuffer) => {
      try {
        const { uidArray } = parseData(arrayBuffer);

        setChartOptions((prevOptions) => {
          return prevOptions.map((chart) => {
            const isZoomed = isZoomedRefs.current[chart.id];
            const axisXSettings = {
              ...chart.options.axisX,
              title: 'Timestamp',
              valueFormatString: 'HH:mm:ss',
            };
            if (isZoomed) {
              const chartInstance = chartRefs.current[
                chart.id
              ] as unknown as ChartInstance;
              axisXSettings.viewportMinimum =
                chartInstance?.options?.axisX?.[0]?.viewportMinimum ??
                chart.options.axisX?.viewportMinimum;
              axisXSettings.viewportMaximum =
                chartInstance?.options?.axisX?.[0]?.viewportMaximum ??
                chart.options.axisX?.viewportMaximum;
            }

            const chartChannels =
              chart.id === 'main'
                ? availableChannels
                : channelGroups.find((g) => g.id === chart.id)?.channels || [];

            return {
              ...chart,
              options: {
                ...chart.options,
                animationEnabled: false,
                legend: {
                  cursor: 'pointer',
                  fontSize: 16,
                  itemclick: (e: any) => {
                    handleLegendClick(e.dataSeries.name, chart.id);
                    return false;
                  },
                },
                axisX: axisXSettings,
                data:
                  chartChannels.length > 0
                    ? Object.values(seriesDataRef.current).filter((series) =>
                        chartChannels.includes(
                          Number(series.name.replace('Channel ', ''))
                        )
                      )
                    : [
                        {
                          type: 'line',
                          name: 'No Data',
                          showInLegend: true,
                          visible: true,
                          dataPoints: [],
                        },
                      ],
                width: Math.round(chart.width - 40),
                height: Math.round(chart.height - 60),
              },
            };
          });
        });
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
    [
      handleLegendClick,
      seriesDataRef,
      availableChannels,
      channelGroups,
      setChartOptions,
    ]
  );

  const toggleRecording = useCallback(() => {
    const recordingUrl = 'https://localhost/api/v1/pxi-stream-data';
    const commonPayload = { commandId: 170, tabId: tabUniqueId };

    const fetchRecordingData = (payload: {
      commandId: number;
      tabId: string;
      channelList?: number[];
    }) =>
      fetch(recordingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .catch((error) => {
          console.error('Recording error:', error);
          alert('Failed to process recording request.');
          throw error;
        });

    if (isRecording && !isUpdateRecordingRequired) {
      fetchRecordingData({ ...commonPayload, channelList: [] }).then((data) => {
        console.log('Stopped recording:', data);
        setIsRecording(false);
      });
    } else {
      fetchRecordingData({ ...commonPayload, channelList }).then((data) => {
        console.log('Started/updated recording:', data);
        setIsRecording(true);
        setIsUpdateRecordingRequired(false);
      });
    }
  }, [
    isRecording,
    isUpdateRecordingRequired,
    channelList,
    tabUniqueId,
    setIsRecording,
  ]);

  const toggleDynamicChannels = useCallback(() => {
    if (!socket || !channelList.length) {
      if (channelList.length === 0)
        alert('Please add channels before streaming.');
      return;
    }

    if (!isStreaming || isChannelListChanged) {
      if (isChannelListChanged) {
        if (isStreaming && isRecording) setIsUpdateRecordingRequired(true);
        timeWindowRef.current = { startTime: 0, endTime: 0 };
        Object.keys(seriesDataRef.current).forEach((key) => {
          if (!channelList.includes(Number(key)))
            delete seriesDataRef.current[key];
        });
        setChartOptions((prev) =>
          prev.map((chart) => ({
            ...chart,
            options: { ...chart.options, data: [] },
          }))
        );
      }

      sendDynamicChannelRequest(socket, {
        commandId: '0XAB',
        tabIdLength: 36,
        finalChannelCount: channelList.length,
        channelList,
        tabUniqueId,
      });

      activeChannelsRef.current = [...channelList];
      setIsChannelListChanged(false);
      setIsStreaming(true);
    } else {
      socket.send('Stop');
      setIsStreaming(false);
    }
  }, [
    socket,
    channelList,
    isStreaming,
    isChannelListChanged,
    tabUniqueId,
    sendDynamicChannelRequest,
    isRecording,
    seriesDataRef,
    setIsStreaming,
    setChartOptions,
  ]);

  useEffect(() => {
    if (socket) {
      socket.onmessage = (event: MessageEvent) => {
        if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result instanceof ArrayBuffer) {
              processWebSocketMessage(e.target.result);
            }
          };
          reader.readAsArrayBuffer(event.data);
        }
      };
    }
  }, [socket, processWebSocketMessage]);

  useEffect(() => {
    const fullWidth = calculateFullWidth();
    setChartOptions((prevOptions) => {
      const mainChart =
        prevOptions.find((chart) => chart.id === 'main') || {
          id: 'main',
          options: {
            animationEnabled: false,
            zoomEnabled: true,
            zoomType: 'xy',
            theme: 'light2',
            title: { text: 'Main Graph (Available Channels)' },
            axisX: {
              title: 'Timestamp',
              valueFormatString: 'HH:mm:ss',
              labelAngle: 90,
              titleFontSize: 14,
              gridThickness: 0.3,
              labelAutoFit: true,
              lineThickness: 0.5,
            },
            axisY: {
              title: 'Data',
              titleFontSize: 14,
              gridThickness: 0.4,
              interlacedColor: '#F0F8FF',
              lineThickness: 0.5,
            },
            legend: {
              cursor: 'pointer',
              fontSize: 16,
              itemclick: (e: any) => {
                handleLegendClick(e.dataSeries.name, 'main');
                return false;
              },
            },
            data: [],
            width: fullWidth - 40,
            height: 400 - 60,
          },
          width: fullWidth,
          height: 400,
        };

      const groupCharts = channelGroups
        .filter((group) => group.channels.length > 0)
        .map((group) => {
          const existingChart = prevOptions.find((chart) => chart.id === group.id);
          return {
            id: group.id,
            options: {
              animationEnabled: false,
              zoomEnabled: true,
              zoomType: 'xy',
              theme: 'light2',
              title: { text: `${group.name} Data` },
              axisX: {
                title: 'Timestamp',
                valueFormatString: 'HH:mm:ss',
                labelAngle: 90,
                titleFontSize: 14,
                gridThickness: 0.3,
                labelAutoFit: true,
                lineThickness: 0.5,
              },
              axisY: {
                title: 'Data',
                titleFontSize: 14,
                gridThickness: 0.4,
                interlacedColor: '#F0F8FF',
                lineThickness: 0.5,
              },
              legend: {
                cursor: 'pointer',
                fontSize: 16,
                itemclick: (e: any) => {
                  handleLegendClick(e.dataSeries.name, group.id);
                  return false;
                },
              },
              data: Object.values(seriesDataRef.current).filter((series) =>
                group.channels.includes(
                  Number(series.name.replace('Channel ', ''))
                )
              ),
              width: existingChart?.width
                ? Math.round(existingChart.width - 40)
                : fullWidth - 40,
              height: existingChart?.height
                ? Math.round(existingChart.height - 60)
                : 400 - 60,
            },
            width: existingChart?.width || fullWidth,
            height: existingChart?.height || 400,
          };
        });

      const newOptions = [
        {
          ...mainChart,
          options: {
            ...mainChart.options,
            title: { text: 'Main Graph (Available Channels)' },
            data:
              channelGroups.length === 0
                ? Object.values(seriesDataRef.current)
                : Object.values(seriesDataRef.current).filter((series) =>
                    availableChannels.includes(
                      Number(series.name.replace('Channel ', ''))
                    )
                  ),
            width: fullWidth - 40,
            height: 400 - 60,
          },
          width: fullWidth,
          height: 400,
        },
        ...groupCharts,
      ];

      Object.keys(chartRefs.current).forEach((key) => {
        if (!newOptions.some((opt) => opt.id === key)) {
          delete chartRefs.current[key];
          delete isZoomedRefs.current[key];
        }
      });

      return newOptions;
    });
  }, [
    channelGroups,
    availableChannels,
    seriesDataRef,
    setChartOptions,
    showChannelSection,
    calculateFullWidth,
    handleLegendClick,
  ]);

  const isDraggingDisabled = channelList.length === 0;

  const handleDragEnd = useCallback(
    (result: any) => {
      if (!result.destination) return;

      const sourceId = result.source.droppableId;
      const destId = result.destination.droppableId;
      const draggableId = result.draggableId;

      const channelId = Number(draggableId);

      if (sourceId === 'available-channels' && destId !== 'available-channels') {
        setAvailableChannels((prev: number[]) =>
          prev.filter((ch) => ch !== channelId)
        );
        setChannelGroups((prevGroups: ChannelGroup[]) => {
          const newGroups = [...prevGroups];
          const targetGroup = newGroups.find((group) => group.id === destId);
          if (targetGroup && !targetGroup.channels.includes(channelId)) {
            targetGroup.channels.push(channelId);
          }
          return newGroups;
        });
      } else if (
        sourceId !== 'available-channels' &&
        destId !== 'available-channels' &&
        sourceId !== destId
      ) {
        setChannelGroups((prevGroups: ChannelGroup[]) => {
          const newGroups = [...prevGroups];
          const sourceGroup = newGroups.find((group) => group.id === sourceId);
          const targetGroup = newGroups.find((group) => group.id === destId);

          if (sourceGroup && targetGroup) {
            sourceGroup.channels = sourceGroup.channels.filter(
              (ch) => ch !== channelId
            );
            if (!targetGroup.channels.includes(channelId)) {
              targetGroup.channels.push(channelId);
            }
          }
          return newGroups;
        });
      } else if (
        sourceId !== 'available-channels' &&
        destId === 'available-channels'
      ) {
        setChannelGroups((prevGroups: ChannelGroup[]) => {
          const newGroups = [...prevGroups];
          const sourceGroup = newGroups.find((group) => group.id === sourceId);
          if (sourceGroup) {
            sourceGroup.channels = sourceGroup.channels.filter(
              (ch) => ch !== channelId
            );
            setAvailableChannels((prev: number[]) => {
              if (!prev.includes(channelId)) {
                return [...prev, channelId].sort((a, b) => a - b);
              }
              return prev;
            });
          }
          return newGroups;
        });
      }
    },
    [setAvailableChannels, setChannelGroups]
  );

  const handleLayoutChange = useCallback(
    (newLayout: any[]) => {
      const fullWidth = calculateFullWidth();
      setChartOptions((prevOptions) => {
        const sortedLayout = newLayout.sort((a, b) =>
          a.y === b.y ? a.x - b.x : a.y - b.y
        );
        const adjustedLayout: any[] = [];
        let currentY = 0;
        sortedLayout.forEach((item) => {
          const chart = prevOptions.find((c) => c.id === item.i)!;
          adjustedLayout.push({
            ...item,
            x: 0,
            y: currentY,
            w: 12,
            h: Math.ceil(chart.height / 100),
          });
          currentY += Math.ceil(chart.height / 100);
        });
        const sortedOptions = adjustedLayout
          .map((item) => prevOptions.find((chart) => chart.id === item.i)!)
          .filter(Boolean);
        return sortedOptions.map((chart) => ({
          ...chart,
          width: fullWidth,
          options: {
            ...chart.options,
            width: fullWidth - 40,
          },
        }));
      });
    },
    [setChartOptions, calculateFullWidth]
  );

  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      chartId: string,
      width: number,
      height: number
    ) => {
      e.stopPropagation();
      setResizingChartId(chartId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: width,
        startHeight: height,
      };
    },
    []
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeRef.current || !resizingChartId) return;

      const { startX, startY, startWidth, startHeight } = resizeRef.current;
      const fullWidth = calculateFullWidth();
      const newWidth = Math.max(
        300,
        Math.min(fullWidth, startWidth + (e.clientX - startX))
      );
      const newHeight = Math.max(
        200,
        Math.min(600, startHeight + (e.clientY - startY))
      );

      setChartOptions((prev) =>
        prev.map((chart) =>
          chart.id === resizingChartId
            ? {
                ...chart,
                width: Math.round(newWidth),
                height: Math.round(newHeight),
                options: {
                  ...chart.options,
                  width: Math.round(newWidth - 40),
                  height: Math.round(newHeight - 60),
                },
              }
            : chart
        )
      );
    },
    [resizingChartId, setChartOptions, calculateFullWidth]
  );

  const handleResizeEnd = useCallback(() => {
    setResizingChartId(null);
    resizeRef.current = null;
  }, []);

  useEffect(() => {
    if (resizingChartId) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingChartId, handleResizeMove, handleResizeEnd]);

  const createNewGroup = () => {
    const newGroup: ChannelGroup = {
      id: uuidv4(),
      name: `Group ${channelGroups.length + 1}`,
      channels: [],
    };
    setChannelGroups((prev: ChannelGroup[])the  return [...prev, newGroup]);
  };

  const removeChannelFromGroup = (groupId: string, channel: number) => {
    setChannelGroups((prevGroups: ChannelGroup[]) => {
      const newGroups = [...prevGroups];
      const targetGroup = newGroups.find((group) => group.id === groupId);
      if (targetGroup) {
        targetGroup.channels = targetGroup.channels.filter(
          (ch) => ch !== channel
        );
        setAvailableChannels((prev: number[]) =>
          [...prev, channel].sort((a, b) => a - b)
        );
      }
      return newGroups;
    });
  };

  const deleteGroup = (groupId: string) => {
    setChannelGroups((prevGroups: ChannelGroup[]) => {
      const groupToDelete = prevGroups.find((group) => group.id === groupId);
      if (groupToDelete) {
        setAvailableChannels((prev: number[]) =>
          [...prev, ...groupToDelete.channels].sort((a, b) => a - b)
        );
      }
      return prevGroups.filter((group) => group.id !== groupId);
    });
    if (selectedGroup === groupId) setSelectedGroup(null);
  };

  const updateGroup = (groupId: string) => {
    const newName = prompt('Enter new group name:');
    if (newName) {
      setChannelGroups((prevGroups: ChannelGroup[]) => {
        const newGroups = [...prevGroups];
        const targetGroup = newGroups.find((group) => group.id === groupId);
        if (targetGroup) {
          targetGroup.name = newName;
        }
        return newGroups;
      });
    }
  };

  const toggleChannelSection = () => {
    setShowChannelSection((prev) => !prev);
  };

  const groupColors = [
    'bg-light-blue',
    'bg-light-green',
    'bg-light-yellow',
    'bg-light-pink',
    'bg-light-purple',
    'bg-light-teal',
    'bg-light-orange',
    'bg-light-indigo',
  ];

  const fullWidth = calculateFullWidth();
  const layout = chartOptions.map((chart, index) => ({
    i: chart.id,
    x: 0,
    y: index * 4,
    w: 12,
    h: Math.ceil(chart.height / 100),
    isDraggable: true,
    isResizable: false,
  }));

  const customStyles = `
    .bg-light-blue { background-color: #e7f1ff; }
    .bg-light-green { background-color: #e9ffe7; }
    .bg-light-yellow { background-color: #fffde7; }
    .bg-light-pink { background-color: #ffe7f1; }
    .bg-light-purple { background-color: #f1e7ff; }
    .bg-light-teal { background-color: #e7fff7; }
    .bg-light-orange { background-color: #fff3e7; }
    .bg-light-indigo { background-color: #ede7ff; }
    .chip { display: inline-block; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: 500; border-radius: 9999px; margin: 0.25rem; }
    .chip-blue { background-color: #cce5ff; color: #004085; }
    .chip-blue:hover { background-color: #b3d7ff; }
    .chip-green { background-color: #d4edda; color: #155724; }
    .chip-red { background-color: #f8d7da; color: #721c24; }
    .chip-red:hover { background-color: #f5c6cb; }
    .no-shrink { flex-shrink: 0; }
    .chart-container { position: relative; margin: 10px 15px; }
    .resize-handle { position: absolute; width: 20px; height: 20px; bottom: 10px; right: 10px; background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTE4IDE4aC0zdi0zTTE1IDE4aC0zdi0zTTEyIDE4SC45di0zTTE4IDE1aC0zdi0zTTE1IDE1aC0zdi0zTTEyIDE1SC45di0zIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg=='); cursor: se-resize; z-index: 10; }
    .main-content { margin-top: 62px; display: flex; }
    .controls-section { padding: 10px; margin: 10px 15px; }
    .row { padding-bottom: 10px; }
    .channels-section { height: calc(100vh - 62px); overflow-y: auto; position: relative; padding: 15px; }
    .toggle-icon { position: absolute; top: 10px; right: 10px; z-index: 10; cursor: pointer; }
    .toggle-icon-hidden { position: fixed; top: 72px; right: 20px; z-index: 1000; cursor: pointer; }
    .chart-wrapper { box-sizing: border-box; padding: 15px 20px 40px 20px; width: 100%; overflow: hidden; }
    .react-grid-item { transition: all 200ms ease; }
    .react-grid-item.dragging { z-index: 100; }
    .layout { width: 100%; }
  `;

  return (
    <>
      <style>{customStyles}</style>
      <div className="main-content">
        <div
          className="row position-relative"
          style={{ display: 'flex', flex: 1 }}
        >
          <div
            className={showChannelSection ? 'col-9' : 'col-12'}
            style={{
              flex: showChannelSection ? '0 0 75%' : '1 0 100%',
            }}
          >
            <div className="space-y-4">
              <div className="controls-section bg-white rounded-lg shadow">
                <div
                  className="row align-items-center"
                  style={{ display: 'flex', flexWrap: 'wrap' }}
                >
                  <div
                    className="col-md-6 align-items-center"
                    style={{ flex: '1 0 auto', minWidth: '250px' }}
                  >
                    <CascadingMultiSelect
                      onChannelSelect={handleChannelSelect}
                      initialSelection={channelList}
                    />
                  </div>
                  <div
                    className="col-md-12 mt-2 d-flex align-items-center justify-content-end"
                    style={{ flex: '1 0 auto' }}
                  >
                    <button
                      onClick={connectWebSocket}
                      disabled={connectionStatus === 'Connected'}
                      className={`btn btn-sm me-2 ${
                        connectionStatus === 'Connected'
                          ? 'btn-secondary disabled'
                          : 'btn-success'
                      }`}
                      style={{
                        cursor:
                          connectionStatus === 'Connected'
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      Connect
                    </button>
                    <button
                      onClick={toggleDynamicChannels}
                      disabled={
                        connectionStatus !== 'Connected' ||
                        (isStreaming && !isChannelListChanged)
                      }
                      className={`btn btn-sm me-2 ${
                        connectionStatus !== 'Connected' ||
                        (isStreaming && !isChannelListChanged)
                          ? 'btn-secondary disabled'
                          : isStreaming
                          ? 'btn-warning'
                          : 'btn-danger'
                      }`}
                      style={{
                        cursor:
                          connectionStatus !== 'Connected' ||
                          (isStreaming && !isChannelListChanged)
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      {isStreaming
                        ? isChannelListChanged
                          ? 'Update Stream'
                          : 'Stream Data'
                        : 'Stream Data'}
                    </button>
                    <button
                      onClick={toggleRecording}
                      disabled={
                        connectionStatus !== 'Connected' || !isStreaming
                      }
                      className={`btn btn-sm ${
                        connectionStatus !== 'Connected' || !isStreaming
                          ? 'btn-secondary disabled'
                          : isStreaming
                          ? 'btn-warning'
                          : 'btn-danger'
                      }`}
                      style={{
                        cursor:
                          connectionStatus !== 'Connected' || !isStreaming
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      {isStreaming && isRecording
                        ? isUpdateRecordingRequired
                          ? 'Update Recording'
                          : 'Stop Recording'
                        : 'Record Stream'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="row">
                <GridLayout
                  className="layout"
                  layout={layout}
                  cols={12}
                  rowHeight={100}
                  width={fullWidth}
                  isDraggable={true}
                  isResizable={false}
                  onLayoutChange={handleLayoutChange}
                  margin={[10, 10]}
                >
                  {chartOptions.map((chart) => (
                    <div key={chart.id} className="chart-container">
                      <div
                        className="bg-white rounded-lg shadow chart-wrapper"
                        style={{
                          width: '100%',
                          height: `${chart.height}px`,
                          position: 'relative',
                          boxSizing: 'border-box',
                        }}
                      >
                        <CanvasJSChart
                          ref={(ref) => (chartRefs.current[chart.id] = ref)}
                          options={chart.options}
                        />
                        <span
                          className="resize-handle"
                          onMouseDown={(e) =>
                            handleResizeStart(e, chart.id, chart.width, chart.height)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </GridLayout>
              </div>
            </div>
            {!showChannelSection && (
              <div
                className="toggle-icon-hidden"
                onClick={toggleChannelSection}
                title="Show Channels"
              >
                <ThreeBarsIcon size={24} />
              </div>
            )}
          </div>
          {showChannelSection && (
            <div
              className="col-3"
              style={{ flex: '0 0 25%', maxWidth: '25%' }}
            >
              <div className="channels-section bg-white rounded-lg shadow">
                <div
                  className="toggle-icon"
                  onClick={toggleChannelSection}
                  title="Hide Channels"
                >
                  <ThreeBarsIcon size={24} />
                </div>
                <h3 className="h4 font-weight-bold text-dark mb-4">
                  Channel Management
                </h3>
                <div className="mb-5">
                  <h4 className="h6 font-weight-bold text-muted mb-3">
                    Available Channels
                  </h4>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable
                      droppableId="available-channels"
                      direction="horizontal"
                      isDropDisabled={false}
                      isCombineEnabled={false}
                      ignoreContainerClipping={false}
                    >
                      {(provided) => (
                        <div
                          className="d-flex flex-wrap gap-2 p-2 bg-light rounded border"
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                        >
                          {availableChannels.map((channel, index) => (
                            <Draggable
                              key={channel}
                              draggableId={channel.toString()}
                              index={index}
                              isDragDisabled={isDraggingDisabled}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="chip chip-blue cursor-move shadow-sm no-shrink"
                                >
                                  Ch {channel}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {availableChannels.length === 0 && (
                            <span className="text-muted small font-italic">
                              No channels available
                            </span>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                    <div className="mt-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4 className="h6 font-weight-bold text-muted">
                          Channel Groups
                        </h4>
                        <div
                          onClick={createNewGroup}
                          className="chip chip-blue cursor-pointer shadow-sm no-shrink"
                        >
                          <span className="small">+</span> New
                        </div>
                      </div>
                      {channelGroups.map((group, index) => (
                        <Droppable
                          key={group.id}
                          droppableId={group.id}
                          direction="horizontal"
                          isDropDisabled={false}
                          isCombineEnabled={false}
                          ignoreContainerClipping={false}
                        >
                          {(provided) => (
                            <div
                              className={`border rounded p-3 mb-3 transition ${
                                groupColors[index % groupColors.length]
                              } ${
                                selectedGroup === group.id ? 'shadow-lg' : ''
                              }`}
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                            >
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <div
                                  className="font-weight-bold text-sm text-dark cursor-pointer"
                                  onClick={() =>
                                    setSelectedGroup(
                                      group.id === selectedGroup ? null : group.id
                                    )
                                  }
                                  style={{ transition: 'color 0.2s' }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.color = '#212529')
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.color = '#343a64')
                                  }
                                >
                                  {group.name}{' '}
                                  <span className="text-muted">
                                    ({group.channels.length})
                                  </span>
                                </div>
                                <div className="d-flex gap-2">
                                  <button
                                    onClick={() => updateGroup(group.id)}
                                    className="btn btn-sm btn-outline-primary py-0 px-2"
                                  >
                                    Update
                                  </button>
                                  <button
                                    onClick={() => deleteGroup(group.id)}
                                    className="btn btn-sm btn-outline-danger py-0 px-2"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="d-flex flex-wrap gap-2">
                                {group.channels.map((channel, index) => (
                                  <Draggable
                                    key={channel}
                                    draggableId={channel.toString()}
                                    index={index}
                                    isDragDisabled={isDraggingDisabled}
                                  >
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className="chip chip-green shadow-sm no-shrink"
                                      >
                                        Ch {channel}
                                        <div
                                          onClick={() =>
                                            removeChannelFromGroup(group.id, channel)
                                          }
                                          className="chip chip-red cursor-pointer ml-1 no-shrink"
                                        >
                                          ×
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {group.channels.length === 0 && (
                                  <span className="text-muted small font-italic">
                                    Drop channels here
                                  </span>
                                )}
                                {provided.placeholder}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      ))}
                      {channelGroups.length === 0 && (
                        <div className="text-muted small font-italic text-center py-3">
                          No groups created yet
                        </div>
                      )}
                    </div>
                  </DragDropContext>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Plots;