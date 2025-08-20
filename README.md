/** @format */
import React, { useState, useMemo, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
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
  Select,
  MenuItem,
  FormControlLabel,
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
import { CanvasJSChart } from 'canvasjs-react-charts';
import CustomSelect from '../component/Widgets/CustomSelect';
import {
  DataRow,
  TestDetail,
  Test,
  FilterRequestBody,
  CardSelection,
  TestSelection,
  SelectOption,
} from '../types/HIstoricalType';
import { SingleValue, MultiValue, ActionMeta } from 'react-select';

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

// Placeholder interface for SeriesData
interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  dataPoints: { x: Date; y: number }[];
}

// Interface for CustomChannel
interface CustomChannel {
  name: string;
  channel1: number;
  operation: '+' | '-' | '*' | '/';
  channel2?: number;
  constant?: number;
}

// Update TestSelection to include customChannels
interface ExtendedTestSelection extends TestSelection {
  customChannels: CustomChannel[];
}

const HistoricalData: React.FC = () => {
  // State
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tests, setTests] = useState<Test[]>([]);
  const [filteredData, setFilteredData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSelections, setTestSelections] = useState<ExtendedTestSelection[]>([]);
  const [selectedSelection, setSelectedSelection] = useState<ExtendedTestSelection | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [localPage, setLocalPage] = useState<number | string>(1);
  const [pageSize, setPageSize] = useState(10);
  const [localPageSize, setLocalPageSize] = useState<string>('10');
  const [view, setView] = useState<'table' | 'plot'>('table');
  const [newCustomName, setNewCustomName] = useState('');
  const [newChannel1, setNewChannel1] = useState<SingleValue<SelectOption>>(null);
  const [newOperation, setNewOperation] = useState< '+' | '-' | '*' | '/' >('*');
  const [newChannel2, setNewChannel2] = useState<SingleValue<SelectOption>>(null);
  const [newConstant, setNewConstant] = useState('');
  const [useConstant, setUseConstant] = useState(false);

  // API URLs
  const apiURL = 'https://localhost/api/v1/data/all-tests';
  const filterApiURL = 'https://localhost/api/v1/data/filter';

  // Fetch all tests
  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        const response = await fetch(apiURL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const normalizedData = Array.isArray(data) ? data : [data];
        const validData = normalizedData.filter(
          (item): item is Test =>
            item &&
            typeof item.TestName === 'string' &&
            item.ConfigName &&
            item.testStartTime &&
            item.testEndTime &&
            Array.isArray(item.Details),
        );
        setTests(validData);
        if (validData.length === 0) setError('No valid test data received from API');
      } catch (err: any) {
        setError('⚠️ API connection failed. Please check the server.');
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, []);

  // Initialize test selections
  useEffect(() => {
    if (tests.length > 0) {
      const initialSelections: ExtendedTestSelection[] = tests.map((test) => ({
        testName: test.TestName,
        isSelected: false,
        isExpanded: false,
        cardSelections: test.Details.map((detail) => ({
          cardName: detail.Card,
          selectedChannels: [],
        })),
        startTime: dayjs(test.testStartTime),
        endTime: dayjs(test.testEndTime),
        customChannels: [],
      }));
      setTestSelections(initialSelections);
    }
  }, [tests]);

  // Handle test selection
  const handleTestSelect = (
    selectedOption: SingleValue<SelectOption> | MultiValue<SelectOption>,
    _action: ActionMeta<SelectOption>,
  ) => {
    let selectedTestName: string | undefined;
    if (Array.isArray(selectedOption)) {
      selectedTestName = selectedOption.map((option) => option.value).join(', ');
    } else {
      selectedTestName = selectedOption?.value;
    }
    if (selectedTestName !== undefined) {
      setTestSelections((prev) =>
        prev.map((selection) => ({
          ...selection,
          isSelected: selection.testName === selectedTestName,
          isExpanded: selection.testName === selectedTestName,
        })),
      );
    }
  };

  // Handle test toggle (via switch)
  const handleTestToggle = (testName: string) => {
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? {
              ...selection,
              isSelected: !selection.isSelected,
              isExpanded: !selection.isSelected,
            }
          : { ...selection, isSelected: false, isExpanded: false },
      ),
    );
  };

  // Handle accordion expand/collapse
  const handleAccordionToggle = (testName: string) => {
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? { ...selection, isExpanded: !selection.isExpanded }
          : selection,
      ),
    );
  };

  // Handle channel selection
  const handleChannelSelect = (
    testName: string,
    cardName: string,
    selectedOptions: MultiValue<SelectOption>,
    action: ActionMeta<SelectOption>,
  ) => {
    const selectedChannels = selectedOptions
      ? selectedOptions.map((option) => Number(option.value))
      : [];
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? {
              ...selection,
              isSelected: selectedChannels.length > 0 || selection.isSelected,
              cardSelections: selection.cardSelections.map((cardSel) =>
                cardSel.cardName === cardName ? { ...cardSel, selectedChannels } : cardSel,
              ),
            }
          : selection,
      ),
    );
  };

  // Handle time change
  const handleTimeChange = (
    testName: string,
    field: 'startTime' | 'endTime',
    value: Dayjs | null,
  ) => {
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName ? { ...selection, [field]: value } : selection,
      ),
    );
  };

  // Clear all selections
  const clearAllSelections = () => {
    setTestSelections((prev) =>
      prev.map((selection) => ({
        ...selection,
        isSelected: false,
        isExpanded: false,
        cardSelections: selection.cardSelections.map((cardSel) => ({
          ...cardSel,
          selectedChannels: [],
        })),
        customChannels: [],
      })),
    );
    setFilteredData([]);
    setTotalCount(0);
    setSelectedSelection(null);
    setCurrentPage(0);
    setNewCustomName('');
    setNewChannel1(null);
    setNewOperation('*');
    setNewChannel2(null);
    setNewConstant('');
    setUseConstant(false);
  };

  // Fetch data with pagination
  const fetchFilteredData = async (
    page: number,
    pageSize: number,
    selection: ExtendedTestSelection,
  ) => {
    const test = tests.find((t) => t.TestName === selection.testName);
    if (!test) return { data: [], totalCount: 0 };
    const offset = page * pageSize + 1;
    const requestBody: FilterRequestBody = {
      TestName: test.TestName,
      ConfigName: test.ConfigName,
      startTime: selection.startTime?.toISOString() || test.testStartTime,
      endTime: selection.endTime?.toISOString() || test.testEndTime,
      details: selection.cardSelections
        .filter((cardSel) => cardSel.selectedChannels.length > 0)
        .map((cardSel) => ({
          cardType: cardSel.cardName,
          channels: cardSel.selectedChannels,
        })),
      limit: pageSize,
      offset: offset,
    };
    if (requestBody.details.length === 0) {
      requestBody.details = test.Details.map((detail) => ({
        cardType: detail.Card,
        channels: detail.Channel,
      }));
    }
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
    const data = (result.data || []).map((row: any, index: number) => ({
      ...row,
      id: offset + index,
    }));
    console.log('API response data:', data);
    return { data, totalCount: result.totalCount || 0 };
  };

  const loadData = async () => {
    if (!selectedSelection) return;
    setDataLoading(true);
    try {
      const { data, totalCount } = await fetchFilteredData(
        currentPage,
        pageSize,
        selectedSelection,
      );
      setFilteredData(data);
      setTotalCount(totalCount);
    } catch (err: any) {
      setError('⚠️ Failed to fetch data.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, selectedSelection, pageSize]);

  // Handle submit - Initial data fetch
  const handleSubmit = async () => {
    const selected = testSelections.find((sel) => sel.isSelected);
    if (!selected) {
      setError('Please select one test');
      return;
    }
    setError(null);
    setCurrentPage(0);
    setSelectedSelection(selected);
    setDrawerOpen(false);
  };

  const handleAddCustom = () => {
    const selected = testSelections.find((sel) => sel.isSelected);
    if (!selected || !newCustomName || !newChannel1 || (!newChannel2 && !useConstant) || (useConstant && !newConstant)) {
      setError('Please fill all fields for custom channel');
      return;
    }
    const custom: CustomChannel = {
      name: newCustomName,
      channel1: Number(newChannel1.value),
      operation: newOperation,
    };
    if (useConstant) {
      custom.constant = parseFloat(newConstant);
    } else if (newChannel2) {
      custom.channel2 = Number(newChannel2.value);
    }
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === selected.testName
          ? { ...sel, customChannels: [...sel.customChannels, custom] }
          : sel
      )
    );
    setNewCustomName('');
    setNewChannel1(null);
    setNewOperation('*');
    setNewChannel2(null);
    setNewConstant('');
    setUseConstant(false);
  };

  const toggleDrawer =
    (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event.type === 'keydown' &&
        ((event as React.KeyboardEvent).key === 'Tab' ||
          (event as React.KeyboardEvent).key === 'Shift')
      ) {
        return;
      }
      setDrawerOpen(open);
    };

  // Generate dynamic columns from data
  const columns = useMemo(() => {
    if (filteredData.length === 0) return [];
    const keys = Object.keys(filteredData[0]).filter((key) => key !== 'id');
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, ' $1').trim(),
      flex: 1,
      sortable: false,
    }));
  }, [filteredData]);

  // Generate chart data for CanvasJS
  const chartData = useMemo(() => {
    if (filteredData.length === 0 || !selectedSelection) {
      console.log('No filteredData or selectedSelection');
      return [];
    }
    console.log('filteredData:', filteredData);
    console.log('selectedSelection:', selectedSelection);
    const selectedChannels = selectedSelection.cardSelections.flatMap(
      (cardSel) => cardSel.selectedChannels,
    );
    console.log('selectedChannels:', selectedChannels);
    // Adjusted Case 1: DataRow has Channel and Value
    let channelsToPlot = [...new Set(selectedChannels)];
    if (channelsToPlot.length === 0) {
      channelsToPlot = [
        ...new Set(
          filteredData
            .map((row: any) => Number(row.Channel))
            .filter((id: any) => !isNaN(id)),
        ),
      ];
    }
    const dataByChannel: { [key: number]: any[] } = {};
    filteredData.forEach((row: any) => {
      const ch = Number(row.Channel);
      if (!isNaN(ch) && channelsToPlot.includes(ch)) {
        if (!dataByChannel[ch]) {
          dataByChannel[ch] = [];
        }
        dataByChannel[ch].push(row);
      }
    });
    console.log('dataByChannel:', dataByChannel);
    const seriesData = channelsToPlot.map((channel) => ({
      type: 'line',
      name: `Ch ${channel}`,
      showInLegend: true,
      visible: true,
      dataPoints: (dataByChannel[channel] || [])
        .filter((row) => {
          const valid = row.Timestamp && !isNaN(Number(row.Value));
          if (!valid) console.log('Invalid row:', row);
          return valid;
        })
        .map((row) => ({
          x: new Date(row.Timestamp),
          y: Number(row.Value),
        })),
    }));
    console.log('seriesData (Case 1):', seriesData);
    // Return if valid data found
    if (seriesData.some((series) => series.dataPoints.length > 0)) {
      return seriesData;
    }
    // Case 2: DataRow has channel-specific fields (e.g., channel_1, channel_2)
    const channelFields = selectedChannels.length > 0
      ? selectedChannels.map((channel) => `channel_${channel}`)
      : columns
        .filter(
          (col) =>
            col.field !== 'Timestamp' &&
            filteredData[0] &&
            !isNaN(Number(filteredData[0][col.field])),
        )
        .map((col) => col.field);
    console.log('channelFields (Case 2):', channelFields);
    const seriesData2 = channelFields.map((field) => ({
      type: 'line',
      name: field.replace('channel_', 'Ch '),
      showInLegend: true,
      visible: true,
      dataPoints: filteredData
        .filter((row) => {
          const valid = row.Timestamp && !isNaN(Number(row[field]));
          if (!valid) console.log('Invalid row (Case 2):', row);
          return valid;
        })
        .map((row) => ({
          x: new Date(row.Timestamp),
          y: Number(row[field]),
        })),
    }));
    console.log('seriesData (Case 2):', seriesData2);
    // Return if valid data found
    if (seriesData2.some((series) => series.dataPoints.length > 0)) {
      return seriesData2;
    }
    // Case 3: DataRow has nested channels (e.g., row.channels[channelId])
    let channelsToPlot3 = [...new Set(selectedChannels)];
    if (channelsToPlot3.length === 0 && filteredData[0]?.channels) {
      channelsToPlot3 = Object.keys(filteredData[0].channels).filter(
        (k) => !isNaN(Number(k)),
      );
    }
    const seriesData3 = channelsToPlot3.map((channel) => ({
      type: 'line',
      name: `Ch ${channel}`,
      showInLegend: true,
      visible: true,
      dataPoints: filteredData
        .filter((row: any) => {
          const valid =
            row.Timestamp && row.channels && !isNaN(Number(row.channels[channel]));
          if (!valid) console.log('Invalid row (Case 3):', row);
          return valid;
        })
        .map((row: any) => ({
          x: new Date(row.Timestamp),
          y: Number(row.channels[channel]),
        })),
    }));
    console.log('seriesData (Case 3):', seriesData3);
    return seriesData3;
  }, [filteredData, selectedSelection, columns]);

  // Chart options for CanvasJS
  const chartOptions = useMemo(
    () => ({
      animationEnabled: true,
      theme: 'light2',
      title: {
        text: selectedSelection ? `${selectedSelection.testName} Data` : 'Historical Data',
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
          e.dataSeries.visible = !e.dataSeries.visible;
          e.chart.render();
        },
      },
      data: chartData,
    }),
    [chartData, selectedSelection],
  );

  // Test options for react-select
  const testOptions = useMemo(
    () =>
      tests.map((test) => ({
        value: test.TestName,
        label: `${test.TestName} (${test.ConfigName})`,
      })),
    [tests],
  );

  // Get selected tests count
  const selectedTestsCount = testSelections.filter((sel) => sel.isSelected).length;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    setLocalPage(currentPage + 1);
  }, [currentPage]);

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalPage(event.target.value ? Number(event.target.value) : '');
  };

  const handlePageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      let newPage = typeof localPage === 'number' ? localPage - 1 : 0;
      const maxPage = Math.max(0, totalPages - 1);
      if (newPage < 0) newPage = 0;
      if (newPage > maxPage) newPage = maxPage;
      setCurrentPage(newPage);
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage(Math.max(0, currentPage - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
  };

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: 'table' | 'plot') => {
    if (newView) {
      setView(newView);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <Container maxWidth={false} disableGutters sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
            <Box component="main" sx={{ flexGrow: 1, p: 2, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={handleViewChange}
                  aria-label="view switch"
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
                  <ToggleButton value="table" aria-label="table view">
                    Table
                  </ToggleButton>
                  <ToggleButton value="plot" aria-label="plot view">
                    Plot
                  </ToggleButton>
                </ToggleButtonGroup>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="end"
                  onClick={toggleDrawer(true)}
                >
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
                    border: `1px solid ${error.includes('API') ? '#ffeaa7' : '#ffcdd2'
                      }`,
                  }}
                >
                  <Typography
                    color={error.includes('API') ? 'warning.main' : 'error'}
                    variant="body2"
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
                  <CanvasJSChart
                    options={chartOptions}
                    containerProps={{ width: '100%', height: '500px' }}
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
                <Typography variant="body2">Rows per page:</Typography>
                <Autocomplete
                  freeSolo
                  disableClearable
                  options={[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                  getOptionLabel={(option) => option.toString()}
                  value={pageSize}
                  onChange={(event, newValue) => {
                    let num = typeof newValue === 'string' ? parseInt(newValue) : newValue;
                    if (isNaN(num)) num = 10;
                    setPageSize(num);
                    setCurrentPage(0);
                  }}
                  inputValue={localPageSize}
                  onInputChange={(event, newInputValue) => {
                    setLocalPageSize(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} size="small" sx={{ width: 100 }} />
                  )}
                />
                <IconButton onClick={handlePreviousPage} disabled={currentPage === 0}>
                  <ArrowBackIcon />
                </IconButton>
                <TextField
                  size="small"
                  type="number"
                  value={localPage}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageKeyDown}
                  sx={{ width: 70 }}
                />
                <Typography variant="body2">/ {totalPages}</Typography>
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </Box>
            </Box>
            <Drawer
              anchor="right"
              open={drawerOpen}
              onClose={toggleDrawer(false)}
              sx={{
                width: '40%',
                '& .MuiDrawer-paper': { width: '40%', boxSizing: 'border-box' },
              }}
            >
              <Box sx={{ width: '100%', p: 2 }}>
                <Typography
                  variant="h6"
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
                  <Typography
                    variant="body2"
                    sx={{ color: '#666', fontSize: '0.75rem' }}
                  >
                    Select a test, configure channels, and set time ranges
                  </Typography>
                  {selectedTestsCount > 0 && (
                    <Chip
                      label={`1 test selected`}
                      color="primary"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ ml: 1, fontSize: '0.75rem' }}>
                      Loading test data...
                    </Typography>
                  </Box>
                ) : tests.length > 0 ? (
                  <Box sx={{ mb: 2, maxHeight: '70vh', overflow: 'auto' }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 1, fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Select Test
                    </Typography>
                    <CustomSelect
                      isMulti={false}
                      options={testOptions}
                      value={
                        testOptions.find((option) =>
                          testSelections.some(
                            (sel) =>
                              sel.testName === option.value && sel.isSelected,
                          ),
                        ) || null
                      }
                      onChange={handleTestSelect}
                      placeholder="Search and select a test..."
                    />
                    <Box sx={{ mt: 2 }}>
                      {testSelections
                        .filter((sel) => sel.isSelected)
                        .map((selection) => {
                          const test = tests.find(
                            (t) => t.TestName === selection.testName,
                          );
                          if (!test) return null;
                          const channelGroupedOptions = test.Details.map((detail) => ({
                            label: detail.Card,
                            options: detail.Channel.map((ch) => ({
                              value: ch.toString(),
                              label: `Ch: ${ch}`,
                            })),
                          }));
                          return (
                            <Accordion
                              key={selection.testName}
                              expanded={selection.isExpanded}
                              onChange={() =>
                                handleAccordionToggle(selection.testName)
                              }
                              sx={{
                                mb: 1,
                                border: '1px solid #e0e0e0',
                                borderRadius: '6px !important',
                              }}
                            >
                              <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                  bgcolor: selection.isSelected
                                    ? '#e3f2fd'
                                    : '#f8f9fa',
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
                                    onChange={() =>
                                      handleTestToggle(selection.testName)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    size="small"
                                    color="primary"
                                  />
                                  <Box sx={{ flexGrow: 1, ml: 1 }}>
                                    <Typography
                                      sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                                    >
                                      {test.TestName}
                                    </Typography>
                                    <Typography
                                      sx={{ color: '#666', fontSize: '0.7rem' }}
                                    >
                                      {test.ConfigName}
                                    </Typography>
                                  </Box>
                                </Box>
                              </AccordionSummary>
                              <AccordionDetails sx={{ pt: 1, pb: 1.5 }}>
                                <Box sx={{ mb: 1.5 }}>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      mb: 0.5,
                                      display: 'flex',
                                      alignItems: 'center',
                                      fontSize: '0.85rem',
                                    }}
                                  >
                                    <AccessTimeIcon
                                      sx={{ mr: 0.5, fontSize: '1rem' }}
                                    />
                                    Time Range
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: '0.7rem',
                                      color: '#ffca28',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {dayjs(test.testStartTime).format(
                                      'YYYY-MM-DD HH:mm:ss.SSS',
                                    )}{' '}
                                    -{' '}
                                    {dayjs(test.testEndTime).format(
                                      'YYYY-MM-DD HH:mm:ss.SSS',
                                    )}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, mb: 1 }}>
                                    <DateTimePicker<Dayjs>
                                      label="Start Time"
                                      value={selection.startTime}
                                      onChange={(value) =>
                                        handleTimeChange(
                                          test.TestName,
                                          'startTime',
                                          value,
                                        )
                                      }
                                      minDateTime={dayjs(test.testStartTime)}
                                      maxDateTime={dayjs(test.testEndTime)}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          fullWidth
                                          InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '0.75rem' },
                                          }}
                                        />
                                      )}
                                      format="YYYY-MM-DD HH:mm:ss"
                                      views={[
                                        'year',
                                        'month',
                                        'day',
                                        'hours',
                                        'minutes',
                                        'seconds',
                                      ]}
                                      ampm={false}
                                    />
                                    <DateTimePicker<Dayjs>
                                      label="End Time"
                                      value={selection.endTime}
                                      onChange={(value) =>
                                        handleTimeChange(
                                          test.TestName,
                                          'endTime',
                                          value,
                                        )
                                      }
                                      minDateTime={dayjs(test.testStartTime)}
                                      maxDateTime={dayjs(test.testEndTime)}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          fullWidth
                                          InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '0.75rem' },
                                          }}
                                        />
                                      )}
                                      format="YYYY-MM-DD HH:mm:ss"
                                      views={[
                                        'year',
                                        'month',
                                        'day',
                                        'hours',
                                        'minutes',
                                        'seconds',
                                      ]}
                                      ampm={false}
                                    />
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                      label="Start ms"
                                      type="number"
                                      size="small"
                                      fullWidth
                                      value={
                                        selection.startTime?.millisecond() || 0
                                      }
                                      onChange={(e) => {
                                        const ms = parseInt(e.target.value) || 0;
                                        const newTime =
                                          selection.startTime?.millisecond(ms) ||
                                          null;
                                        handleTimeChange(
                                          test.TestName,
                                          'startTime',
                                          newTime,
                                        );
                                      }}
                                      inputProps={{ min: 0, max: 999, step: 1 }}
                                      helperText="0-999 ms"
                                      sx={{
                                        '& .MuiFormHelperText-root': {
                                          fontSize: '0.65rem',
                                        },
                                      }}
                                    />
                                    <TextField
                                      label="End ms"
                                      type="number"
                                      size="small"
                                      fullWidth
                                      value={
                                        selection.endTime?.millisecond() || 0
                                      }
                                      onChange={(e) => {
                                        const ms = parseInt(e.target.value) || 0;
                                        const newTime =
                                          selection.endTime?.millisecond(ms) ||
                                          null;
                                        handleTimeChange(
                                          test.TestName,
                                          'endTime',
                                          newTime,
                                        );
                                      }}
                                      inputProps={{ min: 0, max: 999, step: 1 }}
                                      helperText="0-999 ms"
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
                                    variant="subtitle2"
                                    sx={{ mb: 1, fontWeight: 600, fontSize: '0.85rem' }}
                                  >
                                    Card Types & Channels
                                  </Typography>
                                  {test.Details.map((detail) => {
                                    const cardSelection = selection.cardSelections.find(
                                      (cs) => cs.cardName === detail.Card,
                                    );
                                    if (!cardSelection) return null;
                                    const channelOptions = detail.Channel.map(
                                      (channel) => ({
                                        value: channel,
                                        label: `Ch: ${channel}`,
                                      }),
                                    );
                                    return (
                                      <Paper
                                        key={detail.Card}
                                        sx={{
                                          mb: 1,
                                          border: '1px solid #e0e0e0',
                                          borderRadius: 1,
                                        }}
                                      >
                                        <Box sx={{ p: 0.75, bgcolor: '#f8f9fa' }}>
                                          <Typography
                                            sx={{
                                              fontWeight: 600,
                                              fontSize: '0.8rem',
                                            }}
                                          >
                                            {detail.Card}
                                          </Typography>
                                          <CustomSelect
                                            isMulti={true}
                                            options={channelOptions}
                                            value={channelOptions.filter(
                                              (option) =>
                                                cardSelection.selectedChannels.includes(
                                                  Number(option.value),
                                                ),
                                            )}
                                            onChange={(selected, action) =>
                                              handleChannelSelect(
                                                test.TestName,
                                                detail.Card,
                                                selected,
                                                action,
                                              )
                                            }
                                            placeholder="Select channels..."
                                          />
                                        </Box>
                                      </Paper>
                                    );
                                  })}
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Box>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ mb: 1, fontWeight: 600, fontSize: '0.85rem' }}
                                  >
                                    Custom Channels
                                  </Typography>
                                  <TextField
                                    label="Custom Channel Name"
                                    size="small"
                                    value={newCustomName}
                                    onChange={(e) => setNewCustomName(e.target.value)}
                                    fullWidth
                                    sx={{ mb: 1 }}
                                  />
                                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <CustomSelect
                                      isMulti={false}
                                      options={channelGroupedOptions}
                                      value={newChannel1}
                                      onChange={(selected) => setNewChannel1(selected as SingleValue<SelectOption>)}
                                      placeholder="Channel 1"
                                      isSearchable
                                    />
                                    <Select
                                      value={newOperation}
                                      onChange={(e) => setNewOperation(e.target.value as '+' | '-' | '*' | '/')}
                                      size="small"
                                      sx={{ minWidth: 60 }}
                                    >
                                      <MenuItem value="+">+</MenuItem>
                                      <MenuItem value="-">-</MenuItem>
                                      <MenuItem value="*">*</MenuItem>
                                      <MenuItem value="/">/</MenuItem>
                                    </Select>
                                    {useConstant ? (
                                      <TextField
                                        label="Constant"
                                        type="number"
                                        size="small"
                                        value={newConstant}
                                        onChange={(e) => setNewConstant(e.target.value)}
                                        fullWidth
                                      />
                                    ) : (
                                      <CustomSelect
                                        isMulti={false}
                                        options={channelGroupedOptions}
                                        value={newChannel2}
                                        onChange={(selected) => setNewChannel2(selected as SingleValue<SelectOption>)}
                                        placeholder="Channel 2"
                                        isSearchable
                                      />
                                    )}
                                  </Box>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        checked={useConstant}
                                        onChange={(e) => setUseConstant(e.target.checked)}
                                        size="small"
                                      />
                                    }
                                    label="Use Constant"
                                    sx={{ mb: 1 }}
                                  />
                                  <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleAddCustom}
                                    fullWidth
                                    sx={{ mb: 1 }}
                                  >
                                    Add Custom Channel
                                  </Button>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                    {selection.customChannels.map((custom) => (
                                      <Chip
                                        key={custom.name}
                                        label={custom.name}
                                        onDelete={() =>
                                          setTestSelections((prev) =>
                                            prev.map((sel) =>
                                              sel.testName === selection.testName
                                                ? {
                                                    ...sel,
                                                    customChannels: sel.customChannels.filter(
                                                      (c) => c.name !== custom.name
                                                    ),
                                                  }
                                                : sel
                                            )
                                          )
                                        }
                                        sx={{ m: 0.5 }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              </AccordionDetails>
                            </Accordion>
                          );
                        })}
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: '#fff3cd',
                      borderRadius: 1,
                      border: '1px solid #ffeaa7',
                    }}
                  >
                    <Typography
                      color="warning.main"
                      sx={{ mb: 1, fontSize: '0.85rem' }}
                    >
                      No tests available.
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {error || 'Please check the API connection or try again later.'}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={
                      loading || tests.length === 0 || selectedTestsCount === 0
                    }
                    sx={{ minWidth: 80, fontWeight: 600, textTransform: 'none' }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
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