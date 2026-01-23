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
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";

interface LiveDataTableProps {
  selectedChannels?: string[];
}

export interface DataTableFunction {
  updateTableData: () => void;
}

// Table header style - matching historical data table
const headerCellStyle = {
  fontWeight: 600,
  backgroundColor: "#f8f9fa",
  color: "#495057",
  fontSize: "13px",
  padding: "12px 16px",
  borderBottom: "2px solid #dee2e6",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

// Table row style
const bodyCellStyle = {
  fontSize: "13px",
  padding: "10px 16px",
  borderBottom: "1px solid #e9ecef",
};

const LiveDataTable = forwardRef<DataTableFunction, LiveDataTableProps>(
  (props, ref) => {
    const { activePlotChannelsRef, channelIdToPlotInfoRef } =
      useLiveMonitoringContext();

    const [tableData, setTableData] = useState<
      Array<{
        timestamp: Date;
        channelId: string;
        channelName: string;
        value: number | string;
        unit: string;
      }>
    >([]);

    const updateTableData = useCallback(() => {
      const rows: Array<{
        timestamp: Date;
        channelId: string;
        channelName: string;
        value: number | string;
        unit: string;
      }> = [];

      // Get all active channels directly from the ref
      const activeChannelIds = Object.keys(activePlotChannelsRef.current);

      activeChannelIds.forEach((numericId) => {
        const data = activePlotChannelsRef.current[numericId];
        const channelInfo = channelIdToPlotInfoRef.current[numericId];
        const unit = channelInfo?.unit || "-";
        const channelName = data?.name || numericId;

        if (data?.dataPoints && data.dataPoints.length > 0) {
          // Get only the latest data point for each channel
          const latestPoint = data.dataPoints[data.dataPoints.length - 1];
          rows.push({
            timestamp: new Date(latestPoint.x),
            channelId: numericId,
            channelName: channelName,
            value: latestPoint.y,
            unit: unit,
          });
        }
      });

      // Sort by channel ID
      rows.sort((a, b) => a.channelId.localeCompare(b.channelId, undefined, { numeric: true }));

      setTableData(rows);
    }, [activePlotChannelsRef, channelIdToPlotInfoRef]);

    useImperativeHandle(
      ref,
      () => ({
        updateTableData,
      }),
      [updateTableData],
    );

    // Auto-update table every 500ms for smoother updates
    useEffect(() => {
      // Call immediately first time
      updateTableData();

      const intervalId = setInterval(() => {
        updateTableData();
      }, 500);

      return () => clearInterval(intervalId);
    }, [updateTableData]);

    return (
      <Box sx={{ width: "100%", p: 2 }}>
        <Paper
          elevation={0}
          sx={{
            border: "1px solid #dee2e6",
            borderRadius: "8px",
            overflow: "hidden"
          }}
        >
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small" aria-label="live data table">
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellStyle}>
                    Timestamp
                  </TableCell>
                  <TableCell sx={headerCellStyle}>
                    Channel ID
                  </TableCell>
                  <TableCell align="right" sx={headerCellStyle}>
                    Value
                  </TableCell>
                  <TableCell sx={headerCellStyle}>
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
                        "&:hover": { backgroundColor: "#f8f9fa" },
                        "&:nth-of-type(even)": { backgroundColor: "#fafbfc" },
                      }}
                    >
                      <TableCell sx={{ ...bodyCellStyle, fontFamily: "monospace" }}>
                        {row.timestamp.toLocaleTimeString()}.
                        {String(row.timestamp.getMilliseconds()).padStart(3, "0")}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellStyle, color: "#495057" }}>
                        {row.channelId}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...bodyCellStyle,
                          fontWeight: 600,
                          fontFamily: "monospace",
                          color: "#212529"
                        }}
                      >
                        {typeof row.value === "number"
                          ? row.value.toFixed(4)
                          : row.value}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellStyle, color: "#6c757d" }}>
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
                        padding: "48px 16px",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        No data available. Select channels and start streaming.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {tableData.length > 0 && (
            <Box sx={{
              p: 1.5,
              borderTop: "1px solid #dee2e6",
              backgroundColor: "#f8f9fa",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <Typography variant="caption" color="text.secondary">
                Showing latest values
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tableData.length} channels
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    );
  },
);

LiveDataTable.displayName = "LiveDataTable";
export default LiveDataTable;
