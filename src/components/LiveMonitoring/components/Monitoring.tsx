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
import TableChartIcon from "@mui/icons-material/TableChart";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import DangerousSharpIcon from "@mui/icons-material/DangerousSharp";
import DesktopMacSharpIcon from "@mui/icons-material/DesktopMacSharp";
import LanguageSharpIcon from "@mui/icons-material/LanguageSharp";
import MedicalInformationIcon from "@mui/icons-material/MedicalInformation";
import StorageIcon from "@mui/icons-material/Storage";
import TextRotationNoneIcon from "@mui/icons-material/TextRotationNone";

import {
  ConnectionType,
  useLiveMonitoringContext,
} from "../context/LiveMonitorContext";

// Import components
import Plots, { DataChartFunction } from "./Plots";
import LiveDataTable, { DataTableFunction } from "./LiveDataTable";

// Placeholder components for components not yet extracted
const PageDrawer: React.FC<any> = ({
  children,
  title,
  openDrawer,
  onToggleDrawer,
}) => <div>{openDrawer && children}</div>;
const PageContainer: React.FC<any> = ({ children, enableLeftMargin }) => (
  <div>{children}</div>
);
const MenuItem: React.FC<any> = ({ icon, text, onClick, open }) => (
  <div onClick={onClick} style={{ cursor: "pointer" }}>
    {icon} {open && text}
  </div>
);
const DiscreteInputOutputTabs: React.FC = () => (
  <div>Discrete Input/Output Tabs</div>
);
const HistoricalData: React.FC = () => <div>Historical Data</div>;
const AnalogOutputTabs: React.FC = () => <div>Analog Output Tabs</div>;
const HistoricalDeviceHealth: React.FC = () => <div>Device Health</div>;

type DashboardType =
  | "Plots"
  | "Table"
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

interface DataChartFunction {
  updateChartDataOption: () => void;
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
  const dataTableRef = useRef<DataTableFunction>();

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
    [activePlotChannelsRef],
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

        if (!activePlotChannelsRef.current[channelID]) {
          if (activeDiscreteChannelsRef.current[channelID]) {
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
            byteOffset += 22;
          } else {
            byteOffset += dataSize * dataCount + 22;
          }
          continue;
        }

        const epochTime_1904 = 2082844801;
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
        byteOffset += 22;

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
        if (dashboard === "Plots" && dataChartRef.current) {
          dataChartRef.current.updateChartDataOption();
        }

        if (dashboard === "Table" && dataTableRef.current) {
          dataTableRef.current.updateTableData();
        }
      }

      if (triggerDiscrete) {
        setTriggerChart((state) => !state);
      }
    },
    [
      bufferTimeWindow,
      activeDiscreteChannelGroup,
      isPlotPausedForAnalysis,
      activePlotChannelsRef,
      activeDiscreteChannelsRef,
      setTriggerChart,
      updateDataPoints,
      dashboard,
    ],
  );

  useEffect(() => {
    if (dataStreamWSRef.current) {
      dataStreamWSRef.current.onmessage = (event: MessageEvent) => {
        if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (
              e.target?.result instanceof ArrayBuffer &&
              !isPlotPausedForAnalysis
            ) {
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
    dataStreamWSRef,
    processWebSocketMessage,
  ]);

  const handleSystemChange = useCallback(
    (event: React.MouseEvent, requestedSystem: ConnectionType) => {
      if (requestedSystem && requestedSystem !== connectionState) {
        if (selectedSystemIndex.current === requestedSystem) {
          return;
        }
        selectedSystemIndex.current = requestedSystem;
        switchDataStreamWSConnection(
          requestedSystem === "Off" ? "Terminate" : "SwitchConnection",
        );
      }
    },
    [connectionState, selectedSystemIndex, switchDataStreamWSConnection],
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
          <ListItem key={"Table"} disablePadding sx={{ display: "block" }}>
            <MenuItem
              icon={<TableChartIcon sx={{ fontSize: 21 }} />}
              text={"Table View"}
              onClick={() => {
                setDashboard("Table");
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
      {dashboard === "Table" && (
        <Box
          component="main"
          sx={{
            width: drawerOpenState ? "calc(99vw - 240px)" : "calc(99vw - 65px)",
          }}
        >
          <LiveDataTable drawerOpenState={drawerOpenState} ref={dataTableRef} />
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
