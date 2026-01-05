/** @format */

import { UrlConstant } from "../util/UrlConstans";
import { getRandomColorScheme } from "../Widgets/CustomStyle";
import {
  Channel,
  Option,
  ChannelConfigApiResponse,
  UpdateChannelsFunc,
  UpdateChannelSelectionListFunc,
} from "./ConfiguredChannelSchema";

export const fetchConfiguredChannels = async (
  setLoading: (st: boolean) => void,
  setError: (st: string | null) => void,
  upateContinuousChannels?: UpdateChannelSelectionListFunc,
  upateDiscreteInChannels?: UpdateChannelsFunc,
  upateDiscreteOutChannels?: UpdateChannelsFunc,
  upateRelayChannels?: UpdateChannelsFunc,
  upadteAnalogOutput?: UpdateChannelsFunc,
): Promise<void> => {
  if (
    !upateContinuousChannels &&
    !upateDiscreteInChannels &&
    !upateDiscreteOutChannels &&
    !upateRelayChannels &&
    !upadteAnalogOutput
  ) {
    console.log("Pass atleast one function to update channel");
    return;
  }
  setLoading(true);
  try {
    console.log("Starting data fetch...");
    const apiURL = UrlConstant.CONFIGURED_CHANNELS;
    console.log(apiURL);
    const response = await fetch(apiURL);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data: ChannelConfigApiResponse = await response.json();
    const chassisName = data?.Details?.Test_Details?.Chassis?.system_name;
    const inputModules = data?.Details?.Test_Details?.Chassis?.InputModule;
    const discreteInputChannel: Channel[] = [];
    const discreteOutputChannel: Channel[] = [];
    const relayOutputChannels: Channel[] = [];
    const continuousDataChannel: Option[] = [];
    const analogOutputDataChannel: Channel[] = [];
    if (inputModules && Array.isArray(inputModules)) {
      inputModules.forEach((module, moduleIndex: number) => {
        if (
          module.enabled !== "YES" ||
          (module.node_type === "Discrete" &&
            !upateDiscreteInChannels &&
            !upateDiscreteOutChannels) ||
          (module.node_type !== "Discrete" &&
            !upateContinuousChannels &&
            !upadteAnalogOutput &&
            !upateRelayChannels)
        ) {
          return;
        }

        if (Array.isArray(module.Card)) {
          module.Card.forEach((card, cardIndex: number) => {
            if (card.enabled !== "YES") {
              return;
            }
            if (Array.isArray(card.Channel)) {
              if (
                module.node_type !== "Discrete" &&
                module.node_type !== "Relay" &&
                module.node_type !== "Voltage_Output" &&
                upateContinuousChannels &&
                !upadteAnalogOutput
              ) {
                continuousDataChannel.push({
                  value: `Select All - Card-${card.Task_id}`,
                  label: `${module.node_type || "Unknown Module"} - ${card.Module_Model}`,
                  chassisId: chassisName,
                  cardId: card.Task_id,
                  isSelectAll: true,
                  channelName: card.Module_Model,
                });
              }
              card.Channel.forEach((channel) => {
                if (channel.enabled !== "YES") {
                  return;
                }
                const channelId = Number(
                  channel.card_task_id + channel.id,
                ).toString(); // simply to remove starting 0's
                if (module.node_type === "Discrete") {
                  const processedChannel: Channel = {
                    ...channel,
                    channel_number: channelId,
                    colorScheme: getRandomColorScheme(),
                    uniqueId: Number(channelId),
                    channelState: "LOW",
                  };
                  if (
                    upateDiscreteInChannels &&
                    processedChannel.channel_type === "INPUT"
                  ) {
                    discreteInputChannel.push(processedChannel);
                  } else if (
                    upateDiscreteOutChannels &&
                    processedChannel.channel_type === "OUTPUT"
                  ) {
                    discreteOutputChannel.push(processedChannel);
                  }
                } else if (module.node_type === "Relay") {
                  const processedChannel: Channel = {
                    ...channel,
                    channel_number: channelId,
                    channel_type: "OUTPUT",
                    colorScheme: getRandomColorScheme(),
                    uniqueId: Number(channelId),
                    channelState: "LOW",
                  };
                  discreteOutputChannel.push(processedChannel);
                } else if (
                  module.node_type === "Voltage_Output" &&
                  upadteAnalogOutput
                ) {
                  analogOutputDataChannel.push({
                    ...channel,
                    channel_number: channelId,
                    colorScheme: getRandomColorScheme(),
                    uniqueId: Number(channelId),
                    channelState: "LOW",
                  });
                } else if (
                  upateContinuousChannels &&
                  module.node_type !== "Voltage_Output"
                ) {
                  continuousDataChannel.push({
                    value: channelId + " - " + channel.channel_name,
                    label: channelId + " - " + channel.channel_name,
                    chassisId: chassisName,
                    cardId: card.Task_id,
                    isSelectAll: false,
                    channelName: channel.channel_name ?? "Unknown",
                  });
                }
              });
            } else {
              console.log(`No channels found in Card ${cardIndex}`);
            }
          });
          if (upateDiscreteInChannels) {
            upateDiscreteInChannels(
              discreteInputChannel.sort((c1, c2) => c1.uniqueId - c2.uniqueId),
            );
          }
          if (upateDiscreteOutChannels) {
            upateDiscreteOutChannels(
              discreteOutputChannel.sort((c1, c2) => c1.uniqueId - c2.uniqueId),
            );
          }
          if (upateRelayChannels) {
            upateRelayChannels(
              relayOutputChannels.sort((c1, c2) => c1.uniqueId - c2.uniqueId),
            );
          }
          if (upateContinuousChannels) {
            upateContinuousChannels(continuousDataChannel);
          }
          if (upadteAnalogOutput) {
            upadteAnalogOutput(analogOutputDataChannel);
          }
        } else {
          console.log(`No cards found in Module ${moduleIndex}`);
        }
      });
    } else {
      console.log(
        "No valid InputModule data found. Checking for alternative structures...",
      );
      setError("No valid InputModule data found");
    }
  } catch (err) {
    console.error("Error in fetchData:", err);
    setError(`Error in fetchData:${err}`);
  }
  setLoading(false);
};

/** @format */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Channel,
  ChannelGroup,
  DiscreteChannelState,
  Option,
} from "../Monitoring/ConfiguredChannelSchema";
import { PlotOptions, SeriesData } from "../Monitoring/ChartSchema";
import { DynamicChannelRequest } from "../../types/MonitroingTypes";
import { useDataStreamRequester } from "../../hooks/useDataStreamRequester";
import { UrlConstant } from "../util/UrlConstans";

