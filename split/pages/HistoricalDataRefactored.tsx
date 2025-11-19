import React, { useState, useMemo, useEffect } from "react";
import { GridColDef } from "@mui/x-data-grid";
import { ToggleButtonGroup, ToggleButton, Tabs, Tab } from "@mui/material";
import {
  Container,
  Box,
  IconButton,
  Button,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DownloadIcon from "@mui/icons-material/Download";
import { ThemeProvider } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

// Local imports
import { UrlConstant } from "../../component/Util/UrlConstans";
import { muiTheme } from "../theme/muiTheme";
import { exportToCSV } from "../utils/csvExport";
import useHistoricalData from "../hooks/useHistoricalData";
import useTestSelections from "../hooks/useTestSelections";
import DataTable from "../components/DataTable";
import ChartView from "../components/ChartView";
import Pagination from "../components/Pagination";
import FilterDrawer from "../components/drawers/FilterDrawer";
import { SelectedConfig, DataRow } from "../types/historicalData.types";

const HistoricalData: React.FC = () => {
  // State
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"filter" | "customQuery">("filter");
  const [view, setView] = useState<"table" | "plot">("table");
  const [filteredData, setFilteredData] = useState<DataRow[]>([]);
  const [selectedConfigs, setSelectedConfigs] = useState<SelectedConfig[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
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
  } = useHistoricalData(apiBase);

  const {
    testSelections,
    setTestSelections,
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

  // Fetch configs when test is selected
  useEffect(() => {
    const selectedTests = testSelections.filter((sel) => sel.isSelected);
    selectedTests.forEach((sel) => {
      if (!configs[sel.testName]) {
        fetchConfigs(sel.testName).then((configNames) => {
          updateConfigSelections(sel.testName, configNames);
        });
      }
    });
  }, [testSelections]);

  // Handle config accordion toggle with data fetch
  const handleConfigToggle = (testName: string, configName: string) => {
    handleConfigAccordionToggle(testName, configName);
    if (!cards[`${testName}_${configName}`]) {
      fetchTestConfigDetails(testName, configName).then((result) => {
        if (result) {
          updateCardSelections(testName, configName, result.cards, {
            startTime: result.startTime,
            endTime: result.endTime,
          });
        }
      });
    }
  };

  // Load data
  const loadData = async () => {
    if (selectedConfigs.length === 0) return;
    setDataLoading(true);
    try {
      let allData: DataRow[] = [];
      let total = 0;

      for (const sc of selectedConfigs) {
        const { data, totalCount } = await fetchFilteredData(
          currentPage,
          pageSize,
          sc.testName,
          sc.configSelection
        );
        allData = allData.concat(data);
        total += totalCount;
      }

      allData.sort(
        (a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
      );
      setFilteredData(allData);
      setTotalCount(total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, selectedConfigs, pageSize]);

  // Handle submit
  const handleSubmit = () => {
    const selectedConfigsList: SelectedConfig[] = [];
    testSelections.forEach((sel) => {
      if (sel.isSelected) {
        sel.configSelections.forEach((config) => {
          if (
            config.cardSelections.some((card) => card.selectedChannels.length > 0)
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

    if (selectedConfigsList.length === 0) {
      setError("Please select at least one channel");
      return;
    }

    setError(null);
    setSelectedConfigs(selectedConfigsList);
    setCurrentPage(0);
    setDrawerOpen(false);
  };

  // Handle clear
  const handleClear = () => {
    clearAllSelections();
    setFilteredData([]);
    setTotalCount(0);
    setSelectedConfigs([]);
    setCurrentPage(0);
  };

  // Toggle drawer
  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === "keydown" &&
      ((event as React.KeyboardEvent).key === "Tab" ||
        (event as React.KeyboardEvent).key === "Shift")
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  // Generate columns
  const columns: GridColDef[] = useMemo(() => {
    if (filteredData.length === 0) return [];
    const keys = Object.keys(filteredData[0]).filter((key) => key !== "id");
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, " $1").trim(),
      flex: 1,
      sortable: false,
    }));
  }, [filteredData]);

  // Handle CSV export
  const handleExportCSV = () => {
    const testName = selectedConfigs.length > 0 ? selectedConfigs[0].testName : undefined;
    const result = exportToCSV(filteredData, columns, testName);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  // Handle view change
  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: "table" | "plot" | null) => {
    if (newView) {
      setView(newView);
    }
  };

  // Test options for select
  const testOptions = useMemo(
    () => tests.map((test) => ({ value: test.TestName, label: test.TestName })),
    [tests]
  );

  const selectedTestsCount = testSelections.filter((sel) => sel.isSelected).length;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <Container maxWidth={false} disableGutters sx={{ mt: 4 }}>
          <Box sx={{ display: "flex", bgcolor: "background.default", minHeight: "100vh" }}>
            <Box component="main" sx={{ flexGrow: 1, p: 2, overflow: "hidden" }}>
              {/* Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
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
                    color="success"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportCSV}
                    disabled={filteredData.length === 0}
                    sx={{
                      fontSize: "0.75rem",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    Export CSV
                  </Button>
                </Box>

                <IconButton color="inherit" aria-label="open drawer" edge="end" onClick={toggleDrawer(true)}>
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
              {view === "table" ? (
                <DataTable data={filteredData} columns={columns} loading={loading || dataLoading} />
              ) : (
                <ChartView data={filteredData} />
              )}

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </Box>

            {/* Filter Drawer */}
            <FilterDrawer
              open={drawerOpen}
              onClose={toggleDrawer(false)}
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
              onSubmit={handleSubmit}
              onClear={handleClear}
              onFetchTestConfigDetails={fetchTestConfigDetails}
            />
          </Box>
        </Container>
      </ThemeProvider>
    </LocalizationProvider>
  );
};

export default HistoricalData;
