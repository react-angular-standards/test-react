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
  const [resultTab, setResultTab] = useState<"filter" | "customQuery">(
    "filter",
  );
  const [filterView, setFilterView] = useState<"table" | "plot">("table");
  const [customQueryView, setCustomQueryView] = useState<"table" | "plot">(
    "table",
  );

  // Separate data states for filter and custom query
  const [filterData, setFilterData] = useState<DataRow[]>([]);
  const [customQueryData, setCustomQueryData] = useState<DataRow[]>([]);

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

  // Separate pagination for filter and custom query
  const [filterTotalCount, setFilterTotalCount] = useState(0);
  const [filterCurrentPage, setFilterCurrentPage] = useState(0);
  const [filterPageSize, setFilterPageSize] = useState(10);

  const [customQueryTotalCount, setCustomQueryTotalCount] = useState(0);
  const [customQueryCurrentPage, setCustomQueryCurrentPage] = useState(0);
  const [customQueryPageSize, setCustomQueryPageSize] = useState(10);

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

  // Load filter data
  const loadFilterData = async () => {
    if (selectedConfigs.length === 0) return;

    setDataLoading(true);
    try {
      let allData: DataRow[] = [];
      let total = 0;

      for (const sc of selectedConfigs) {
        const { data, totalCount } = await fetchFilteredData(
          filterCurrentPage,
          filterPageSize,
          sc.testName,
          sc.configSelection,
        );
        allData = allData.concat(data);
        total += totalCount;
      }

      // Sort by timestamp
      allData.sort(
        (a, b) =>
          new Date(a.timestamp || a.Timestamp).getTime() -
          new Date(b.timestamp || b.Timestamp).getTime(),
      );

      setFilterData(allData);
      setFilterTotalCount(total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  // Load custom query data
  const loadCustomQueryData = async () => {
    if (selectedCustomQueries.length === 0) return;

    setDataLoading(true);
    try {
      let allData: DataRow[] = [];
      let total = 0;

      for (const cq of selectedCustomQueries) {
        const { data: customData, totalCount: customTotalCount } =
          await fetchCustomQueryData(
            customQueryCurrentPage,
            customQueryPageSize,
            cq.testName,
            cq.configName,
            cq.config,
            cq.pushToDB,
          );
        allData = allData.concat(customData);
        total += customTotalCount;
      }

      // Sort by Timestamp
      allData.sort(
        (a, b) =>
          new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime(),
      );

      setCustomQueryData(allData);
      setCustomQueryTotalCount(total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, [filterCurrentPage, selectedConfigs, filterPageSize]);

  useEffect(() => {
    loadCustomQueryData();
  }, [customQueryCurrentPage, selectedCustomQueries, customQueryPageSize]);

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

    if (
      selectedConfigsList.length === 0 &&
      selectedCustomQueriesList.length === 0
    ) {
      setError(
        "Please select at least one channel in filter or configure a valid custom query",
      );
      return;
    }

    setError(null);

    // Update filter selections and switch to filter result tab
    if (selectedConfigsList.length > 0) {
      setSelectedConfigs(selectedConfigsList);
      setFilterCurrentPage(0);
      setResultTab("filter");
    }

    // Update custom query selections and switch to custom query result tab
    if (selectedCustomQueriesList.length > 0) {
      setSelectedCustomQueries(selectedCustomQueriesList);
      setCustomQueryCurrentPage(0);
      setResultTab("customQuery");
    }

    setDrawerOpen(false);
  };

  // Handle clear for filter
  const handleFilterClear = () => {
    clearAllSelections();
    setFilterData([]);
    setFilterTotalCount(0);
    setSelectedConfigs([]);
    setFilterCurrentPage(0);
    setFilterPageSize(10);
  };

  // Handle clear for custom query
  const handleCustomQueryClear = () => {
    clearAllCustomQuerySelections();
    setCustomQueryData([]);
    setCustomQueryTotalCount(0);
    setSelectedCustomQueries([]);
    setCustomQueryCurrentPage(0);
    setCustomQueryPageSize(10);
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

  // Handle result tab change
  const handleResultTabChange = (
    _: React.SyntheticEvent,
    newValue: "filter" | "customQuery",
  ) => {
    setResultTab(newValue);
  };

  // Generate columns for filter data
  const filterColumns: GridColDef[] = useMemo(() => {
    if (filterData.length === 0) return [];
    const keys = Object.keys(filterData[0]).filter((key) => key !== "id");
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, " $1").trim(),
      flex: 1,
      sortable: false,
    }));
  }, [filterData]);

  // Generate columns for custom query data
  const customQueryColumns: GridColDef[] = useMemo(() => {
    if (customQueryData.length === 0) return [];
    const keys = Object.keys(customQueryData[0]).filter((key) => key !== "id");
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, " $1").trim(),
      flex: 1,
      sortable: false,
    }));
  }, [customQueryData]);

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

  // Filter chart data - handle both lowercase and uppercase field names
  const filterChartData: SeriesData[] = useMemo(() => {
    if (filterData.length === 0) return [];
    // Check which field naming convention is used
    const firstRow = filterData[0];
    const timestampField = "timestamp" in firstRow ? "timestamp" : "Timestamp";
    // For filter data with channel columns like channel_123, we need different logic
    const hasChannelColumn = "Channel" in firstRow || "channel" in firstRow;

    if (hasChannelColumn) {
      const channelField = "Channel" in firstRow ? "Channel" : "channel";
      const valueField = "Value" in firstRow ? "Value" : "value";
      return generateChartData(
        filterData,
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

      const seriesData = channelKeys.map((channelKey) => {
        const channelName = channelKey.replace("channel_", "");
        return {
          type: "line",
          name: `Ch ${channelName}`,
          showInLegend: true,
          visible: true,
          dataPoints: filterData
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

      return seriesData;
    }
  }, [filterData]);

  // Custom query chart data
  const customQueryChartData: SeriesData[] = useMemo(() => {
    return generateChartData(customQueryData, "Timestamp", "Channel", "Value");
  }, [customQueryData]);

  // Chart options factory
  const createChartOptions = (chartData: SeriesData[], title: string) => ({
    animationEnabled: true,
    theme: "light2",
    zoomEnabled: true,
    zoomType: "xy",
    title: {
      fontSize: 20,
      text: title,
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
  });

  const filterChartOptions = useMemo(
    () => createChartOptions(filterChartData, "Filter Data"),
    [filterChartData],
  );

  const customQueryChartOptions = useMemo(
    () => createChartOptions(customQueryChartData, "Custom Query Data"),
    [customQueryChartData],
  );

  // Handle CSV export
  const handleExportCSV = () => {
    const data = resultTab === "filter" ? filterData : customQueryData;
    const columns = resultTab === "filter" ? filterColumns : customQueryColumns;
    const testName =
      selectedConfigs.length > 0 ? selectedConfigs[0].testName : undefined;
    const result = exportToCSV(data, columns, testName);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  // Handle view change for filter
  const handleFilterViewChange = (
    _: React.MouseEvent<HTMLElement>,
    newView: "table" | "plot" | null,
  ) => {
    if (newView) {
      setFilterView(newView);
    }
  };

  // Handle view change for custom query
  const handleCustomQueryViewChange = (
    _: React.MouseEvent<HTMLElement>,
    newView: "table" | "plot" | null,
  ) => {
    if (newView) {
      setCustomQueryView(newView);
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

  // Check if we have data in each tab
  const hasFilterData = filterData.length > 0;
  const hasCustomQueryData = customQueryData.length > 0;

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
                  {/* Result Tabs */}
                  <Tabs
                    value={resultTab}
                    onChange={handleResultTabChange}
                    sx={{
                      minHeight: "36px",
                      "& .MuiTab-root": {
                        fontSize: "0.8rem",
                        minHeight: "36px",
                        textTransform: "none",
                        py: 0,
                      },
                    }}
                  >
                    <Tab
                      label={`Filter ${hasFilterData ? `(${filterData.length})` : ""}`}
                      value="filter"
                    />
                    <Tab
                      label={`Custom Query ${hasCustomQueryData ? `(${customQueryData.length})` : ""}`}
                      value="customQuery"
                    />
                  </Tabs>

                  {/* View Toggle for current tab */}
                  <ToggleButtonGroup
                    value={
                      resultTab === "filter" ? filterView : customQueryView
                    }
                    exclusive
                    onChange={
                      resultTab === "filter"
                        ? handleFilterViewChange
                        : handleCustomQueryViewChange
                    }
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
                    disabled={
                      resultTab === "filter"
                        ? !hasFilterData
                        : !hasCustomQueryData
                    }
                    sx={{
                      fontSize: "0.85rem",
                      textTransform: "none",
                      fontWeight: 600,
                      padding: "6px 16px",
                    }}
                  >
                    Export CSV
                  </Button>
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

              {/* Data View - Filter Tab */}
              {resultTab === "filter" && (
                <Box
                  sx={{
                    height: "calc(100vh - 250px)",
                    minHeight: 600,
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  {!hasFilterData ? (
                    <Box
                      sx={{
                        p: 4,
                        textAlign: "center",
                        bgcolor: "#f5f5f5",
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body1" color="text.secondary">
                        No filter data. Select channels from the Filter tab and
                        click Apply.
                      </Typography>
                    </Box>
                  ) : filterView === "table" ? (
                    <DataGrid
                      rows={filterData}
                      columns={filterColumns}
                      loading={loading || dataLoading}
                      paginationMode="server"
                      rowCount={filterTotalCount}
                      paginationModel={{
                        page: filterCurrentPage,
                        pageSize: filterPageSize,
                      }}
                      onPaginationModelChange={(model) => {
                        setFilterCurrentPage(model.page);
                        setFilterPageSize(model.pageSize);
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
                  ) : filterChartData.length === 0 ? (
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
                          options={filterChartOptions}
                          containerProps={{
                            style: { width: "100%", height: "100%" },
                          }}
                        />
                      </Box>
                      <Pagination
                        currentPage={filterCurrentPage}
                        pageSize={filterPageSize}
                        totalCount={filterTotalCount}
                        onPageChange={setFilterCurrentPage}
                        onPageSizeChange={(size) => {
                          setFilterPageSize(size);
                          setFilterCurrentPage(0);
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {/* Data View - Custom Query Tab */}
              {resultTab === "customQuery" && (
                <Box
                  sx={{
                    height: "calc(100vh - 250px)",
                    minHeight: 600,
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  {!hasCustomQueryData ? (
                    <Box
                      sx={{
                        p: 4,
                        textAlign: "center",
                        bgcolor: "#f5f5f5",
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body1" color="text.secondary">
                        No custom query data. Configure a query from the Custom
                        Query tab and click View or Save & View.
                      </Typography>
                    </Box>
                  ) : customQueryView === "table" ? (
                    <DataGrid
                      rows={customQueryData}
                      columns={customQueryColumns}
                      loading={loading || dataLoading}
                      paginationMode="server"
                      rowCount={customQueryTotalCount}
                      paginationModel={{
                        page: customQueryCurrentPage,
                        pageSize: customQueryPageSize,
                      }}
                      onPaginationModelChange={(model) => {
                        setCustomQueryCurrentPage(model.page);
                        setCustomQueryPageSize(model.pageSize);
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
                  ) : customQueryChartData.length === 0 ? (
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
                          options={customQueryChartOptions}
                          containerProps={{
                            style: { width: "100%", height: "100%" },
                          }}
                        />
                      </Box>
                      <Pagination
                        currentPage={customQueryCurrentPage}
                        pageSize={customQueryPageSize}
                        totalCount={customQueryTotalCount}
                        onPageChange={setCustomQueryCurrentPage}
                        onPageSizeChange={(size) => {
                          setCustomQueryPageSize(size);
                          setCustomQueryCurrentPage(0);
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}
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
