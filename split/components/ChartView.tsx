import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CanvasJSReact from "@canvasjs/react-charts";
import { DataRow, SeriesData } from "../types/historicalData.types";

const CanvasJSChart = CanvasJSReact.CanvasJSChart;

interface ChartViewProps {
  data: DataRow[];
}

const ChartView: React.FC<ChartViewProps> = ({ data }) => {
  const chartData: SeriesData[] = useMemo(() => {
    if (data.length === 0) {
      return [];
    }

    const channelsToPlot = Array.from(
      new Set(data.map((row: DataRow) => row.Channel).filter((ch: string) => ch))
    );

    const dataByChannel: { [key: string]: DataRow[] } = {};
    data.forEach((row: DataRow) => {
      const ch = row.Channel;
      if (ch && channelsToPlot.includes(ch)) {
        if (!dataByChannel[ch]) {
          dataByChannel[ch] = [];
        }
        dataByChannel[ch].push(row);
      }
    });

    const seriesData = channelsToPlot.map((channel) => ({
      type: "line",
      name: `${channel}`,
      showInLegend: true,
      visible: true,
      dataPoints: (dataByChannel[channel] || [])
        .filter((row) => row.Timestamp && !isNaN(Number(row.Value)))
        .map((row) => ({
          x: new Date(row.Timestamp),
          y: Number(row.Value),
        })),
    }));

    return seriesData;
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      animationEnabled: true,
      theme: "light2",
      zoomEnabled: true,
      zoomType: "xy",
      title: {
        fontSize: 20,
        text: "Historical Data",
      },
      axisX: {
        title: "Time",
        titleFontSize: 14,
        valueFormatString: "HH:mm:ss",
        labelAngle: -45,
      },
      axisY: {
        title: "Value",
        titleFontSize: 14,
      },
      legend: {
        cursor: "pointer",
        itemclick: (e: any) => {
          if (
            typeof e.dataSeries.visible === "undefined" ||
            e.dataSeries.visible
          ) {
            e.dataSeries.visible = false;
          } else {
            e.dataSeries.visible = true;
          }
          e.chart.render();
        },
      },
      data: chartData,
    }),
    [chartData]
  );

  if (chartData.length === 0) {
    return (
      <Box sx={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ p: 2, textAlign: "center" }}>
          No data available for plotting. Please select channels and apply.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 500, width: "100%" }}>
      <CanvasJSChart
        options={chartOptions}
        containerProps={{
          style: { width: "100%", height: "500px" },
        }}
      />
    </Box>
  );
};

export default ChartView;
