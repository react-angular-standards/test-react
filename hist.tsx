```tsx
/** @format */
// src/pages/HistoricalData.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import {
  Container,
  Box,
  Typography,
  Drawer,
  IconButton,
  Paper,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Switch,
  TextField,
  Button,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { SingleValue, MultiValue, ActionMeta } from 'react-select';
import CustomSelect from '../component/Widgets/CustomSelect';
import { DataRow, Test, FilterRequestBody, TestSelection, SelectOption, ConfigSelection, TestConfigDetailsResponse } from '../types/historicalType';
import CanvasJSReact from '@canvasjs/react-charts';

interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  dataPoints: { x: Date; y: number }[];
}

// Material UI theme
const muiTheme = createTheme({
  components: {
    MuiSelect: {
      styleOverrides: {
        select: { fontSize: '0.75rem', padding: '4px 8px' },
      },
    },
    MuiInputBase: {
      styleOverrides: { root: { fontSize: '0.75rem' } },
    },
    MuiButton: {
      styleOverrides: { root: { fontSize: '0.7rem', padding: '2px 6px', minWidth: '60px' } },
    },
    MuiTypography: {
      styleOverrides: { root: { fontSize: '0.85rem' } },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: '0.7rem' } },
    },
  },
});

const HistoricalData: React.FC = () => {
  // State
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tests, setTests] = useState<Test[]>([]);
  const [configs, setConfigs] = useState<Record<string, string[]>>({});
  const [cards, setCards] = useState<Record<string, string[]>>({});
  const [channels, setChannels] = useState<Record<string, number[]>>({});
  const [filteredData, setFilteredData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSelections, setTestSelections] = useState<TestSelection[]>([]);
  const [selectedTestConfig, setSelectedTestConfig] = useState<{
    testName: string;
    configName: string;
    configSelection: ConfigSelection;
  } | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [localPage, setLocalPage] = useState<number | string>(1);
  const [pageSize, setPageSize] = useState(10);
  const [localPageSize, setLocalPageSize] = useState<string>('10');
  const [view, setView] = useState<'table' | 'plot'>('table');

  // API URLs
  const apiBase = 'https://localhost/api/v1/data';
  const allTestNamesURL = `${apiBase}/all-test-names`;
  const configNamesURL = `${apiBase}/config-names`;
  const testConfigDetailsURL = `${apiBase}/test-config-details`;
  const filterApiURL = `${apiBase}/filter`;

  // Fetch all test names
  useEffect(() => {
    const fetchTestNames = async () => {
      try {
        setLoading(true);
        const response = await fetch(allTestNamesURL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const testNames = data.TestName || [];
        setTests(testNames.map((name: string) => ({ TestName: name })));
        if (testNames.length === 0) setError('No test names received from API');
      } catch (err: any) {
        setError('⚠️ API connection failed. Please check the server.');
      } finally {
        setLoading(false);
      }
    };
    fetchTestNames();
  }, []);

  // Initialize test selections
  useEffect(() => {
    if (tests.length > 0) {
      const initialSelections: TestSelection[] = tests.map((test) => ({
        testName: test.TestName,
        isSelected: false,
        isExpanded: false,
        configSelections: [],
      }));
      setTestSelections(initialSelections);
    }
  }, [tests]);

  // Fetch configs when a test is selected
  useEffect(() => {
    const selected = testSelections.find((sel) => sel.isSelected);
    if (selected && !configs[selected.testName]) {
      fetchConfigs(selected.testName);
    }
  }, [testSelections, configs]);

  const fetchConfigs = async (testName: string) => {
    try {
      const response = await fetch(configNamesURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TestName: testName }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const configNames = data.ConfigName || [];
      setConfigs((prev) => ({ ...prev, [testName]: configNames }));
      setTestSelections((prev) =>
        prev.map((sel) =>
          sel.testName === testName
            ? {
                ...sel,
                configSelections: configNames.map((config: string) => ({
                  configName: config,
                  isExpanded: false,
                  cardSelections: [],
                  startTime: null,
                  endTime: null,
                })),
              }
            : sel
        )
      );
    } catch (err: any) {
      setError(`Failed to fetch configurations for test ${testName}.`);
    }
  };

  // Fetch test config details (cards and channels) when config is expanded
  const fetchTestConfigDetails = async (testName: string, configName: string) => {
    const key = `${testName}_${configName}`;
    if (!cards[key]) {
      try {
        const response = await fetch(`${testConfigDetailsURL}?TestName=${encodeURIComponent(testName)}&ConfigName=${encodeURIComponent(configName)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data: TestConfigDetailsResponse = await response.json();
        const cardList = data.details.map((detail) => detail.cardType);
        setCards((prev) => ({ ...prev, [key]: cardList }));
        const channelsMap: Record<string, number[]> = {};
        data.details.forEach((detail) => {
          channelsMap[`${testName}_${configName}_${detail.cardType}`] = detail.channels;
        });
        setChannels((prev) => ({ ...prev, ...channelsMap }));
        setTestSelections((prev) =>
          prev.map((sel) =>
            sel.testName === testName
              ? {
                  ...sel,
                  configSelections: sel.configSelections.map((config: ConfigSelection) =>
                    config.configName === configName
                      ? {
                          ...config,
                          cardSelections: cardList.map((c: string) => ({ cardName: c, selectedChannels: [] })),
                          startTime: data.testStartTime ? dayjs(data.testStartTime) : null,
                          endTime: data.testEndTime ? dayjs(data.testEndTime) : null,
                        }
                      : config
                  ),
                }
              : sel
          )
        );
      } catch (err: any) {
        setError(`Failed to fetch test config details for ${testName} - ${configName}.`);
      }
    }
  };

  const handleTestSelect = (
    selected: SingleValue<SelectOption> | MultiValue<SelectOption>,
    action: ActionMeta<SelectOption>
  ) => {
    const selectedTestName = (selected as SingleValue<SelectOption>)?.value;
    if (selectedTestName) {
      setTestSelections((prev) =>
        prev.map((selection) => ({
          ...selection,
          isSelected: selection.testName === selectedTestName,
          isExpanded: selection.testName === selectedTestName,
        }))
      );
    }
  };

  const handleTestToggle = (testName: string) => {
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? {
              ...selection,
              isSelected: !selection.isSelected,
              isExpanded: !selection.isSelected,
            }
          : { ...selection, isSelected: false, isExpanded: false }
      )
    );
  };

  const handleTestAccordionToggle = (testName: string) => {
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName ? { ...selection, isExpanded: !selection.isExpanded } : selection
      )
    );
  };

  const handleConfigAccordionToggle = (testName: string, configName: string) => {
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: sel.configSelections.map((config: ConfigSelection) =>
                config.configName === configName ? { ...config, isExpanded: !config.isExpanded } : config
              ),
            }
          : sel
      )
    );
    if (!cards[`${testName}_${configName}`]) {
      fetchTestConfigDetails(testName, configName);
    }
  };

  const handleChannelSelect = (
    testName: string,
    configName: string,
    cardName: string,
    selected: MultiValue<SelectOption>,
    action: ActionMeta<SelectOption>
  ) => {
    const selectedChannels = selected ? selected.map((option) => Number(option.value)) : [];
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: sel.configSelections.map((config: ConfigSelection) =>
                config.configName === configName
                  ? {
                      ...config,
                      cardSelections: config.cardSelections.map((cardSel: CardSelection) =>
                        cardSel.cardName === cardName ? { ...cardSel, selectedChannels } : cardSel
                      ),
                    }
                  : config
              ),
            }
          : sel
      )
    );
  };

  const handleTimeChange = (
    testName: string,
    configName: string,
    field: 'startTime' | 'endTime',
    value: Dayjs | null
  ) => {
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: sel.configSelections.map((config: ConfigSelection) =>
                config.configName === configName ? { ...config, [field]: value } : config
              ),
            }
          : sel
      )
    );
  };

  const clearAllSelections = () => {
    setTestSelections((prev) =>
      prev.map((selection) => ({
        ...selection,
        isSelected: false,
        isExpanded: false,
        configSelections: selection.configSelections.map((config: ConfigSelection) => ({
          ...config,
          isExpanded: false,
          cardSelections: [],
          startTime: null,
          endTime: null,
        })),
      }))
    );
    setFilteredData([]);
    setTotalCount(0);
    setSelectedTestConfig(null);
    setCurrentPage(0);
    setLocalPage(1);
    setPageSize(10);
    setLocalPageSize('10');
    setError(null);
  };

  const fetchFilteredData = async (
    page: number,
    pageSize: number,
    testName: string,
    configSelection: ConfigSelection
  ) => {
    const offset = page * pageSize;
    const requestBody: FilterRequestBody = {
      TestName: testName,
      ConfigName: configSelection.configName,
      details: configSelection.cardSelections
        .filter((cardSel: CardSelection) => cardSel.selectedChannels.length > 0)
        .map((cardSel: CardSelection) => ({
          cardType: cardSel.cardName,
          channels: cardSel.selectedChannels,
        })),
      limit: pageSize,
      offset,
      startTime: configSelection.startTime?.toISOString(),
      endTime: configSelection.endTime?.toISOString(),
    };
    if (requestBody.details.length === 0) {
      const key = `${testName}_${configSelection.configName}`;
      const cardList = cards[key] || [];
      requestBody.details = cardList.map((card: string) => ({
        cardType: card,
        channels: channels[`${testName}_${configSelection.configName}_${card}`] || [],
      }));
    }
    try {
      const response = await fetch(filterApiURL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const data = (result.data || []).map((row: DataRow, index: number) => ({
        ...row,
        id: offset + index,
      }));
      return { data, totalCount: result.totalCount || 0 };
    } catch (err: any) {
      throw new Error(`Failed to fetch data for ${testName} - ${configSelection.configName}.`);
    }
  };

  const loadData = async (resetData: boolean = false) => {
    if (!selectedTestConfig) return;
    setDataLoading(true);
    try {
      const { data, totalCount } = await fetchFilteredData(
        resetData ? 0 : currentPage, // Always start from page 0 when resetting
        pageSize,
        selectedTestConfig.testName,
        selectedTestConfig.configSelection
      );
      setFilteredData(data); // Always replace data for proper pagination
      setTotalCount(totalCount);
      if (resetData) {
        setCurrentPage(0); // Reset to first page when data is reset
        setLocalPage(1);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  // Track channel selections to detect changes
  const currentChannelSelections = useMemo(() => {
    if (!selectedTestConfig) return '';
    return selectedTestConfig.configSelection.cardSelections
      .map(cardSel => `${cardSel.cardName}:${cardSel.selectedChannels.sort().join(',')}`)
      .sort()
      .join('|');
  }, [selectedTestConfig]);

  useEffect(() => {
    if (selectedTestConfig) {
      loadData(true); // Reset data when config/pageSize/channels change
    }
  }, [selectedTestConfig, pageSize, currentChannelSelections]);

  useEffect(() => {
    if (selectedTestConfig && currentPage >= 0) {
      loadData(false); // Load data for current page
    }
  }, [currentPage]);

  const handleSubmit = async () => {
    const selectedTest = testSelections.find((sel) => sel.isSelected);
    if (!selectedTest) {
      setError('Please select one test');
      return;
    }
    const selectedConfig = selectedTest.configSelections.find((config: ConfigSelection) =>
      config.cardSelections.some((card: CardSelection) => card.selectedChannels.length > 0)
    );
    if (!selectedConfig) {
      setError('Please select at least one channel in a configuration');
      return;
    }
    setError(null);
    setCurrentPage(0);
    setFilteredData([]); // Clear existing data
    setSelectedTestConfig({
      testName: selectedTest.testName,
      configName: selectedConfig.configName,
      configSelection: selectedConfig,
    });
    setDrawerOpen(false);
  };

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' || (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };

  const columns: GridColDef[] = useMemo(() => {
    if (filteredData.length === 0) return [];
    const keys = Object.keys(filteredData[0]).filter((key) => key !== 'id');
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, ' $1').trim(),
      flex: 1,
      sortable: false,
    }));
  }, [filteredData]);

  const chartData: SeriesData[] = useMemo(() => {
    if (filteredData.length === 0 || !selectedTestConfig) {
      return [];
    }
    const selectedChannels = selectedTestConfig.configSelection.cardSelections.flatMap(
      (cardSel: CardSelection) => cardSel.selectedChannels
    );
    let channelsToPlot = Array.from(new Set(selectedChannels));
    if (channelsToPlot.length === 0) {
      channelsToPlot = Array.from(
        new Set(filteredData.map((row: DataRow) => Number(row.Channel)).filter((id: number) => !isNaN(id)))
      );
    }
    const dataByChannel: { [key: number]: DataRow[] } = {};
    filteredData.forEach((row: DataRow) => {
      const ch = Number(row.Channel);
      if (!isNaN(ch) && channelsToPlot.includes(ch)) {
        if (!dataByChannel[ch]) {
          dataByChannel[ch] = [];
        }
        dataByChannel[ch].push(row);
      }
    });
    const seriesData = channelsToPlot.map((channel) => ({
      type: 'line',
      name: `Ch ${channel}`,
      showInLegend: true,
      visible: true,
      dataPoints: (dataByChannel[channel] || [])
        .filter((row: DataRow) => row.Timestamp && !isNaN(Number(row.Value)))
        .map((row: DataRow) => ({
          x: new Date(row.Timestamp),
          y: Number(row.Value),
        })),
    }));
    return seriesData;
  }, [filteredData, selectedTestConfig]);

  const chartOptions = useMemo(
    () => ({
      animationEnabled: true,
      theme: 'light2',
      title: {
        text: selectedTestConfig
          ? `${selectedTestConfig.testName} - ${selectedTestConfig.configName} Data`
          : 'Historical Data',
      },
      axisX: {
        title: 'Time',
        valueFormatString: 'YYYY-MM-DD HH:mm:ss',
        labelAngle: -45,
      },
      axisY: {
        title: 'Value',
      },
      legend: {
        cursor: 'pointer',
        itemclick: (e: any) => {
          if (typeof e.dataSeries.visible === 'undefined' || e.dataSeries.visible) {
            e.dataSeries.visible = false;
          } else {
            e.dataSeries.visible = true;
          }
          e.chart.render();
        },
      },
      data: chartData,
    }),
    [chartData, selectedTestConfig]
  );

  const testOptions = useMemo(
    () =>
      tests.map((test) => ({
        value: test.TestName,
        label: test.TestName,
      })),
    [tests]
  );

  const selectedTestsCount = testSelections.filter((sel) => sel.isSelected).length;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    setLocalPage(currentPage + 1);
  }, [currentPage]);

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLocalPage(value ? Number(value) : '');
  };

  const handlePageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      let newPage = typeof localPage === 'number' ? localPage - 1 : 0;
      const maxPage = Math.max(0, totalPages - 1);
      if (newPage < 0) newPage = 0;
      if (newPage > maxPage) newPage = maxPage;
      if (!isNaN(newPage)) {
        setCurrentPage(newPage);
      }
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage(Math.max(0, currentPage - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
  };

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: 'table' | 'plot' | null) => {
    if (newView) {
      setView(newView);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <Container maxWidth={false} disableGutters sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
            <Box component='main' sx={{ flexGrow: 1, p: 2, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={handleViewChange}
                  aria-label='view switch'
                  sx={{
                    backgroundColor: '#f0f0f0',
                    borderRadius: '6px',
                    p: '2px',
                    '& .MuiToggleButton-root': {
                      border: 'none',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      color: '#333',
                      '&.Mui-selected': {
                        backgroundColor: '#1565c0',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: '#1565c0',
                        },
                      },
                      '&:hover': {
                        backgroundColor: '#e0e0e0',
                      },
                    },
                  }}
                >
                  <ToggleButton value='table' aria-label='table view'>
                    Table
                  </ToggleButton>
                  <ToggleButton value='plot' aria-label='plot view'>
                    Plot
                  </ToggleButton>
                </ToggleButtonGroup>
                <IconButton color='inherit' aria-label='open drawer' edge='end' onClick={toggleDrawer(true)}>
                  <MenuIcon />
                </IconButton>
              </Box>
              {error && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1,
                    bgcolor: error.includes('API') ? '#fff3cd' : '#ffebee',
                    borderRadius: 1,
                    border: `1px solid ${error.includes('API') ? '#ffeaa7' : '#ffcdd2'}`,
                  }}
                >
                  <Typography
                    color={error.includes('API') ? 'warning.main' : 'error'}
                    variant='body2'
                    sx={{ fontWeight: 500, fontSize: '0.75rem' }}
                  >
                    {error}
                  </Typography>
                </Box>
              )}
              <Box sx={{ height: 500, width: '100%', overflow: 'hidden' }}>
                {view === 'table' ? (
                  <DataGrid
                    rows={filteredData}
                    columns={columns}
                    loading={loading || dataLoading}
                    hideFooter={true}
                    sx={{
                      boxShadow: 1,
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      '& .MuiDataGrid-columnHeaders': { bgcolor: '#f5f5f5' },
                      fontSize: '0.75rem',
                    }}
                  />
                ) : chartData.length === 0 ? (
                  <Typography sx={{ p: 2, textAlign: 'center' }}>
                    No data available for plotting. Please select channels and apply.
                  </Typography>
                ) : (
                  <CanvasJSReact.CanvasJSChart
                    options={chartOptions}
                    containerProps={{ style: { width: '100%', height: '500px' } }}
                  />
                )}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 1,
                  mt: 2,
                }}
              >
                <Typography variant='body2'>Rows per page:</Typography>
                <Autocomplete
                  freeSolo
                  disableClearable
                  options={[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                  getOptionLabel={(option) => option.toString()}
                  value={pageSize}
                  onChange={(event, newValue) => {
                    let num = typeof newValue === 'string' ? parseInt(newValue, 10) : newValue;
                    if (isNaN(num) || num <= 0) num = 10;
                    setPageSize(num);
                    setCurrentPage(0);
                  }}
                  inputValue={localPageSize}
                  onInputChange={(event, newInputValue) => {
                    setLocalPageSize(newInputValue);
                  }}
                  renderInput={(params) => <TextField {...params} size='small' sx={{ width: 100 }} />}
                />
                <IconButton onClick={handlePreviousPage} disabled={currentPage === 0}>
                  <ArrowBackIcon />
                </IconButton>
                <TextField
                  size='small'
                  type='number'
                  value={localPage}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageKeyDown}
                  sx={{ width: 70 }
                  inputProps={{ min: 1, max: totalPages }}
                />
                <Typography variant='body2'>/ {totalPages || 1}</Typography>
                <IconButton onClick={handleNextPage} disabled={currentPage >= totalPages - 1 || totalPages === 0}>
                  <ArrowForwardIcon />
                </IconButton>
              </Box>
            </Box>
            <Drawer
              anchor='right'
              open={drawerOpen}
              onClose={toggleDrawer(false)}
              sx={{
                width: '40%',
                '& .MuiDrawer-paper': { width: '40%', boxSizing: 'border-box' },
              }}
            >
              <Box sx={{ width: '100%', p: 2 }}>
                <Typography
                  variant='h6'
                  sx={{
                    fontSize: '1rem',
                    mb: 1.5,
                    color: '#1976d2',
                    fontWeight: 600,
                    borderBottom: '2px solid #1976d2',
                    pb: 0.5,
                  }}
                >
                  Test Selection & Filtering
                </Typography>
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant='body2' sx={{ color: '#666', fontSize: '0.75rem' }}>
                    Select a test, configure channels, and set time ranges
                  </Typography>
                  {selectedTestsCount > 0 && (
                    <Chip label={`1 test selected`} color='primary' size='small' sx={{ mt: 1 }} />
                  )}
                </Box>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ ml: 1, fontSize: '0.75rem' }}>Loading test data...</Typography>
                  </Box>
                ) : tests.length > 0 ? (
                  <Box sx={{ mb: 2, maxHeight: '70vh', overflow: 'auto' }}>
                    <Typography variant='subtitle2' sx={{ mb: 1, fontWeight: 600, fontSize: '0.85rem' }}>
                      Select Test
                    </Typography>
                    <CustomSelect
                      isMulti={false}
                      options={testOptions}
                      value={
                        testOptions.find((option) =>
                          testSelections.some((sel) => sel.testName === option.value && sel.isSelected)
                        ) || null
                      }
                      onChange={handleTestSelect}
                      placeholder='Search and select a test...'
                    />
                    <Box sx={{ mt: 2 }}>
                      {testSelections
                        .filter((sel) => sel.isSelected)
                        .map((selection) => (
                          <Accordion
                            key={selection.testName}
                            expanded={selection.isExpanded}
                            onChange={() => handleTestAccordionToggle(selection.testName)}
                            sx={{
                              mb: 1,
                              border: '1px solid #e0e0e0',
                              borderRadius: '6px !important',
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              sx={{
                                bgcolor: selection.isSelected ? '#e3f2fd' : '#f8f9fa',
                                borderRadius: '6px',
                                '&.Mui-expanded': { borderRadius: '6px 6px 0 0' },
                                minHeight: '40px',
                                '& .MuiAccordionSummary-content': { my: 0.5 },
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  width: '100%',
                                }}
                              >
                                <Switch
                                  checked={selection.isSelected}
                                  onChange={() => handleTestToggle(selection.testName)}
                                  onClick={(e) => e.stopPropagation()}
                                  size='small'
                                  color='primary'
                                />
                                <Box sx={{ flexGrow: 1, ml: 1 }}>
                                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                    {selection.testName}
                                  </Typography>
                                </Box>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 1, pb: 1.5 }}>
                              {selection.configSelections.map((config: ConfigSelection) => (
                                <Accordion
                                  key={config.configName}
                                  expanded={config.isExpanded}
                                  onChange={() => handleConfigAccordionToggle(selection.testName, config.configName)}
                                  sx={{
                                    mb: 1,
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '4px !important',
                                    ml: 2,
                                  }}
                                >
                                  <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{
                                      bgcolor: config.isExpanded ? '#e8f4f8' : '#fafafa',
                                      borderRadius: '4px',
                                      '&.Mui-expanded': { borderRadius: '4px 4px 0 0' },
                                      minHeight: '36px',
                                      '& .MuiAccordionSummary-content': { my: 0.5 },
                                    }}
                                  >
                                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                      {config.configName}
                                    </Typography>
                                  </AccordionSummary>
                                  <AccordionDetails sx={{ pt: 1, pb: 1.5 }}>
                                    <Box sx={{ mb: 1.5 }}>
                                      <Typography
                                        variant='subtitle2'
                                        sx={{
                                          mb: 0.5,
                                          display: 'flex',
                                          alignItems: 'center',
                                          fontSize: '0.85rem',
                                        }}
                                      >
                                        <AccessTimeIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
                                        Time Range
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, mb: 1 }}>
                                        <DateTimePicker<Dayjs>
                                          label='Start Time'
                                          value={config.startTime}
                                          onChange={(value) =>
                                            handleTimeChange(selection.testName, config.configName, 'startTime', value)
                                          }
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              size='small'
                                              fullWidth
                                              InputProps={{
                                                ...params.InputProps,
                                                sx: { fontSize: '0.75rem' },
                                              }}
                                            />
                                          )}
                                          views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                                          ampm={false}
                                        />
                                        <DateTimePicker<Dayjs>
                                          label='End Time'
                                          value={config.endTime}
                                          onChange={(value) =>
                                            handleTimeChange(selection.testName, config.configName, 'endTime', value)
                                          }
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              size='small'
                                              fullWidth
                                              InputProps={{
                                                ...params.InputProps,
                                                sx: { fontSize: '0.75rem' },
                                              }}
                                            />
                                          )}
                                          views={['year', 'month', 'day', 'hours', 'minutes', 'seconds']}
                                          ampm={false}
                                        />
                                      </Box>
                                      <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                          label='Start ms'
                                          type='number'
                                          size='small'
                                          fullWidth
                                          value={config.startTime?.millisecond() ?? 0}
                                          onChange={(e) => {
                                            const ms = parseInt(e.target.value, 10);
                                            if (!isNaN(ms)) {
                                              const newTime = config.startTime?.millisecond(ms) || null;
                                              handleTimeChange(selection.testName, config.configName, 'startTime', newTime);
                                            }
                                          }}
                                          inputProps={{ min: 0, max: 999, step: 1 }}
                                          helperText='0-999 ms'
                                          sx={{
                                            '& .MuiFormHelperText-root': {
                                              fontSize: '0.65rem',
                                            },
                                          }}
                                        />
                                        <TextField
                                          label='End ms'
                                          type='number'
                                          size='small'
                                          fullWidth
                                          value={config.endTime?.millisecond() ?? 0}
                                          onChange={(e) => {
                                            const ms = parseInt(e.target.value, 10);
                                            if (!isNaN(ms)) {
                                              const newTime = config.endTime?.millisecond(ms) || null;
                                              handleTimeChange(selection.testName, config.configName, 'endTime', newTime);
                                            }
                                          }}
                                          inputProps={{ min: 0, max: 999, step: 1 }}
                                          helperText='0-999 ms'
                                          sx={{
                                            '& .MuiFormHelperText-root': {
                                              fontSize: '0.65rem',
                                            },
                                          }}
                                        />
                                      </Box>
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box>
                                      <Typography
                                        variant='subtitle2'
                                        sx={{ mb: 1, fontWeight: 600, fontSize: '0.85rem' }}
                                      >
                                        Card Types & Channels
                                      </Typography>
                                      {config.cardSelections.map((cardSel: CardSelection) => {
                                        const channelOptions = (
                                          channels[`${selection.testName}_${config.configName}_${cardSel.cardName}`] || []
                                        ).map((channel) => ({
                                          value: channel.toString(),
                                          label: `Ch: ${channel}`,
                                        }));
                                        return (
                                          <Paper
                                            key={cardSel.cardName}
                                            sx={{
                                              mb: 1,
                                              border: '1px solid #e0e0e0',
                                              borderRadius: 1,
                                            }}
                                          >
                                            <Box sx={{ p: 0.75, bgcolor: '#f8f9fa' }}>
                                              <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                                {cardSel.cardName}
                                              </Typography>
                                              <CustomSelect
                                                isMulti={true}
                                                options={channelOptions}
                                                value={channelOptions.filter((option) =>
                                                  cardSel.selectedChannels.includes(Number(option.value))
                                                )}
                                                onChange={(selected, action) =>
                                                  handleChannelSelect(
                                                    selection.testName,
                                                    config.configName,
                                                    cardSel.cardName,
                                                    selected as MultiValue<SelectOption>,
                                                    action
                                                  )
                                                }
                                                placeholder='Select channels...'
                                              />
                                            </Box>
                                          </Paper>
                                        );
                                      })}
                                    </Box>
                                  </AccordionDetails>
                                </Accordion>
                              ))}
                            </AccordionDetails>
                          </Accordion>
                        ))}
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: '#fff3cd',
                      borderRadius: 1,
                      border: `1px solid #ffeaa7`,
                    }}
                  >
                    <Typography color='warning.main' sx={{ mb: 1, fontSize: '0.85rem' }}>
                      No tests available.
                    </Typography>
                    <Typography variant='body2' color='text.secondary' sx={{ fontSize: '0.75rem' }}>
                      {error || 'Please check the API connection or try again later.'}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    variant='contained'
                    color='primary'
                    onClick={handleSubmit}
                    disabled={loading || tests.length === 0 || selectedTestsCount === 0}
                    sx={{ minWidth: 80, fontWeight: 600, textTransform: 'none' }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={clearAllSelections}
                    disabled={loading || selectedTestsCount === 0}
                    sx={{ minWidth: 80, textTransform: 'none' }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
            </Drawer>
          </Box>
        </Container>
      </ThemeProvider>
    </LocalizationProvider>
  );
};

export default HistoricalData;
```
