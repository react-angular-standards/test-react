/** @format */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import CascadingMultiSelect from "./CascadingMultiSelect";
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";
import { UrlConstant } from "../../../util/UrlConstans";

interface LiveDataTableProps {
  drawerOpenState: boolean;
}

export interface DataTableFunction {
  updateTableData: () => void;
}

const LiveDataTable = forwardRef<DataTableFunction, LiveDataTableProps>(
  (props, ref) => {
    const { drawerOpenState } = props;
    const {
      activePlotChannelsRef,
      channelIdToPlotInfoRef,
      connectionState,
      isRecording,
      tabUniqueId,
      setIsRecording,
    } = useLiveMonitoringContext();

    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [tableData, setTableData] = useState<{
      timestamp: string;
      values: { [channelId: string]: number | string };
    }>({
      timestamp: new Date().toLocaleTimeString(),
      values: {},
    });

    const handleChannelSelect = useCallback(
      (channels: string[]) => {
        setSelectedChannels(channels);

        // Initialize data structure for selected channels
        channels.forEach((channel) => {
          const numericId = channel.split(" - ")[0];
          const channelInfo = channelIdToPlotInfoRef.current[numericId];

          if (!channelInfo) {
            console.warn("Channel info not found for:", numericId, channel);
            return;
          }

          // Initialize channel in activePlotChannelsRef if not exists
          if (!activePlotChannelsRef.current[numericId]) {
            activePlotChannelsRef.current[numericId] = {
              type: "line",
              name: channel,
              showInLegend: false,
              visible: true,
              lineColor: channelInfo.color,
              markerColor: channelInfo.color,
              dataPoints: [],
            };
          }
        });
      },
      [activePlotChannelsRef, channelIdToPlotInfoRef],
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

      if (isRecording) {
        fetchRecordingData({ ...commonPayload, channelList: [] }).then(() => {
          setIsRecording(false);
        });
      } else {
        const channelList = selectedChannels.map((channel) =>
          Number(channel.split(" - ")[0]),
        );
        fetchRecordingData({ ...commonPayload, channelList }).then(() => {
          setIsRecording(true);
        });
      }
    }, [isRecording, selectedChannels, setIsRecording, tabUniqueId]);

    const updateTableData = useCallback(() => {
      const latestValues: { [channelId: string]: number | string } = {};
      let latestTimestamp = new Date();

      selectedChannels.forEach((channel) => {
        const numericId = channel.split(" - ")[0];
        const data = activePlotChannelsRef.current[numericId];

        if (data?.dataPoints && data.dataPoints.length > 0) {
          const lastPoint = data.dataPoints[data.dataPoints.length - 1];
          latestValues[numericId] = lastPoint.y;

          // Use the most recent timestamp across all channels
          if (lastPoint.x > latestTimestamp) {
            latestTimestamp = new Date(lastPoint.x);
          }
        } else {
          latestValues[numericId] = "-";
        }
      });

      setTableData({
        timestamp: latestTimestamp.toLocaleTimeString(),
        values: latestValues,
      });
    }, [activePlotChannelsRef, selectedChannels]);

    useImperativeHandle(
      ref,
      () => ({
        updateTableData,
      }),
      [updateTableData],
    );

    // Auto-update table every second
    useEffect(() => {
      if (selectedChannels.length === 0) return;

      const intervalId = setInterval(() => {
        updateTableData();
      }, 1000);

      return () => clearInterval(intervalId);
    }, [selectedChannels, updateTableData]);

    return (
      <div className="row" style={{ padding: "20px" }}>
        <div className="col-12">
          <div className="row" style={{ marginBottom: "20px" }}>
            <div className="col-12">
              <CascadingMultiSelect
                onChannelSelect={handleChannelSelect}
                connectionStatus={connectionState}
                onRecordCall={toggleRecording}
              />
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                <Table stickyHeader aria-label="live data table">
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          backgroundColor: "#1976d2",
                          color: "white",
                          fontSize: "16px",
                        }}
                      >
                        Timestamp
                      </TableCell>
                      {selectedChannels.map((channel) => {
                        const numericId = channel.split(" - ")[0];
                        const channelInfo =
                          channelIdToPlotInfoRef.current[numericId];
                        const unit = channelInfo?.unit || "Value";

                        return (
                          <TableCell
                            key={numericId}
                            align="center"
                            sx={{
                              fontWeight: "bold",
                              backgroundColor: channelInfo?.color || "#1976d2",
                              color: "white",
                              fontSize: "16px",
                            }}
                          >
                            {channel} ({unit})
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedChannels.length > 0 ? (
                      <TableRow
                        sx={{
                          "&:hover": { backgroundColor: "#f5f5f5" },
                        }}
                      >
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{
                            fontWeight: "medium",
                            fontSize: "14px",
                          }}
                        >
                          {tableData.timestamp}
                        </TableCell>
                        {selectedChannels.map((channel) => {
                          const numericId = channel.split(" - ")[0];
                          const value = tableData.values[numericId];

                          return (
                            <TableCell
                              key={numericId}
                              align="center"
                              sx={{
                                fontSize: "14px",
                                fontWeight: value === "-" ? "normal" : "bold",
                                color: value === "-" ? "#999" : "#000",
                              }}
                            >
                              {typeof value === "number"
                                ? value.toFixed(2)
                                : value}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={1}
                          align="center"
                          sx={{
                            fontSize: "16px",
                            color: "#999",
                            padding: "40px",
                          }}
                        >
                          No channels selected. Please select channels from
                          above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

LiveDataTable.displayName = "LiveDataTable";
export default LiveDataTable;
