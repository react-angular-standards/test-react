** @format */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasJSChart } from 'canvasjs-react-charts';
import CascadingMultiSelect from './CascadingDropdowns';
import { usePlotContext } from '../context/PlotsContext'; // Corrected to usePlotContext
import { v4 as uuidv4 } from 'uuid';
import { Box, Text, Checkbox, Label, Stack, Button } from '@primer/react';
import _ from 'lodash';

// Todo : Move helper functions and interface to utils folder
// Helper function to reorder items when dragging
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// // Type for items
// interface Item {
//   id: number;
//   content: string;
// }

// interface ContainerProps {
//   containerId: number;
//   items: Item[];
//   moveItems: (
//     itemIds: number[],
//     fromContainer: number,
//     toContainer: number
//   ) => void;
//   selectedItems: Set<number>;
//   toggleItemSelection: (itemId: number) => void;
// }

// Add new interfaces for groups
interface ChannelGroup {
  id: string;
  name: string;
  channels: number[];
}

// Interfaces
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
  axisYIndex?: number; // Add this line
  dataPoints: DataPoint[];
}

interface AxisYConfig {
  title: string;
  titleFontSize: number;
  gridThickness: number;
  interlacedColor: string;
  lineThickness: number;
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
    viewportMinimum?: Date;
    viewportMaximum?: Date;
  };
  // axisY: {
  //   title: string;
  //   titleFontSize: number;
  //   gridThickness: number;
  //   interlacedColor: string;
  //   lineThickness: number;
  // };
  legend?: {
    cursor: string;
    fontSize: number;
    itemclick: (e: any) => void;
  };
  axisY: AxisYConfig[]; // Array of Y-axis configurations
  data: SeriesData[];
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

const TIME_WINDOW = 3 * 60;
const MAX_DATA_POINTS = 1000;

export function isBothArrayElementsSame<T>(array1: T[], array2: T[]): boolean {
  if (array1.length !== array2.length) return false;
  array1.forEach((element) => {
    if (!array2.includes(element)) {
      return false;
    }
  });
  return true;
}

const isArrayExactlyEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
};

