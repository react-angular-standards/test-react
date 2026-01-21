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
} from "../types/ConfiguredChannelSchema";
import { PlotOptions, SeriesData } from "../types/ChartSchema";
import { useDataStreamRequester } from "../../../hooks/useDataStreamRequester";
import { UrlConstant } from "../../util/UrlConstans";

export type ConnectionType = "Off" | "Local" | "Remote";

interface DynamicChannelRequest {
  commandId: string;
  tabIdLength: number;
  finalChannelCount: number;
  channelList: number[];
  tabUniqueId: string;
  userName: string;
}

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

  const [chartOptions, setChartOptions] = useState<PlotOptions[]>([
    {
      id: "main",
      options: {
        animationEnabled: false,
        zoomEnabled: true,
        zoomType: "xy",
        theme: "light2",
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
        axisY: [
          {
            title: "Data",
            titleFontSize: 14,
            labelFontSize: 14,
            gridThickness: 0.4,
            interlacedColor: "#F0F8FF",
            lineThickness: 0.5,
          },
        ],
        data: [],
        width: window.innerWidth * 0.9,
        height: 400,
      },
      width: window.innerWidth * 0.9,
      height: 400,
    },
  ]);

  // Helper function to reset all plot state to initial values
  const resetPlotState = useCallback(() => {
    activePlotChannelsRef.current = {};
    seriesDataRef.current = {};
    channelIdToPlotInfoRef.current = {};
    setAvailableChannels([]);
    setChannelGroups([]);
    setChartOptions([
      {
        id: "main",
        options: {
          animationEnabled: false,
          zoomEnabled: true,
          zoomType: "xy",
          theme: "light2",
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
          axisY: [
            {
              title: "Data",
              titleFontSize: 14,
              labelFontSize: 14,
              gridThickness: 0.4,
              interlacedColor: "#F0F8FF",
              lineThickness: 0.5,
            },
          ],
          data: [],
          width: window.innerWidth * 0.9,
          height: 400,
        },
        width: window.innerWidth * 0.9,
        height: 400,
      },
    ]);
  }, [setAvailableChannels, setChannelGroups, setChartOptions]);

  const switchDataStreamWSConnection = useCallback(
    (event?: string | React.MouseEvent<HTMLButtonElement>) => {
      if (dataStreamWSRef.current && event !== "Reconnect") {
        dataStreamWSRef.current?.close(1000);
        console.log("before ", seriesDataRef.current);
        seriesDataRef.current = {};
        console.log("After ", seriesDataRef.current);
        if (event !== "SwitchConnection") {
          resetPlotState();
          dataStreamWSRef.current = null;
          console.log(event);
          return;
        }
        console.log(event);
      } else if (event === "Terminate") {
        console.log("Termination called");
        resetPlotState();
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
          reconnectAttemptsRef.current = 0;
          if (selectedSystemIndex.current === "Remote") {
            while (newSocket.readyState === WebSocket.CONNECTING) {
              // Just wait for the connection
            }
            if (newSocket.readyState === WebSocket.OPEN) {
              newSocket?.send(JSON.stringify({ tabUniqueId: tabUniqueId }));
            }
          }
        };

        newSocket.onmessage = (_event: MessageEvent) => {
          // Message processing moved to component level
        };

        newSocket.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionState("Off");
          resetPlotState();
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        newSocket.onclose = (event) => {
          resetPlotState();
          setConnectionState("Off");
          setIsStreaming(false);
          setIsRecording(false);
          dataStreamWSRef.current = null;
          selectedSystemIndex.current = "Off";
          console.log("WSclose reason ", event.code);
          if (
            event.code !== 1000 &&
            reconnectAttemptsRef.current < maxReconnectAttempts
          ) {
            reconnectAttemptsRef.current++;
            const timeout = 500;
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
      resetPlotState,
    ],
  );

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (dataStreamWSRef) {
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

  // Reset channel groups and available channels when connection is Off
  useEffect(() => {
    if (connectionState === "Off") {
      setChannelGroups([]);
      setAvailableChannels([]);
    }
  }, [connectionState]);

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
          } as DynamicChannelRequest);
          console.log("Requested ", channelsToReq);
        }
      }
    },
    [connectionState, getDynamicChannelList, formatAndSendReq, tabUniqueId],
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
