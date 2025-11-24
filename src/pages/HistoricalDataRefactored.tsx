/** @format */
import React, { useState, useMemo, useEffect } from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { ToggleButtonGroup, ToggleButton, Tabs, Tab } from "@mui/material";
import {
  Container,
  Box,
  Typography,
  Drawer,
  IconButton,
  Chip,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DownloadIcon from "@mui/icons-material/Download";
import { ThemeProvider } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

// Local imports
import { UrlConstant } from "../component/util/UrlConstans";
import { muiTheme } from "../theme/muiTheme";
import { exportToCSV } from "../utils/csvExport";
import useHistoricalData from "../hooks/useHistoricalData";
import useTestSelections from "../hooks/useTestSelections";
import useCustomQuerySelections from "../hooks/useCustomQuerySelections";
import FilterDrawerContent from "../components/drawers/FilterDrawerContent";
import CustomQueryDrawerContent from "../components/drawers/CustomQueryDrawerContent";
import Pagination from "../components/Pagination";
import {
  SelectedConfig,
  DataRow,
  Test,
  SelectOption,
  CustomQueryConfig,
} from "../types/historicalData.types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CanvasJSReact from "@canvasjs/react-charts";

interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  dataPoints: { x: Date; y: number }[];
}

const HistoricalDataRefactored: React.FC = () => {
  // State
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"filter" | "customQuery">(
    "filter",
  );
  const [view, setView] = useState<"table" | "plot">("table");

  // Single data state - either filter OR custom query data
  const [tableData, setTableData] = useState<DataRow[]>([]);
  const [dataSource, setDataSource] = useState<"filter" | "customQuery" | null>(
    null,
  );

  const [selectedConfigs, setSelectedConfigs] = useState<SelectedConfig[]>([]);
  const [selectedCustomQueries, setSelectedCustomQueries] = useState<
    {
      testName: string;
      configName: string;
      config: CustomQueryConfig;
      pushToDB: boolean;
    }[]
  >([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Single pagination
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // API base
  const apiBase = UrlConstant.HISTORICAL_DATA_API;

  // Custom hooks
  const {
    tests,
    configs,
    cards,
    channels,
    allChannels,
    loading,
    error,
    setError,
    fetchConfigs,
    fetchTestConfigDetails,
    fetchFilteredData,
    fetchCustomQueryData,
  } = useHistoricalData(apiBase);

  const {
    testSelections,
    handleTestSelect,
    handleTestToggle,
    handleTestAccordionToggle,
    handleConfigAccordionToggle,
    handleChannelSelect,
    handleTimeChange,
    updateConfigSelections,
    updateCardSelections,
    clearAllSelections,
  } = useTestSelections(tests);

  const {
    customQueryTests,
    handleCustomQueryTestSelect,
    handleCustomQueryTestToggle,
    handleCustomQueryTestAccordionToggle,
    handleCustomQueryConfigAccordionToggle,
    handleCustomQueryTimeChange,
    handleAddToExpression,
    handleCustomQueryChannelSelect,
    handleAddOperator,
    handleClearOperators,
    handleExpressionChange,
    handleConstantValueChange,
    handleAddConstant,
    handleOutputChannelNameChange,
    updateCustomQueryConfigs,
    updateCustomQueryTime,
    clearAllCustomQuerySelections,
  } = useCustomQuerySelections(tests);

  // Fetch configs when test is selected (for both tabs)
  useEffect(() => {
    const selectedFilterTests = testSelections.filter((sel) => sel.isSelected);
    const selectedCustomTests = customQueryTests.filter(
      (sel) => sel.isSelected,
    );
    const allSelected = [
      ...selectedFilterTests.map((s) => s.testName),
      ...selectedCustomTests.map((s) => s.testName),
    ];
    const uniqueSelected = Array.from(new Set(allSelected));

    uniqueSelected.forEach((testName) => {
      if (!configs[testName]) {
        fetchConfigs(testName).then((configNames) => {
          if (configNames) {
            updateConfigSelections(testName, configNames);
            updateCustomQueryConfigs(testName, configNames);
          }
        });
      }
    });
  }, [testSelections, customQueryTests, configs]);

  // Handle config accordion toggle with data fetch
  const handleConfigToggle = (testName: string, configName: string) => {
    handleConfigAccordionToggle(testName, configName);

    // Check if cardSelections need to be populated
    const testSelection = testSelections.find((t) => t.testName === testName);
    const configSelection = testSelection?.configSelections.find(
      (c) => c.configName === configName,
    );

    // Always fetch/get card details if cardSelections is empty
    if (!configSelection || configSelection.cardSelections.length === 0) {
      fetchTestConfigDetails(testName, configName).then((result) => {
        if (result && result.cards) {
          updateCardSelections(testName, configName, result.cards, {
            startTime: result.startTime,
            endTime: result.endTime,
          });
          updateCustomQueryTime(testName, configName, {
            startTime: result.startTime,
            endTime: result.endTime,
          });
        }
      });
    }
  };

  // Handle custom query config accordion toggle with data fetch
  const handleCustomQueryConfigToggle = (
    testName: string,
    configName: string,
  ) => {
    handleCustomQueryConfigAccordionToggle(testName, configName);
    // Always fetch to ensure channels are loaded for auto-suggestions
    fetchTestConfigDetails(testName, configName).then((result) => {
      if (result) {
        updateCustomQueryTime(testName, configName, {
          startTime: result.startTime,
          endTime: result.endTime,
        });
      }
    });
  };

  // Load data based on current data source
  const loadData = async () => {
    if (dataSource === "filter" && selectedConfigs.length > 0) {
      setDataLoading(true);
      try {
        let allData: DataRow[] = [];
        let total = 0;

        for (const sc of selectedConfigs) {
          const { data, totalCount: count } = await fetchFilteredData(
            currentPage,
            pageSize,
            sc.testName,
            sc.configSelection,
          );
          allData = allData.concat(data);
          total += count;
        }

        // Sort by timestamp
        allData.sort(
          (a, b) =>
            new Date(a.timestamp || a.Timestamp).getTime() -
            new Date(b.timestamp || b.Timestamp).getTime(),
        );

        setTableData(allData);
        setTotalCount(total);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setDataLoading(false);
      }
    } else if (
      dataSource === "customQuery" &&
      selectedCustomQueries.length > 0
    ) {
      setDataLoading(true);
      try {
        let allData: DataRow[] = [];
        let total = 0;

        for (const cq of selectedCustomQueries) {
          const { data: customData, totalCount: count } =
            await fetchCustomQueryData(
              currentPage,
              pageSize,
              cq.testName,
              cq.configName,
              cq.config,
              cq.pushToDB,
            );
          allData = allData.concat(customData);
          total += count;
        }

        // Sort by Timestamp
        allData.sort(
          (a, b) =>
            new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime(),
        );

        setTableData(allData);
        setTotalCount(total);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setDataLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [
    currentPage,
    pageSize,
    dataSource,
    selectedConfigs,
    selectedCustomQueries,
  ]);

  // Handle submit
  const handleSubmit = async (pushToDB: boolean = false) => {
    const selectedConfigsList: SelectedConfig[] = [];
    const selectedCustomQueriesList: {
      testName: string;
      configName: string;
      config: CustomQueryConfig;
      pushToDB: boolean;
    }[] = [];

    // Collect filter selections
    testSelections.forEach((sel) => {
      if (sel.isSelected) {
        sel.configSelections.forEach((config) => {
          if (
            config.cardSelections.some(
              (card) => card.selectedChannels.length > 0,
            )
          ) {
            selectedConfigsList.push({
              testName: sel.testName,
              configName: config.configName,
              configSelection: config,
            });
          }
        });
      }
    });

    // Collect custom query selections
    customQueryTests.forEach((sel) => {
      if (sel.isSelected) {
        sel.customQueryConfigs.forEach((config) => {
          if (
            config.channelExpression.trim() &&
            config.outputChannelName.trim()
          ) {
            selectedCustomQueriesList.push({
              testName: sel.testName,
              configName: config.configName,
              config: config,
              pushToDB: pushToDB,
            });
          }
        });
      }
    });

    // Clear previous data first
    setTableData([]);
    setTotalCount(0);
    setCurrentPage(0);
    setError(null);

    // Handle filter submit
    if (activeTab === "filter") {
      if (selectedConfigsList.length === 0) {
        setError("Please select at least one channel");
        return;
      }
      setSelectedConfigs(selectedConfigsList);
      setSelectedCustomQueries([]); // Clear other source
      setDataSource("filter");
    }
    // Handle custom query submit
    else if (activeTab === "customQuery") {
      if (selectedCustomQueriesList.length === 0) {
        setError(
          "Please configure a valid custom query with expression and output name",
        );
        return;
      }
      setSelectedCustomQueries(selectedCustomQueriesList);
      setSelectedConfigs([]); // Clear other source
      setDataSource("customQuery");
    }

    setDrawerOpen(false);
  };

  // Handle clear for filter
  const handleFilterClear = () => {
    clearAllSelections();
    setTableData([]);
    setTotalCount(0);
    setSelectedConfigs([]);
    setCurrentPage(0);
    setDataSource(null);
  };

  // Handle clear for custom query
  const handleCustomQueryClear = () => {
    clearAllCustomQuerySelections();
    setTableData([]);
    setTotalCount(0);
    setSelectedCustomQueries([]);
    setCurrentPage(0);
    setDataSource(null);
  };

  // Toggle drawer
  const toggleDrawer = (open: boolean) => () => {
    setDrawerOpen(open);
  };

  // Handle drawer tab change
  const handleTabChange = (
    _: React.SyntheticEvent,
    newValue: "filter" | "customQuery",
  ) => {
    setActiveTab(newValue);
  };

  // Handle view change
  const handleViewChange = (
    _: React.MouseEvent<HTMLElement>,
    newView: "table" | "plot" | null,
  ) => {
    if (newView) {
      setView(newView);
    }
  };

  // Generate columns dynamically from data
  const columns: GridColDef[] = useMemo(() => {
    if (tableData.length === 0) return [];
    const keys = Object.keys(tableData[0]).filter((key) => key !== "id");
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, " $1").trim(),
      flex: 1,
      sortable: false,
    }));
  }, [tableData]);

  // Helper function to generate chart data from any data source
  const generateChartData = (
    data: DataRow[],
    timestampField: string,
    channelField: string,
    valueField: string,
  ): SeriesData[] => {
    if (data.length === 0) return [];

    // Get unique channel names
    const channelsToPlot = Array.from(
      new Set(
        data
          .map((row: any) => String(row[channelField]))
          .filter((ch: string) => ch && ch !== "undefined" && ch !== "null"),
      ),
    );

    const dataByChannel: { [key: string]: any[] } = {};
    data.forEach((row: any) => {
      const ch = String(row[channelField]);
      if (ch && channelsToPlot.includes(ch)) {
        if (!dataByChannel[ch]) {
          dataByChannel[ch] = [];
        }
        dataByChannel[ch].push(row);
      }
    });

    const seriesData = channelsToPlot.map((channel) => ({
      type: "line",
      name: `Ch ${channel}`,
      showInLegend: true,
      visible: true,
      dataPoints: (dataByChannel[channel] || [])
        .filter((row) => row[timestampField] && !isNaN(Number(row[valueField])))
        .map((row) => ({
          x: new Date(row[timestampField]),
          y: Number(row[valueField]),
        })),
    }));

    if (seriesData.some((series) => series.dataPoints.length > 0)) {
      return seriesData;
    }

    return [];
  };

  // Chart data - handle both data formats
  const chartData: SeriesData[] = useMemo(() => {
    if (tableData.length === 0) return [];

    const firstRow = tableData[0];
    const timestampField = "timestamp" in firstRow ? "timestamp" : "Timestamp";
    const hasChannelColumn = "Channel" in firstRow || "channel" in firstRow;

    if (hasChannelColumn) {
      const channelField = "Channel" in firstRow ? "Channel" : "channel";
      const valueField = "Value" in firstRow ? "Value" : "value";
      return generateChartData(
        tableData,
        timestampField,
        channelField,
        valueField,
      );
    } else {
      // Handle column-based channel data (channel_123, channel_456, etc.)
      const channelKeys = Object.keys(firstRow).filter((key) =>
        key.startsWith("channel_"),
      );
      if (channelKeys.length === 0) return [];

      return channelKeys.map((channelKey) => {
        const channelName = channelKey.replace("channel_", "");
        return {
          type: "line",
          name: `Ch ${channelName}`,
          showInLegend: true,
          visible: true,
          dataPoints: tableData
            .filter(
              (row: any) =>
                row[timestampField] && !isNaN(Number(row[channelKey])),
            )
            .map((row: any) => ({
              x: new Date(row[timestampField]),
              y: Number(row[channelKey]),
            })),
        };
      });
    }
  }, [tableData]);

  // Chart options
  const chartOptions = useMemo(
    () => ({
      animationEnabled: true,
      theme: "light2",
      zoomEnabled: true,
      zoomType: "xy",
      title: {
        fontSize: 20,
        text: dataSource === "filter" ? "Filter Data" : "Custom Query Data",
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
    [chartData, dataSource],
  );

  // Handle CSV export
  const handleExportCSV = () => {
    const testName =
      selectedConfigs.length > 0 ? selectedConfigs[0].testName : undefined;
    const result = exportToCSV(tableData, columns, testName);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  // Test options for select
  const testOptions: SelectOption[] = useMemo(
    () =>
      tests.map((test: Test) => ({
        value: test.TestName,
        label: test.TestName,
      })),
    [tests],
  );

  // Create all channel options for custom query
  const allChannelOptions: SelectOption[] = useMemo(
    () =>
      allChannels.map((channel) => ({
        value: channel.toString(),
        label: `Ch: ${channel}`,
      })),
    [allChannels],
  );

  const selectedTestsCount = testSelections.filter(
    (sel) => sel.isSelected,
  ).length;
  const selectedCustomQueryTestsCount = customQueryTests.filter(
    (sel) => sel.isSelected,
  ).length;

  // Check if we have data
  const hasData = tableData.length > 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <Container maxWidth={false} disableGutters sx={{ mt: 4 }}>
          <Box
            sx={{
              display: "flex",
              bgcolor: "background.default",
              minHeight: "100vh",
            }}
          >
            <Box
              component="main"
              sx={{ flexGrow: 1, p: 2, overflow: "hidden" }}
            >
              {/* Header */}
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  {/* View Toggle */}
                  <ToggleButtonGroup
                    value={view}
                    exclusive
                    onChange={handleViewChange}
                    aria-label="view switch"
                    sx={{
                      backgroundColor: "#f0f0f0",
                      borderRadius: "6px",
                      p: "2px",
                      "& .MuiToggleButton-root": {
                        border: "none",
                        padding: "6px 12px",
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        color: "#333",
                        "&.Mui-selected": {
                          backgroundColor: "#1565c0",
                          color: "white",
                          "&:hover": { backgroundColor: "#1565c0" },
                        },
                        "&:hover": { backgroundColor: "#e0e0e0" },
                      },
                    }}
                  >
                    <ToggleButton value="table">Table</ToggleButton>
                    <ToggleButton value="plot">Plot</ToggleButton>
                  </ToggleButtonGroup>
                  <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportCSV}
                    disabled={!hasData}
                    sx={{
                      fontSize: "0.85rem",
                      textTransform: "none",
                      fontWeight: 600,
                      padding: "6px 16px",
                    }}
                  >
                    Export CSV
                  </Button>
                  {/* Data source indicator */}
                  {dataSource && (
                    <Typography
                      variant="body2"
                      sx={{ color: "#666", fontSize: "0.8rem" }}
                    >
                      Source:{" "}
                      {dataSource === "filter" ? "Filter" : "Custom Query"} (
                      {tableData.length} rows)
                    </Typography>
                  )}
                </Box>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="end"
                  onClick={toggleDrawer(true)}
                >
                  <MenuIcon />
                </IconButton>
              </Box>

              {/* Error Message */}
              {error && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1,
                    bgcolor: error.includes("API") ? "#fff3cd" : "#ffebee",
                    borderRadius: 1,
                    border: `1px solid ${error.includes("API") ? "#ffeaa7" : "#ffcdd2"}`,
                  }}
                >
                  <Typography
                    color={error.includes("API") ? "warning.main" : "error"}
                    variant="body2"
                    sx={{ fontWeight: 500, fontSize: "0.75rem" }}
                  >
                    {error}
                  </Typography>
                </Box>
              )}

              {/* Data View */}
              <Box
                sx={{
                  height: "calc(100vh - 250px)",
                  minHeight: 600,
                  width: "100%",
                  overflow: "hidden",
                }}
              >
                {!hasData ? (
                  <Box
                    sx={{
                      p: 4,
                      textAlign: "center",
                      bgcolor: "#f5f5f5",
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body1" color="text.secondary">
                      No data. Select options from the drawer and click
                      Apply/View.
                    </Typography>
                  </Box>
                ) : view === "table" ? (
                  <DataGrid
                    rows={tableData}
                    columns={columns}
                    loading={loading || dataLoading}
                    paginationMode="server"
                    rowCount={totalCount}
                    paginationModel={{ page: currentPage, pageSize: pageSize }}
                    onPaginationModelChange={(model) => {
                      setCurrentPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    pageSizeOptions={[10, 20, 50, 100]}
                    sx={{
                      boxShadow: 1,
                      borderRadius: 1,
                      bgcolor: "background.paper",
                      border: 1,
                      borderColor: "divider",
                      "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" },
                      fontSize: "0.75rem",
                    }}
                  />
                ) : chartData.length === 0 ? (
                  <Typography sx={{ p: 2, textAlign: "center" }}>
                    No data available for plotting.
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                      <CanvasJSReact.CanvasJSChart
                        options={chartOptions}
                        containerProps={{
                          style: { width: "100%", height: "100%" },
                        }}
                      />
                    </Box>
                    <Pagination
                      currentPage={currentPage}
                      pageSize={pageSize}
                      totalCount={totalCount}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(0);
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Box>

            {/* Drawer */}
            <Drawer
              anchor="right"
              open={drawerOpen}
              onClose={toggleDrawer(false)}
              sx={{
                width: "40%",
                "& .MuiDrawer-paper": { width: "40%", boxSizing: "border-box" },
              }}
            >
              <Box sx={{ width: "100%", p: 2 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: "1rem",
                    mb: 1.5,
                    color: "#1976d2",
                    fontWeight: 600,
                    borderBottom: "2px solid #1976d2",
                    pb: 0.5,
                  }}
                >
                  Data Selection
                </Typography>

                {/* Tabs */}
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  sx={{
                    mb: 2,
                    "& .MuiTab-root": {
                      fontSize: "0.75rem",
                      minHeight: "40px",
                      textTransform: "none",
                    },
                  }}
                >
                  <Tab label="Filter" value="filter" />
                  <Tab label="Custom Query" value="customQuery" />
                </Tabs>

                <Box
                  sx={{ maxHeight: "calc(100vh - 180px)", overflow: "auto" }}
                >
                  {/* Filter Tab Content */}
                  {activeTab === "filter" && (
                    <FilterDrawerContent
                      loading={loading}
                      tests={tests}
                      testSelections={testSelections}
                      testOptions={testOptions}
                      selectedTestsCount={selectedTestsCount}
                      cards={cards}
                      channels={channels}
                      error={error}
                      onTestSelect={handleTestSelect}
                      onTestToggle={handleTestToggle}
                      onTestAccordionToggle={handleTestAccordionToggle}
                      onConfigAccordionToggle={handleConfigToggle}
                      onChannelSelect={handleChannelSelect}
                      onTimeChange={handleTimeChange}
                      onSubmit={() => handleSubmit(false)}
                      onClear={handleFilterClear}
                    />
                  )}

                  {/* Custom Query Tab Content */}
                  {activeTab === "customQuery" && (
                    <CustomQueryDrawerContent
                      loading={loading}
                      tests={tests}
                      customQueryTests={customQueryTests}
                      testOptions={testOptions}
                      allChannelOptions={allChannelOptions}
                      selectedCustomQueryTestsCount={
                        selectedCustomQueryTestsCount
                      }
                      error={error}
                      onTestSelect={handleCustomQueryTestSelect}
                      onTestToggle={handleCustomQueryTestToggle}
                      onTestAccordionToggle={
                        handleCustomQueryTestAccordionToggle
                      }
                      onConfigAccordionToggle={handleCustomQueryConfigToggle}
                      onTimeChange={handleCustomQueryTimeChange}
                      onChannelSelect={handleCustomQueryChannelSelect}
                      onAddOperator={handleAddOperator}
                      onClearOperators={handleClearOperators}
                      onExpressionChange={handleExpressionChange}
                      onConstantValueChange={handleConstantValueChange}
                      onAddConstant={handleAddConstant}
                      onOutputChannelNameChange={handleOutputChannelNameChange}
                      onSubmit={handleSubmit}
                      onClear={handleCustomQueryClear}
                    />
                  )}
                </Box>
              </Box>
            </Drawer>
          </Box>
        </Container>
      </ThemeProvider>
    </LocalizationProvider>
  );
};

export default HistoricalDataRefactored;