const Plots: React.FC = () => {
  const {
    socket,
    isStreaming,
    isRecording,
    connectionStatus,
    channelList,
    visibleSeries,
    seriesDataRef,
    tabUniqueId,
    setSocket,
    setIsStreaming,
    setIsRecording,
    setConnectionStatus,
    setChannelList,
    setVisibleSeries,
    connectWebSocket,
    sendDynamicChannelRequest,
  } = usePlotContext();

  const [isChannelListChanged, setIsChannelListChanged] = useState(false);
  const [isUpdateRecordingRequired, setIsUpdateRecordingRequired] =
    useState(false);
  const timeWindowRef = useRef<TimeWindow>({ startTime: 0, endTime: 0 });
  const activeChannelsRef = useRef<number[]>([]);
  const chartRef = useRef<CanvasJSChart>(null);
  const isZoomedRef = useRef<boolean>(false);

  const [cardGroups, setCardGroups] = useState<{ [cardId: string]: number[] }>({});
  const [options, setOptions] = useState<ChartOptions>({
    animationEnabled: false,
    zoomEnabled: true,
    zoomType: 'xy',
    theme: 'light2',
    title: { text: 'Live Data' },
    axisX: {
      title: 'Timestamp',
      valueFormatString: 'HH:mm:ss',
      labelAngle: 90,
      titleFontSize: 14,
      gridThickness: 0.3,
      labelAutoFit: true,
      lineThickness: 0.5,
    },
    axisY: [{
      title: 'Data (Card 01)',
      titleFontSize: 14,
      gridThickness: 0.4,
      interlacedColor: '#cdf7d6',
      lineThickness: 0.5,
    }], // Initialize with at least one axis
    data: [],
  });



  const initializeCardGroups = useCallback((channels: number[]) => {
    const newCardGroups: { [cardId: string]: number[] } = {};
    channels.forEach(channel => {
      const channelStr = channel.toString();
      const cardId = channelStr.slice(1, 3); // Extract card ID
      if (!newCardGroups[cardId]) {
        newCardGroups[cardId] = [];
      }
      newCardGroups[cardId].push(channel);
    });

    setCardGroups(newCardGroups);

    // Update axisY configuration based on card groups
    const newAxisY = Object.keys(newCardGroups).map((cardId, index) => ({
      title: `Data (Card ${cardId})`,
      titleFontSize: 14,
      gridThickness: 0.4,
      interlacedColor: index % 2 === 0 ? '#cdf7d6' : '#f7d6cd',
      lineThickness: 0.5,
    }));

    setOptions(prev => ({
      ...prev,
      axisY: newAxisY
    }));
  }, []);


  useEffect(() => {
    const chart = chartRef.current as unknown as ChartInstance;
    if (chart) {
      chart.options.rangeChanged = (e) => {
        const isZoomed =
          e.axisX[0].viewportMinimum != null ||
          e.axisX[0].viewportMaximum != null;
        isZoomedRef.current = isZoomed;
      };
    }
  }, []);

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
    console.log(channelList, activeChannelsRef.current);
    if (
      isStreaming &&
      !isBothArrayElementsSame(channelList, activeChannelsRef.current)
    ) {
      setIsChannelListChanged(true);
    } else if (
      isStreaming &&
      isBothArrayElementsSame(channelList, activeChannelsRef.current)
    ) {
      setIsChannelListChanged(false);
    }
  }, [channelList, isStreaming]);



  const handleChannelSelect = (channels: number[]) => {
    setChannelList(channels); // Update context state
    if (
      isStreaming &&
      !isBothArrayElementsSame(channels, activeChannelsRef.current)
    ) {
      setIsChannelListChanged(true);
    }
  };

  const handleLegendClick = useCallback(
    (channelName: string) => {
      // Get the current state first
      const currentVisibleSeries = { ...visibleSeries }; // Assuming visibleSeries is accessible

      // Update the state directly
      const newState = {
        ...currentVisibleSeries,
        [channelName]: !currentVisibleSeries[channelName],
      };

      // Apply the new state
      setVisibleSeries(newState);

      // Update references
      const channelID = channelName.replace('Channel ', '');
      if (seriesDataRef.current[channelID]) {
        seriesDataRef.current[channelID].visible =
          newState[channelName] !== false;
      }

      const updatedData = Object.values(seriesDataRef.current);
      setOptions((prevOptions) => ({
        ...prevOptions,
        data: updatedData,
      }));
    },
    [seriesDataRef, setVisibleSeries, visibleSeries] // Include visibleSeries in dependencies
  );

  const parseData = (arrayBuffer: ArrayBuffer): { uidArray: number[] } => {
    const dataView = new DataView(arrayBuffer);
    const uidArray: number[] = [];
    const dataSize = 4;

    const updateValue = (
      inTime: number,
      key: number,
      newValue: number
    ): void => {
      const timestamp = new Date(inTime * 1000);
      const channelStr = key.toString();
      const cardId = channelStr.slice(1, 3);
      const axisIndex = Object.keys(cardGroups).indexOf(cardId);

      if (!seriesDataRef.current[key]) {
        if (activeChannelsRef.current.includes(key)) {
          const channelName = `Channel ${key}`;
          const isVisible = visibleSeries[channelName] !== false;
          seriesDataRef.current[key] = {
            type: 'line',
            name: channelName,
            showInLegend: true,
            visible: isVisible,
            axisYIndex: axisIndex >= 0 ? axisIndex : 0,
            dataPoints: [],
          } as SeriesData;
        } else {
          return;
        }
      }

      seriesDataRef.current[key].dataPoints.push({ x: timestamp, y: newValue });
    };

    // Example parsing logic (adjust to your needs)
    for (let i = 0; i < dataView.byteLength; i += dataSize) {
      const inTime = dataView.getFloat32(i, true);
      const key = dataView.getUint32(i + 4, true);
      const newValue = dataView.getFloat32(i + 8, true);
      updateValue(inTime, key, newValue);
      uidArray.push(key);
    }

    return { uidArray };
  };
  const processWebSocketMessage = useCallback(
    (arrayBuffer: ArrayBuffer) => {
      try {
        const { uidArray } = parseData(arrayBuffer);

        setOptions((prevOptions) => {
          const axisXSettings = {
            ...prevOptions.axisX,
            title: 'Timestamp',
            valueFormatString: 'HH:mm:ss',
          };
          if (isZoomedRef.current) {
            const chart = chartRef.current as unknown as ChartInstance;
            axisXSettings.viewportMinimum =
              chart?.options?.axisX?.[0]?.viewportMinimum ??
              prevOptions.axisX?.viewportMinimum;
            axisXSettings.viewportMaximum =
              chart?.options?.axisX?.[0]?.viewportMaximum ??
              prevOptions.axisX?.viewportMaximum;
          }

          return {
            ...prevOptions,
            animationEnabled: false,
            legend: {
              cursor: 'pointer',
              fontSize: 16,
              itemclick: (e: any) => {
                handleLegendClick(e.dataSeries.name);
                return false;
              },
            },
            axisX: axisXSettings,
            data: Object.values(seriesDataRef.current),
          };
        });
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
    [handleLegendClick, seriesDataRef]
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
        setOptions((prev) => ({ ...prev, data: [] }));

        // Initialize card groups when starting/updating stream
        initializeCardGroups(channelList);
      }

      // ... (rest of toggleDynamicChannels remains the same)
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

  // Add new state for groups
  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Add handler to create new group
  const createNewGroup = () => {
    const newGroup: ChannelGroup = {
      id: uuidv4(),
      name: `Group ${channelGroups.length + 1}`,
      channels: [],
    };
    setChannelGroups((prev) => [...prev, newGroup]);
  };

  // Add handler to remove channel from group
  const removeChannelFromGroup = (groupId: string, channel: number) => {
    setChannelGroups((prevGroups) => {
      const newGroups = [...prevGroups];
      const targetGroup = newGroups.find((group) => group.id === groupId);
      if (targetGroup) {
        targetGroup.channels = targetGroup.channels.filter(
          (ch) => ch !== channel
        );
      }
      return newGroups;
    });
  };

  return (
    <div>
      <Box
        bg='canvas.default'
        flexDirection='column'
        height='100vh'
        width='100%'>
        <Box
          display='flex'
          flexDirection='column'
          justifyContent='left'
          alignItems='left'
          p={4}>
          <CascadingMultiSelect
            onChannelSelect={handleChannelSelect}
            initialSelection={channelList}
          />
          <Box mt='20px'>
            <Stack direction='horizontal' align='center'>
              <Button
                variant={
                  connectionStatus === 'Connected' ? 'danger' : 'primary'
                }
                color='fg.default'
                onClick={connectWebSocket}>
                {connectionStatus === 'Connected' ? 'Disconnect' : 'Connect'}
              </Button>
              <Button
                variant={
                  connectionStatus !== 'Connected' ||
                    (isStreaming && !isChannelListChanged)
                    ? 'default'
                    : 'primary'
                }
                onClick={toggleDynamicChannels}
                disabled={
                  connectionStatus !== 'Connected' ||
                  (isStreaming && !isChannelListChanged)
                }>
                {isStreaming
                  ? isChannelListChanged
                    ? 'Update Stream'
                    : 'Stream Data'
                  : 'Stream Data'}
              </Button>
              <Button
                variant={
                  isStreaming
                    ? isRecording
                      ? isUpdateRecordingRequired
                        ? 'primary'
                        : 'danger'
                      : 'primary'
                    : 'default'
                }
                onClick={toggleRecording}
                disabled={
                  connectionStatus !== 'Connected' ||
                  !isStreaming ||
                  (isStreaming && isChannelListChanged && !isRecording)
                }>
                {isStreaming && isRecording
                  ? isUpdateRecordingRequired
                    ? 'Update Recording'
                    : 'Stop Recording'
                  : 'Record Stream'}
              </Button>
            </Stack>
          </Box>
        </Box>

        <CanvasJSChart ref={chartRef} options={options} />
      </Box>
    </div>
  );
};

export default Plots;