export type ConnectionType = "Off" | "Local" | "Remote";

interface PlotState {
  activeDiscreteChannelGroup: Record<string, Channel[]>;
  activeDiscreteChannelsRef: React.MutableRefObject<
    Record<number, DiscreteChannelState>
  >;
  activePlotChannelsRef: React.MutableRefObject<Record<string, SeriesData>>;
  bufferTimeWindow: number;
  connectionState: ConnectionType;
  dataStreamWSRef: React.MutableRefObject<WebSocket | null>;
  isStreaming: boolean;
  isPlotPausedForAnalysis: boolean;
  isRecording: boolean;
  availableChannels: string[];
  channelGroups: ChannelGroup[];
  enableChartLegend: boolean;
  //visibleSeries: Record<string, boolean>;
  tabUniqueId: string;
  chartOptions: PlotOptions[];
  channelIdToPlotInfoRef: React.MutableRefObject<{
    [channelId: string]: Option;
  }>;
  primaryGrpName: string;
  selectedSystemIndex: React.MutableRefObject<string>;
  tirggerChart: boolean;
  setActiveDiscreteChannelGroup: React.Dispatch<
    React.SetStateAction<Record<string, Channel[]>>
  >;
  setBufferTimeWindow: (tm: number) => void;
  setEnableChartLegend: React.Dispatch<React.SetStateAction<boolean>>;
  setPrimaryGrpName: (name: string) => void;
  setConnectionState: (state: ConnectionType) => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  setIsPlotPausedForAnalysis: React.Dispatch<React.SetStateAction<boolean>>;
  setAvailableChannels: React.Dispatch<React.SetStateAction<string[]>>;
  setChannelGroups: React.Dispatch<React.SetStateAction<ChannelGroup[]>>;
  //setVisibleSeries: (series: Record<string, boolean>) => void;
  setChartOptions: React.Dispatch<React.SetStateAction<PlotOptions[]>>;
  switchDataStreamWSConnection: (
    event?: string | React.MouseEvent<HTMLButtonElement>,
  ) => void;
  sendDynamicChannelRequest: (userName: string) => void;
  setTriggerChart: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlotContext = createContext<PlotState | undefined>(undefined);

const localUrl = UrlConstant.DAQ_STREAM_SERVER_URL;
const remoteUrl = UrlConstant.REMOTE_DATA_STREAM_SERVER_URL;

export const LiveMonitoringProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const maxReconnectAttempts = 3;
  const { formatAndSendReq } = useDataStreamRequester();

  const activePlotChannelsRef = useRef<Record<string, SeriesData>>({});
  const activeDiscreteChannelsRef = useRef<
    Record<number, DiscreteChannelState>
  >({});

  const channelIdToPlotInfoRef = useRef<{ [channel: string]: Option }>({});

  const dataStreamWSRef = useRef<WebSocket | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const selectedSystemIndex = useRef<ConnectionType>("Off");
  const seriesDataRef = useRef<Record<string, SeriesData>>({});

  const [activeDiscreteChannelGroup, setActiveDiscreteChannelGroup] = useState<
    Record<string, Channel[]>
  >({});

  const [availableChannels, setAvailableChannels] = useState<string[]>([]);

  const [bufferTimeWindow, setBufferTimeWindow] = useState<number>(5);

  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionType>("Off");

  const [enableChartLegend, setEnableChartLegend] = useState<boolean>(true);
  const [tirggerChart, setTriggerChart] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [isPlotPausedForAnalysis, setIsPlotPausedForAnalysis] = useState(false);

  const [primaryGrpName, setPrimaryGrpName] = useState<string>("Primary Group");
  const [tabUniqueId] = useState<string>(uuidv4());
  //const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});

  const [chartOptions, setChartOptions] = useState<PlotOptions[]>([
    {
      id: "main",
      options: {
        animationEnabled: false,
        zoomEnabled: true,
        zoomType: "xy",
        theme: "light2",
        title: { text: "Primary Group (Available Channels)", fontSize: 20 },
        axisX: {
          title: "Timestamp",
          valueFormatString: "HH:mm:ss",
          labelAngle: 90,
          titleFontSize: 14,
          gridThickness: 0.3,
          labelAutoFit: true,
          lineThickness: 0.5,
          labelFontSize: 14,
        },
        axisY: {
          title: "Data",
          titleFontSize: 14,
          labelFontSize: 14,
          gridThickness: 0.4,
          interlacedColor: "#F0F8FF",
          lineThickness: 0.5,
        },
        data: [],
        width: window.innerWidth * 0.9,
        height: 400,
      },
      width: window.innerWidth * 0.9,
      height: 400,
    },
  ]);

