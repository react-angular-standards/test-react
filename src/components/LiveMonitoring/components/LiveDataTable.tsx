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

    const [tableData, setTableData] = useState<
      Array<{
        timestamp: Date;
        channelId: string;
        value: number | string;
        unit: string;
      }>
    >([]);

    const updateTableData = useCallback(() => {
      const currentTime = Date.now();
      const twoSecondsAgo = currentTime - 2000;
      const rows: Array<{
        timestamp: Date;
        channelId: string;
        value: number | string;
        unit: string;
      }> = [];

      selectedChannels.forEach((channel) => {
        const numericId = channel.split(" - ")[0];
        const data = activePlotChannelsRef.current[numericId];
        const channelInfo = channelIdToPlotInfoRef.current[numericId];
        const unit = channelInfo?.unit || "-";

        if (data?.dataPoints && data.dataPoints.length > 0) {
          // Filter data points from last 2 seconds
          data.dataPoints.forEach((point) => {
            const pointTime = new Date(point.x).getTime();
            if (pointTime >= twoSecondsAgo) {
              rows.push({
                timestamp: new Date(point.x),
                channelId: numericId,
                value: point.y,
                unit: unit,
              });
            }
          });
        }
      });

      // Sort by timestamp descending (newest first)
      rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setTableData(rows);
    }, [activePlotChannelsRef, channelIdToPlotInfoRef, selectedChannels]);

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

      // Call immediately first time
      updateTableData();

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
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "#1976d2",
                      color: "white",
                      fontSize: "16px",
                    }}
                  >
                    Channel ID
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "#1976d2",
                      color: "white",
                      fontSize: "16px",
                    }}
                  >
                    Value
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "#1976d2",
                      color: "white",
                      fontSize: "16px",
                    }}
                  >
                    Unit
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableData.length > 0 ? (
                  tableData.map((row, index) => (
                    <TableRow
                      key={`${row.channelId}-${row.timestamp.getTime()}-${index}`}
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
                        {row.timestamp.toLocaleTimeString()}.
                        {row.timestamp.getMilliseconds()}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontSize: "14px",
                          fontWeight: "medium",
                        }}
                      >
                        {row.channelId}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                      >
                        {typeof row.value === "number"
                          ? row.value.toFixed(2)
                          : row.value}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontSize: "14px",
                          color: "#666",
                        }}
                      >
                        {row.unit}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      align="center"
                      sx={{
                        fontSize: "16px",
                        color: "#999",
                        padding: "40px",
                      }}
                    >
                      No data available. Please select channels and start
                      streaming.
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
