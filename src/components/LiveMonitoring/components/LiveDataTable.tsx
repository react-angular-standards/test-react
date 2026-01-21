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
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";

interface LiveDataTableProps {
  selectedChannels: string[];
}

export interface DataTableFunction {
  updateTableData: () => void;
}

const LiveDataTable = forwardRef<DataTableFunction, LiveDataTableProps>(
  (props, ref) => {
    const { selectedChannels } = props;
    const { activePlotChannelsRef, channelIdToPlotInfoRef } =
      useLiveMonitoringContext();

    const [tableData, setTableData] = useState<{
      timestamp: string;
      values: { [channelId: string]: number | string };
    }>({
      timestamp: new Date().toLocaleTimeString(),
      values: {},
    });

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
                      No channels selected. Please select channels to view data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      </div>
    );
  },
);

LiveDataTable.displayName = "LiveDataTable";
export default LiveDataTable;