  //Todo: Have a single websocket functionality handle data and notification, status also uses websocket for notification
  //Todo: Change function name to handle disconnect and connect
  const switchDataStreamWSConnection = useCallback(
    (event?: string | React.MouseEvent<HTMLButtonElement>) => {
      if (dataStreamWSRef.current && event !== "Reconnect") {
        dataStreamWSRef.current?.close(1000); // Manually disconnect, clean close
        console.log("before ", seriesDataRef.current);
        seriesDataRef.current = {};
        console.log("After ", seriesDataRef.current);
        if (event !== "SwitchConnection") {
          activePlotChannelsRef.current = {};
          dataStreamWSRef.current = null;
          console.log(event);
          return;
        }
        console.log(event);
      } else if (event === "Terminate") {
        console.log("Termination called");
        activePlotChannelsRef.current = {};
        seriesDataRef.current = {};

        return;
      }
      try {
        const wsUrl =
          selectedSystemIndex.current === "Remote" ? remoteUrl : localUrl;
        console.log(
          "selectedSystemIndex to connect",
          selectedSystemIndex.current,
        );
        const newSocket = new WebSocket(wsUrl);

        newSocket.onopen = () => {
          setConnectionState(selectedSystemIndex.current);
          reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
          if (selectedSystemIndex.current === "Remote") {
            while (newSocket.readyState === WebSocket.CONNECTING) {
              //Just wait for the connection
            }
            if (newSocket.readyState === WebSocket.OPEN) {
              newSocket?.send(JSON.stringify({ tabUniqueId: tabUniqueId }));
            }
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        newSocket.onmessage = (_event: MessageEvent) => {
          // Message processing moved to component level
        };

        newSocket.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionState("Off");
          Object.keys(seriesDataRef.current).forEach((key) => {
            delete seriesDataRef.current[key];
          });
          // Don't automatically reconnect on explicit error
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        newSocket.onclose = (event) => {
          Object.keys(seriesDataRef.current).forEach((key) => {
            delete seriesDataRef.current[key];
          });
          setConnectionState("Off");
          setIsStreaming(false);
          setIsRecording(false);
          dataStreamWSRef.current = null;
          selectedSystemIndex.current = "Off"; // Todo lets create Enum for connection type once after connectvity test
          console.log("WSclose reason ", event.code);
          // Only attempt reconnection if not closed cleanly
          if (
            event.code !== 1000 &&
            reconnectAttemptsRef.current < maxReconnectAttempts
          ) {
            reconnectAttemptsRef.current++;
            const timeout = 500; //Math.pow(2, reconnectAttemptsRef.current) * 1000; // Exponential backoff
            console.log(
              `WebSocket disconnected. Attempting reconnect in ${timeout / 1000}s`,
            );
          }
        };

        dataStreamWSRef.current = newSocket;
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        Object.keys(seriesDataRef.current).forEach((key) => {
          delete seriesDataRef.current[key];
        });
        setConnectionState("Off");
      }
    },
    [
      dataStreamWSRef,
      setIsRecording,
      setIsStreaming,
      seriesDataRef,
      selectedSystemIndex,
      tabUniqueId,
    ],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }

      if (dataStreamWSRef) {
        // Use 1000 code for clean closure
        dataStreamWSRef.current?.close(1000, "Component unmounted");
      }
    };
  }, []);

  useEffect(() => {
    if (!isPlotPausedForAnalysis) {
      Object.keys(activePlotChannelsRef.current).forEach((channel) => {
        activePlotChannelsRef.current[channel].dataPoints = [];
      });
    }
  }, [isPlotPausedForAnalysis]);

  const getDynamicChannelList = useCallback(() => {
    const discreteChannels = Object.keys(activeDiscreteChannelsRef.current).map(
      (key) => Number(key),
    );
    const plotChannels: number[] = Object.keys(
      activePlotChannelsRef.current,
    ).map((key) => Number(key));
    return [...discreteChannels, ...plotChannels];
  }, []);

  const sendDynamicChannelRequest = useCallback(
    (userName: string) => {
      if (connectionState !== "Off" && dataStreamWSRef.current) {
        const channelsToReq = getDynamicChannelList();
        if (channelsToReq.length > 0) {
          formatAndSendReq(dataStreamWSRef.current, {
            commandId: "0XAB",
            tabIdLength: 36,
            finalChannelCount: channelsToReq.length,
            channelList: channelsToReq,
            tabUniqueId,
            userName,
          });
          console.log("Requested ", channelsToReq);
        }
      }
    },
    [connectionState],
  );

  return (
    <PlotContext.Provider
      value={{
        activeDiscreteChannelGroup,
        activePlotChannelsRef,
        activeDiscreteChannelsRef,
        bufferTimeWindow,
        connectionState,
        dataStreamWSRef,
        enableChartLegend,
        isStreaming,
        isRecording,
        isPlotPausedForAnalysis,
        availableChannels,
        channelGroups,
        //visibleSeries,
        tabUniqueId,
        chartOptions,
        channelIdToPlotInfoRef,
        primaryGrpName,
        tirggerChart,
        setActiveDiscreteChannelGroup,
        setBufferTimeWindow,
        setConnectionState,
        setEnableChartLegend,
        setPrimaryGrpName,
        selectedSystemIndex,
        setIsStreaming,
        setIsRecording,
        setIsPlotPausedForAnalysis,
        setAvailableChannels,
        setChannelGroups,
        //setVisibleSeries,
        setChartOptions,
        switchDataStreamWSConnection,
        sendDynamicChannelRequest,
        setTriggerChart,
      }}
    >
      {children}
    </PlotContext.Provider>
  );
};

export const useLiveMonitoringContext = () => {
  const context = useContext(PlotContext);
  if (!context) {
    throw new Error(
      "usePlotContext must be used within a LiveMonitoringProvider",
    );
  }
  return context;
};

/** @format */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  List,
  ListItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import DangerousSharpIcon from "@mui/icons-material/DangerousSharp";
import DesktopMacSharpIcon from "@mui/icons-material/DesktopMacSharp";
import LanguageSharpIcon from "@mui/icons-material/LanguageSharp";
import MedicalInformationIcon from "@mui/icons-material/MedicalInformation";

import { PageDrawer } from "../component/Widgets/PageDrawer";
import { PageContainer } from "../component/Widgets/PageContainer";
import { MenuItem } from "../component/Widgets/MenuItem";
import Plots from "../component/Monitoring/Analog/Plots";
import DiscreteInputOutputTabs from "./DiscreteInputOutput";
import {
  ConnectionType,
  useLiveMonitoringContext,
} from "../component/context/LiveMonitorContext";
import { DataChartFunction } from "../component/Monitoring/Analog/PlotSchema";
import { HistoricalDeviceHealth } from "../component/Monitoring/Status/HistoricalHealth";
import StorageIcon from "@mui/icons-material/Storage";
import HistoricalData from "./HistoricalData";
import AnalogOutputTabs from "./AnalogOutput";
import TextRotationNoneIcon from "@mui/icons-material/TextRotationNone";

type DashboardType =
  | "Plots"
  | "Discrete"
  | "DeviceHealth"
  | "HistoricalData"
  | "Analog Output";
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

export const Monitoring: React.FC = () => {
  const {
    activePlotChannelsRef,
    activeDiscreteChannelsRef,
    activeDiscreteChannelGroup,
    bufferTimeWindow,
    connectionState,
    dataStreamWSRef,
    isStreaming,
    isPlotPausedForAnalysis,
    setTriggerChart,
    selectedSystemIndex,
    switchDataStreamWSConnection,
  } = useLiveMonitoringContext();

  const [drawerOpenState, toggleDrawerOpenState] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardType>("Plots");
  const isZoomedRefs = useRef<{ [key: string]: boolean }>({ main: false });
  const channelChartRef = useRef<{ [chid: number | string]: string | null }>({
    main: null,
  });
  const dataChartRef = useRef<DataChartFunction>();

  const handleDrawerToggle = () => {
    toggleDrawerOpenState((prevOpen) => !prevOpen);
  };

  const updateDataPoints = useCallback(
    (inTime: number, key: number, newValue: number): void => {
      const timestamp = new Date(inTime * 1000);
      activePlotChannelsRef.current[key].dataPoints.push({
        x: timestamp,
        y: newValue,
      });
    },
    [],
  );

  const processWebSocketMessage = useCallback(
    (arrayBuffer: ArrayBuffer) => {
      const dataView = new DataView(arrayBuffer);
      const dataSize = 4;
      let byteOffset = 0;
      let triggerPlot = false;
      let triggerDiscrete = false;
      const channelCount = dataView.getUint16(
        DataBytePosition.ChannelCount,
        true,
      );
      for (let chnl_count = 0; chnl_count < channelCount; chnl_count++) {
        const dataCount = dataView.getUint16(
          byteOffset + DataBytePosition.DataCount,
          true,
        );
        const channelID = dataView.getUint32(
          byteOffset + DataBytePosition.ChannelUniqueId,
          true,
        );

        const timeStamp = dataView.getFloat64(
          byteOffset + DataBytePosition.TimeStamp,
          true,
        );
        const timeDelta = dataView.getFloat64(
          byteOffset + DataBytePosition.TimeDelta,
          true,
        );
        // console.log('channelID ', channelID,"dataCount",dataCount,"timeDelta",timeDelta,"timeStamp",timeStamp);
        // console.log('dataCount ', channelID);
        // if ( channelID ===10704001) {
        //   timeDelta=0.1
        // }
        if (!activePlotChannelsRef.current[channelID]) {
          console.log("         Not active check for discrete ", channelID);

          if (activeDiscreteChannelsRef.current[channelID]) {
            console.log("            activeDiscreteChannels ", channelID);
            for (
              let dataPosition = 0;
              dataPosition < dataCount;
              dataPosition++
            ) {
              const data = dataView.getFloat32(
                byteOffset + DataBytePosition.Payload,
                true,
              );
              activeDiscreteChannelsRef.current[channelID] =
                data === 1 ? "HIGH" : "LOW";
              byteOffset += dataSize;
              triggerDiscrete = true;
            }
            byteOffset += 22; //ADDED PADDING
          } else {
            byteOffset += dataSize * dataCount + 22; // skip remaining data and padding
          }
          continue;
        }

        const epochTime_1904 = 2082844801; //2083200000; //2082864070.0;

        let dataPointTime =
          timeStamp > epochTime_1904 ? timeStamp - epochTime_1904 : timeStamp;

        for (let dataPosition = 0; dataPosition < dataCount; dataPosition++) {
          const data = dataView.getFloat32(
            byteOffset + DataBytePosition.Payload,
            true,
          );
          updateDataPoints(dataPointTime, channelID, data);
          byteOffset += dataSize;
          dataPointTime += timeDelta;
        }
        byteOffset += 22; //ADDED PADDING

        const maxBufferDataCount = (1.0 / timeDelta) * bufferTimeWindow;
        const currentDataCount =
          activePlotChannelsRef.current[channelID].dataPoints.length;
        if (currentDataCount > 0) {
          triggerPlot = true;
        }
        if (currentDataCount > maxBufferDataCount) {
          if (
            !isZoomedRefs.current[channelChartRef.current[channelID] || "main"]
          ) {
            activePlotChannelsRef.current[channelID].dataPoints =
              activePlotChannelsRef.current[channelID].dataPoints.slice(
                -maxBufferDataCount,
              );
            // console.log("maxBufferDataCount",maxBufferDataCount)
          } else {
            const maxZoomedBuffDataCount = (1.0 / timeDelta) * 180;
            if (currentDataCount > maxZoomedBuffDataCount) {
              activePlotChannelsRef.current[channelID].dataPoints =
                activePlotChannelsRef.current[channelID].dataPoints.slice(
                  -maxZoomedBuffDataCount,
                );
            }
          }
        }
      }
      if (triggerPlot) {
        //console.log('data processed so setEnableChartLegend');
        if (dataChartRef.current) {
          dataChartRef.current.updateChartDataOption();
        }
      }
      if (triggerDiscrete) {
        setTriggerChart((state) => !state);
      }
    },
    [bufferTimeWindow, activeDiscreteChannelGroup, isPlotPausedForAnalysis],
  );
  //console.log('Monitoring triggered');
  useEffect(() => {
    if (dataStreamWSRef.current) {
      //console.log('setup processWebSocketMessage');
      dataStreamWSRef.current.onmessage = (event: MessageEvent) => {
        if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (
              e.target?.result instanceof ArrayBuffer &&
              !isPlotPausedForAnalysis
            ) {
              //console.log('Call processWebSocketMessage');
              processWebSocketMessage(e.target.result);
            }
          };
          reader.readAsArrayBuffer(event.data);
        }
      };
    }
  }, [
    isStreaming,
    bufferTimeWindow,
    activeDiscreteChannelGroup,
    isPlotPausedForAnalysis,
  ]);

  const handleSystemChange = useCallback(
    (event: React.MouseEvent, requestedSystem: ConnectionType) => {
      if (requestedSystem && requestedSystem !== connectionState) {
        if (selectedSystemIndex.current === requestedSystem) {
          console.log(selectedSystemIndex.current, requestedSystem);
          return;
        }
        //clearPlotChannelAndDataDetails();
        selectedSystemIndex.current = requestedSystem;
        switchDataStreamWSConnection(
          requestedSystem === "Off" ? "Terminate" : "SwitchConnection",
        );
      }
    },
    [connectionState],
  );

  return (
    <PageContainer enableLeftMargin={drawerOpenState}>
      <PageDrawer
        title={"Monitoring"}
        openDrawer={drawerOpenState}
        onToggleDrawer={handleDrawerToggle}
      >
        <List>
          <ListItem
            key={"Status"}
            disablePadding
            sx={{
              display: "block",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              mb: 2,
            }}
          >
            {!drawerOpenState && (
              <ToggleButton
                value="Off"
                aria-label="left aligned"
                color="error"
                selected={connectionState === "Off"}
                disabled
              >
                {connectionState === "Off" && (
                  <DangerousSharpIcon sx={{ fontSize: 21, color: "red" }} />
                )}
                {connectionState === "Local" && (
                  <DesktopMacSharpIcon sx={{ fontSize: 21, color: "green" }} />
                )}
                {connectionState === "Remote" && (
                  <LanguageSharpIcon sx={{ fontSize: 21, color: "green" }} />
                )}
              </ToggleButton>
            )}
            {drawerOpenState && (
              <ToggleButtonGroup
                value={connectionState}
                exclusive
                onChange={handleSystemChange}
                aria-label="Small sizes"
                size="small"
                className="shadow"
                sx={{ textAlign: "center" }}
              >
                <Tooltip
                  title={
                    connectionState === "Off" ? "Disconnected" : "Disconnect"
                  }
                >
                  <ToggleButton
                    value="Off"
                    aria-label="left aligned"
                    color="error"
                    selected={connectionState === "Off"}
                  >
                    <DangerousSharpIcon sx={{ fontSize: 21 }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip
                  title={
                    connectionState !== "Local"
                      ? "Connect to DAQ"
                      : "Connected to DAQ"
                  }
                >
                  <ToggleButton
                    value="Local"
                    aria-label="centered"
                    color="success"
                    selected={connectionState === "Local"}
                  >
                    <DesktopMacSharpIcon sx={{ fontSize: 21 }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip
                  title={
                    connectionState !== "Remote"
                      ? "Connect to Remote HMS"
                      : "Connected to Remote HMS"
                  }
                >
                  <ToggleButton
                    value="Remote"
                    aria-label="right aligned"
                    color="info"
                    selected={connectionState === "Remote"}
                  >
                    <LanguageSharpIcon sx={{ fontSize: 21 }} />
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            )}
          </ListItem>
          <ListItem key={"Plots"} disablePadding sx={{ display: "block" }}>
            <MenuItem
              icon={<QueryStatsIcon sx={{ fontSize: 21 }} />}
              text={"Plots"}
              onClick={() => {
                setDashboard("Plots");
                activeDiscreteChannelsRef.current = {};
              }}
              open={drawerOpenState}
            />
          </ListItem>
          <ListItem key={"Discrete"} disablePadding sx={{ display: "block" }}>
            <MenuItem
              icon={<BlurOnIcon sx={{ fontSize: 21 }} />}
              text={"Discrete"}
              onClick={() => {
                setDashboard("Discrete");
              }}
              open={drawerOpenState}
            />
          </ListItem>
          <ListItem
            key={"Voltage Output"}
            disablePadding
            sx={{ display: "block" }}
          >
            <MenuItem
              icon={<TextRotationNoneIcon sx={{ fontSize: 21 }} />}
              text={"Voltage Output"}
              onClick={() => {
                setDashboard("Analog Output");
              }}
              open={drawerOpenState}
            />
          </ListItem>
          <ListItem
            key={"DeviceHealth"}
            disablePadding
            sx={{ display: "block" }}
          >
            <MenuItem
              icon={<MedicalInformationIcon sx={{ fontSize: 21 }} />}
              text={"Device Health"}
              onClick={() => {
                setDashboard("DeviceHealth");
              }}
              open={drawerOpenState}
            />
          </ListItem>
          <ListItem
            key={"HistoricalData"}
            disablePadding
            sx={{ display: "block" }}
          >
            <MenuItem
              icon={<StorageIcon sx={{ fontSize: 21 }} />}
              text={"Historical Data"}
              onClick={() => {
                setDashboard("HistoricalData");
              }}
              open={drawerOpenState}
            />
          </ListItem>
        </List>
      </PageDrawer>
      {dashboard === "Plots" && (
        <Box
          component="main"
          sx={{
            width: drawerOpenState ? "calc(99vw - 240px)" : "calc(99vw - 65px)",
          }}
        >
          <Plots drawerOpenState={drawerOpenState} ref={dataChartRef} />
        </Box>
      )}
      {dashboard === "Discrete" && (
        <Box
          component="main"
          sx={{
            width: drawerOpenState ? "calc(99vw - 240px)" : "calc(99vw - 65px)",
          }}
        >
          <DiscreteInputOutputTabs />
        </Box>
      )}
      {dashboard === "Analog Output" && (
        <Box
          component="main"
          sx={{
            width: drawerOpenState ? "calc(99vw - 240px)" : "calc(99vw - 65px)",
          }}
        >
          <AnalogOutputTabs />
        </Box>
      )}
      {dashboard === "HistoricalData" && (
        <Box
          component="main"
          sx={{
            width: drawerOpenState ? "calc(99vw - 240px)" : "calc(99vw - 65px)",
          }}
        >
          <HistoricalData />
        </Box>
      )}
      {dashboard === "DeviceHealth" && (
        <Box
          component="main"
          sx={{
            width: drawerOpenState ? "calc(99vw - 240px)" : "calc(99vw - 65px)",
          }}
        >
          <HistoricalDeviceHealth />
        </Box>
      )}
    </PageContainer>
  );
};

/** @format */

import React, {
  forwardRef,
  useCallback,
  useEffect,
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
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import {
  ThreeBarsIcon,
  TabIcon,
  LocationIcon,
  GraphIcon,
  GrabberIcon,
} from "@primer/octicons-react";
import { MenuItem, Select } from "@mui/material";
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

const Plots = forwardRef((props: LiveMonitoringProps, ref) => {
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
    [availableChannels, channelGroups, setChartOptions],
  );

  const updatePlotsWithRecordedData = useCallback(
    async (id: string, value: number[]) => {
      const dateObject = new Date(value[0]);
      const utcString = dateObject.toISOString();
      const duration = 10; //(value[1] - value[0]) / 1000;
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
    [],
  );

  const handlePauseForAnalysis = useCallback(() => {
    const SomeChannel = Object.keys(activePlotChannelsRef.current)[0];
    const channelData = activePlotChannelsRef.current[SomeChannel];
    const latestTime =
      channelData?.dataPoints[channelData.dataPoints.length - 1]?.x.getTime() ||
      Date.now();
    refreshTimeRangeRef(latestTime);
    setIsPlotPausedForAnalysis((state) => !state);
  }, []);

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
            dataPoints: [],
          };
        }
      });

      const assignedChannels = channelGroups.flatMap((group) => group.channels);

      setAvailableChannels((prev: string[]) => {
        console.log("selectedChannels", selectedChannels);
        const newAvailable = prev.filter((ch) => selectedChannels.includes(ch));
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
              channelChart.current[ch] = group.id;
            }
            return res;
          }),
        }));
        return newGroups;
      });
    },
    [setAvailableChannels, channelGroups, setChannelGroups],
  );

  const toggleRecording = useCallback(() => {
    const recordingUrl = UrlConstant.LIVE_DATA_RECORDING_URL; //'https://a5483947.nos.boeing.com/api/v1/pxi-stream-data';
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
  }, [isRecording, isUpdateRecordingRequired, tabUniqueId, setIsRecording]);

  useEffect(() => {
    const layout = buildLayoutFromOptionList(chartOptions, showChannelSection);
    setGridLayout(layout);
  }, []);

  useEffect(() => {
    Object.keys(chartRefs.current).forEach((chartId) => {
      const chart = chartRefs.current[chartId] as unknown as ChartInstance;
      if (chart) {
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
  }, [channelGroups, drawerOpenState, showChannelSection]);

  const updateChartDataOption = useCallback(() => {
    setChartOptions((prevOptions) => {
      const updatedOptions = prevOptions.map((chart) => {
        const channels =
          channelGroups?.find((group) => group.id === chart.id)?.channels ??
          availableChannels;
        const dataArray = [];

        for (const channelId of channels) {
          const data = activePlotChannelsRef.current[channelId];
          if (data !== undefined) {
            data.showInLegend = enableChartLegend;
            dataArray.push(data);
          }
        }
        return {
          ...chart,
          ...(chart.options && {
            options: {
              ...chart.options,
              legend: {
                cursor: "pointer",
                fontSize: 16,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                itemclick: (e: any) => {
                  //Todo: update related type based canvas chart
                  handleLegendClick(e.dataSeries.name.replace(/-.*$/g, ""));
                  return false;
                },
              },
              data: dataArray,
            },
          }),
        };
      });

      return updatedOptions;
    });
  }, [enableChartLegend, availableChannels, channelGroups, handleLegendClick]);

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

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const sourceId = result.source.droppableId;
    const destId = result.destination.droppableId;

    if (sourceId === destId) {
      return;
    }
    // channel_name
    const channelId = result.draggableId;
    channelChart.current[channelId] =
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
        return deleteChannelFromSourceGroup(prevGroups, channelId, sourceId);
      } else {
        const newGroups = addChannelToTargetGroup(
          prevGroups,
          channelId,
          destId,
        );
        return deleteChannelFromSourceGroup(newGroups, channelId, sourceId);
      }
    });
  }, []);

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
      ); // Add 50px for legend

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
    [resizeID],
  );

  const handleResizeEnd = useCallback(() => {
    setResizeID(null);
    resizeRef.current = null;
  }, []);

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

  const updateChartTitle = useCallback((groupId: string, newName: string) => {
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
  }, []);
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
    setShowChannelSection((prev) => !prev);
  };

  return (
    <>
      <style>{customPlotsStyles}</style>
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
                  onRecordCall={toggleRecording}
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
                  <div key={chart.id} className="chart-container">
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

import { useMemo, useRef } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { MenuItem, Select } from "@mui/material";
import { ThreeBarsIcon, GraphIcon, GrabberIcon } from "@primer/octicons-react";

import { ChannelGroup } from "../ConfiguredChannelSchema";
import { customPlotsStyles } from "../../Widgets/CustomStyle";

interface PlotGroup {
  availableChannels: string[];
  bufferTimeWindow: number;
  channelGroups: ChannelGroup[];
  legendStatus: boolean;
  primaryGrpName: string;
  selectedGroup: string | null;
  createNewGroup: () => void;
  deleteGroup: (groupId: string) => void;
  handleDragEnd: (drag: DropResult) => void;
  removeChannelFromGroup: (groupId: string, name: string) => void;
  setBufferTimeWindow: (duration: number) => void;
  setPrimaryGrpName: (name: string) => void;
  setSelectedGroup: (group: string | null) => void;
  toggleChannelSection: () => void;
  toggleChartLagend: () => void;
  updateChartTitle: (grpId: string, name: string) => void;
  updateGroup: (groupId: string, name: string) => void;
}

export const PlotGroupSelection: React.FC<PlotGroup> = (prop) => {
  const timeOptions = useRef<string[]>(["1", "2", "5", "8"]);

  const groupColors = useMemo(
    () => [
      "bg-light-blue",
      "bg-light-green",
      "bg-light-yellow",
      "bg-light-pink",
      "bg-light-purple",
      "bg-light-teal",
      "bg-light-orange",
      "bg-light-indigo",
    ],
    [],
  );

  return (
    <>
      <style>{customPlotsStyles}</style>
      <div className="channels-section bg-custom-green rounded-lg shadow round-border p-2 pt-0 m-4 mt-1">
        <div className="dashboard-header pt-3 mb-3">
          <h6
            className="h6 font-weight-bold text-muted  "
            style={{ position: "absolute" }}
          >
            Dashboard Settings
          </h6>
          <div
            className="toggle-icon"
            onClick={prop.toggleChannelSection}
            title="Show streaming option"
          >
            <ThreeBarsIcon size={24} />
          </div>
        </div>
        <div className="mb-5">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div
              onClick={prop.toggleChartLagend}
              className="chip chip-lg chip-blue cursor-pointer shadow-sm no-shrink"
            >
              <span>Legend-{prop.legendStatus ? "On" : "Off"}</span>
            </div>
            <div className="chip chip-blue shadow-sm no-shrink">
              <span>
                Buffering Range-
                <Select
                  sx={{
                    borderRadius: "9999px",
                    paddingRight: 0,
                    paddingLeft: 1,
                    fontSize: ".6rem",
                    "& .MuiSelect-select.MuiInputBase-input.MuiOutlinedInput-input":
                      {
                        height: "1.5rem",
                        width: "2rem",
                        padding: 0,
                        alignContent: "center",
                      },
                  }}
                  value={prop.bufferTimeWindow}
                  onChange={(event) => {
                    prop.setBufferTimeWindow(Number(event.target.value));
                  }}
                >
                  {timeOptions.current.map((option: string) => (
                    <MenuItem
                      className="chip chip-blue"
                      value={option}
                      key={option}
                    >
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </span>
            </div>
          </div>

          <DragDropContext onDragEnd={prop.handleDragEnd}>
            <h6 className="h6 font-weight-bold text-muted">Primary Group</h6>
            <div className="lt-border rounded p-3 mb-3 transition">
              <span className="text-muted">
                <GraphIcon size={16} />
                <GrabberIcon size={16} />
                <input
                  className="group-input text-muted "
                  type="text"
                  value={prop.primaryGrpName}
                  onChange={(e) => {
                    prop.setPrimaryGrpName(e.target.value);
                    prop.updateChartTitle("main", e.target.value);
                  }}
                />
              </span>
              <Droppable
                droppableId="available-channels"
                direction="horizontal"
                isDropDisabled={false}
                isCombineEnabled={false}
                ignoreContainerClipping={false}
              >
                {(provided) => (
                  <div
                    className="d-flex flex-wrap gap-2 p-2 bg-light rounded border m-2"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {prop.availableChannels.map((channel, index) => (
                      <Draggable
                        key={channel.toString()}
                        draggableId={channel.toString()}
                        index={index}
                        isDragDisabled={false}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="chip chip-blue cursor-move shadow-sm no-shrink"
                          >
                            {channel.toString()}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {prop.availableChannels.length === 0 && (
                      <span className="text-muted small font-italic">
                        No channels available
                      </span>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="h6 font-weight-bold text-muted">
                  Channel Groups
                </h6>
                <div
                  onClick={prop.createNewGroup}
                  className="chip chip-blue shadow-sm no-shrink"
                  style={{ cursor: "pointer" }}
                >
                  <span className="small">+</span> New
                </div>
              </div>

              {prop.channelGroups.map((group, index) => (
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
                      className={`border rounded p-3 mb-3 transition ${groupColors[index % groupColors.length]} ${
                        prop.selectedGroup === group.id ? "shadow-lg" : ""
                      }`}
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div
                          className="font-weight-bold text-sm text-dark cursor-pointer"
                          onClick={() =>
                            prop.setSelectedGroup(
                              group.id === prop.selectedGroup ? null : group.id,
                            )
                          }
                          style={{ transition: "color 0.2s" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#212529")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#343a64")
                          }
                        >
                          <span className="text-muted">
                            <GraphIcon size={16} />
                            <GrabberIcon size={16} />
                            <input
                              className="group-input text-muted"
                              type="text"
                              value={group.name}
                              onChange={(e) =>
                                prop.updateGroup(group.id, e.target.value)
                              }
                            />
                          </span>
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            onClick={() => prop.deleteGroup(group.id)}
                            className="btn custom-btn btn-outline-danger py-0 px-2"
                          >
                            X
                          </button>
                        </div>
                      </div>
                      <div className="d-flex flex-wrap gap-2 custom-drop-area">
                        {group.channels.map((channel, index) => (
                          <Draggable
                            key={channel}
                            draggableId={channel.toString()}
                            index={index}
                            isDragDisabled={false}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="chip chip-green shadow-sm no-shrink"
                              >
                                {channel}
                                <div
                                  onClick={() =>
                                    prop.removeChannelFromGroup(
                                      group.id,
                                      channel,
                                    )
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
                          <div className="text-muted small font-italic text-center">
                            Drop channels here
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
              {prop.channelGroups.length === 0 && (
                <div className="text-muted small font-italic text-center py-3">
                  No groups created yet
                </div>
              )}
            </div>
          </DragDropContext>
        </div>
      </div>
    </>
  );
};

/** @format */

import React, { useState, useEffect, useCallback } from "react";
import Select from "react-select"; // Simplified import
import makeAnimated from "react-select/animated";
import { useLiveMonitoringContext } from "../../context/LiveMonitorContext";
import { Option } from "../ConfiguredChannelSchema";
import { fetchConfiguredChannels } from "../ConfiguredChannels";
import { useAuth } from "../../../AuthProvider";
import { SeriesData } from "../ChartSchema";

const animatedComponents = makeAnimated();
const customStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: "28px",
    fontSize: "12px",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    fontSize: "12px",
    padding: state.data.isCard ? "6px 8px" : "4px 8px 4px 24px",
    backgroundColor: state.data.isSelectAll
      ? "#f0f9ff"
      : provided.backgroundColor,
    fontWeight: state.data.isCard ? 600 : 400,
  }),
  groupHeading: (provided: any) => ({
    ...provided,
    fontSize: "12px",
    fontWeight: 600,
    color: "#1976d2",
    padding: "8px",
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: "#e3f2fd",
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    fontSize: "11px",
    color: "#1976d2",
  }),
  multiValueRemove: (provided: any) => ({
    ...provided,
    color: "#1976d2",
    ":hover": {
      backgroundColor: "#d0e4f7",
      color: "#1976d2",
    },
  }),
};

interface CascadingMultiSelectProps {
  onChannelSelect?: (channels: string[]) => void;
  onRecordCall: () => void;
  connectionStatus: string;
}

const CascadingMultiSelect: React.FC<CascadingMultiSelectProps> = ({
  onChannelSelect,
  onRecordCall,
  connectionStatus,
}) => {
  const {
    activePlotChannelsRef,
    activeDiscreteChannelsRef,
    channelIdToPlotInfoRef,
    isRecording,
    isStreaming,
    availableChannels,
    setAvailableChannels,
    setIsStreaming,
    sendDynamicChannelRequest,
  } = useLiveMonitoringContext();
  const { session } = useAuth();
  const isUpdateRecordingRequired = true;
  const [loading, setLoading] = useState(true);
  const [isChannelListChanged, setIsChannelListChanged] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [availableOptionListToSelect, setAvailableOptionListToSelect] =
    useState<Option[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Option[]>([]);
  //const API = UrlConstant.CONFIGURED_STATUS;

  const cleanUpSelectedChannels = useCallback(
    (optionListToMatch: Option[]) => {
      let changesDetected = false;
      if (connectionStatus !== "Off") {
        const channelList = Object.keys(activePlotChannelsRef.current);
        console.log("channelList", channelList);

        channelList.forEach((channelId) => {
          if (!optionListToMatch.some((option) => option.value === channelId)) {
            delete activePlotChannelsRef.current[channelId]; //Todo: if more number conversion then set type to string itself
            delete channelIdToPlotInfoRef.current[channelId];
            changesDetected = true;
          }
        });

        setSelectedOptions(Object.values(channelIdToPlotInfoRef.current));
      } else {
        setSelectedOptions([]);
      }
      setIsChannelListChanged(changesDetected);
    },
    [setSelectedOptions, connectionStatus],
  );

  const updateChannelsToPlot = useCallback((availableOpt: Option) => {
    channelIdToPlotInfoRef.current[availableOpt.value] = {
      yAxisIndex: 0,
      value: availableOpt.value,
      label: availableOpt.channelName,
      channelName: availableOpt.channelName,
    };
  }, []);

  const handleChannelChange = (selected: readonly Option[]) => {
    console.log("handleChannelChange", handleChannelChange);

    const tmpSelected = [...selected];
    const newSelectedChannels: Option[] = [];
    let changesDetected = false;

    tmpSelected.forEach((opt) => {
      if (opt.isSelectAll) {
        availableOptionListToSelect.forEach((availableOpt: Option) => {
          console.log("availableOpt", availableOpt);

          if (
            availableOpt.cardId === opt.cardId &&
            !availableOpt.isSelectAll &&
            !availableOpt.isCard
          ) {
            newSelectedChannels.push(availableOpt);
            changesDetected = true;
          }
        });
      } else {
        console.log("opt", opt);

        newSelectedChannels.push(opt);
        changesDetected = true;
      }
    });
    setIsChannelListChanged(changesDetected);
    setSelectedOptions(
      newSelectedChannels.sort((c1, c2) =>
        c1.label.localeCompare(c2.channelName),
      ),
    );
  };

  const handleStreamButtonClick = useCallback(() => {
    selectedOptions.forEach((opt) => {
      updateChannelsToPlot(opt);
    });
    cleanUpSelectedChannels(selectedOptions);

    if (onChannelSelect) {
      onChannelSelect(Object.keys(channelIdToPlotInfoRef.current));
    }
    setIsStreaming(true);
    setIsChannelListChanged(false);
    sendDynamicChannelRequest(session?.name || "Invalid User");
  }, [selectedOptions, updateChannelsToPlot]);

  useEffect(() => {
    fetchConfiguredChannels(
      setLoading,
      setError,
      setAvailableOptionListToSelect,
    );
  }, []);

  useEffect(() => {
    console.log("availableOptionListToSelect ", availableOptionListToSelect);
    console.log("connectionStatus ", connectionStatus);
    if (!loading) {
      cleanUpSelectedChannels(availableOptionListToSelect);
    }

    if (
      isStreaming ||
      connectionStatus === "Off" ||
      connectionStatus === "Remote" ||
      connectionStatus === "Local"
    ) {
      setSelectedOptions([]);
      setAvailableChannels([]);
      // setAvailableOptionListToSelect([]);
      activeDiscreteChannelsRef.current = {};
      activePlotChannelsRef.current = {};
      channelIdToPlotInfoRef.current = {};
    }
  }, [loading, availableOptionListToSelect, connectionStatus]);

  if (loading) return <div className="text-center p-4">Loading...</div>;
  if (error)
    return <div className="text-center p-4 text-danger">Error: {error}</div>;

  return (
    <div className="align-items-center" style={{ display: "contents" }}>
      <div
        className="col-md-6 align-items-center"
        style={{ display: "contents", minWidth: "250px", width: "100%" }}
      >
        <div className="container-fluid col-sm-12 px-1 mt-2 mb-2">
          <label className="form-label">Select Channels</label>
          <Select
            isMulti
            closeMenuOnSelect={false}
            components={animatedComponents}
            options={availableOptionListToSelect} // Always renders, with empty array if no data
            value={selectedOptions}
            onChange={handleChannelChange as any}
            styles={customStyles}
            placeholder={
              loading
                ? "Loading channels..."
                : error
                  ? "Error loading channels"
                  : connectionStatus === "Off"
                    ? "Switch connection"
                    : "Select channels"
            }
            classNamePrefix="select"
            isDisabled={!!error || connectionStatus === "Off"} // Disable if there's an error
          />
        </div>
      </div>
      <div className="col-md-12 mt-2 d-flex align-items-center justify-content-end">
        <button
          onClick={handleStreamButtonClick}
          disabled={
            connectionStatus === "Off" || (isStreaming && !isChannelListChanged)
          }
          className={`btn btn-sm me-2 ${
            connectionStatus === "Off" || (isStreaming && !isChannelListChanged)
              ? "btn-secondary disabled"
              : isStreaming
                ? "btn-warning"
                : "btn-danger"
          }`}
          style={{
            cursor:
              connectionStatus === "Off" ||
              (isStreaming && !isChannelListChanged)
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isStreaming
            ? isChannelListChanged
              ? "Update Stream"
              : "Stream Data"
            : "Stream Data"}
        </button>

        <button
          onClick={onRecordCall}
          disabled={connectionStatus === "Off" || !isStreaming}
          className={`btn btn-sm ${
            connectionStatus === "Off" || !isStreaming
              ? "btn-secondary disabled"
              : isStreaming
                ? "btn-warning"
                : "btn-danger"
          }`}
          style={{
            cursor:
              connectionStatus === "Off" || !isStreaming
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isStreaming && isRecording
            ? isUpdateRecordingRequired
              ? "Update Recording"
              : "Stop Recording"
            : "Record Stream"}
        </button>
      </div>
    </div>
  );
};

export default CascadingMultiSelect;

/** @format */

// Define interface types
export type DiscreteChannelState = "HIGH" | "LOW";
export type SupportedChannelTypes = "Discrete" | "Continuous";

export type UpdateChannelsFunc = (channels: Channel[]) => void;
export type UpdateChannelSelectionListFunc = (groups: Option[]) => void;

export interface Channel {
  Card_Type?: string;
  card_task_id: string;
  channel_name?: string;
  channelName?: string;
  channel_number: string;
  enabled?: string;
  graph_id?: string;
  id?: string;
  name?: string;
  type?: string;
  channel_type?: string;
  uniqueId: number;
  colorScheme?: string;
  channelState?: DiscreteChannelState;
  node_type?: string;
  Waveform_Type?: string;
  Waveform_type?: string;
  Waveform_Frequency?: string;
  Waveform_Amplitude?: string;
  Waveform_Time_Limit?: string;
}

export interface ChannelGroup {
  id: string;
  name: string;
  channels: string[];
}

export interface ChannelConfigApiResponse {
  Details?: {
    Test_Details?: {
      Chassis?: {
        system_name?: string;
        InputModule?: Array<{
          node_type: string;
          enabled: string;
          Card: Array<{
            enabled: string;
            Task_id: string;
            node_type: string;
            Module_Model: string;
            Channel: Channel[];
          }>;
        }>;
      };
    };
  };
  [key: string]: any;
}

export interface Option {
  value: string;
  label: string;
  chassisId?: string;
  cardId?: string;
  isSelectAll?: boolean;
  isCard?: boolean;
  channelName: string;
  yAxisIndex?: number;
  unit?: string;
}
