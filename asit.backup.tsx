import React, { useState, useMemo, useEffect } from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { ToggleButtonGroup, ToggleButton, Tabs, Tab } from "@mui/material";
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
  ButtonGroup,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { SingleValue, MultiValue, ActionMeta } from "react-select";
import CustomSelect from "../component/Widgets/CustomSelect";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CanvasJSReact from "@canvasjs/react-charts";
import { UrlConstant } from "../component/util/UrlConstans";
import DownloadIcon from "@mui/icons-material/Download";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface Test {
  TestName: string;
}

export interface DataRow {
  id: number;
  TestName: string;
  ConfigName: string;
  Card?: string;
  Channel: string;
  Timestamp: string;
  Value: number;
  [key: string]: any; // Allow dynamic column access
}

// Custom query with channel expression
export interface CustomQueryConfig {
  configName: string;
  isExpanded: boolean;
  selectedChannels: number[];
  selectedOperators: string[];
  channelExpression: string;
  outputChannelName: string;
  startTime: Dayjs | null;
  endTime: Dayjs | null;
}

export interface CustomQueryTest {
  testName: string;
  isSelected: boolean;
  isExpanded: boolean;
  customQueryConfigs: CustomQueryConfig[];
}

// Regular filter interfaces
export interface CardSelection {
  cardName: string;
  selectedChannels: number[];
}

export interface ConfigSelection {
  configName: string;
  isExpanded: boolean;
  cardSelections: CardSelection[];
  startTime: Dayjs | null;
  endTime: Dayjs | null;
}

export interface TestSelection {
  testName: string;
  isSelected: boolean;
  isExpanded: boolean;
  configSelections: ConfigSelection[];
}

export interface SelectedConfig {
  testName: string;
  configName: string;
  configSelection: ConfigSelection;
}

export interface FilterRequestBody {
  TestName: string;
  ConfigName: string;
  details: { cardType: string; channels: number[] }[];
  limit?: number;
  offset?: number;
  startTime?: string;
  endTime?: string;
}

// Custom query request
export interface CustomQueryRequest {
  TestName: string;
  ConfigName: string;
  ChannelOperation: string;
  outputChannelName: string;
  startTime?: string;
  endTime?: string;
}

export interface TestConfigDetailsResponse {
  TestName: string;
  ConfigName: string;
  testStartTime: string;
  testEndTime: string;
  details: { cardType: string; channels: number[] }[];
}

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
        select: { fontSize: "0.75rem", padding: "4px 8px" },
      },
    },
    MuiInputBase: {
      styleOverrides: { root: { fontSize: "0.75rem" } },
    },
    MuiButton: {
      styleOverrides: {
        root: { fontSize: "0.7rem", padding: "2px 6px", minWidth: "60px" },
      },
    },
    MuiTypography: {
      styleOverrides: { root: { fontSize: "0.85rem" } },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: "0.7rem" } },
    },
  },
});

const HistoricalData: React.FC = () => {
  // State
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"filter" | "customQuery">(
    "filter",
  );
  const [tests, setTests] = useState<Test[]>([]);
  const [configs, setConfigs] = useState<Record<string, string[]>>({});
  const [cards, setCards] = useState<Record<string, string[]>>({});
  const [channels, setChannels] = useState<Record<string, number[]>>({});
  const [allChannels, setAllChannels] = useState<number[]>([]);
  const [filteredData, setFilteredData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter tab state
  const [testSelections, setTestSelections] = useState<TestSelection[]>([]);
  const [selectedConfigs, setSelectedConfigs] = useState<SelectedConfig[]>([]);

  // Custom query tab state
  const [customQueryTests, setCustomQueryTests] = useState<CustomQueryTest[]>(
    [],
  );
  const [selectedCustomQueries, setSelectedCustomQueries] = useState<
    { testName: string; configName: string; config: CustomQueryConfig }[]
  >([]);

  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [localPage, setLocalPage] = useState<number | string>(1);
  const [pageSize, setPageSize] = useState(10);
  const [localPageSize, setLocalPageSize] = useState<string>("10");
  const [view, setView] = useState<"table" | "plot">("table");

  // API URLs
  const apiBase = UrlConstant.HISTORICAL_DATA_API;
  const allTestNamesURL = `${apiBase}/all-test-names`;
  const configNamesURL = `${apiBase}/config-names`;
  const testConfigDetailsURL = `${apiBase}/test-config-details`;
  const filterApiURL = `${apiBase}/filter`;
  const customQueryApiURL = `${apiBase}/custom-query`;

  // Fetch all test names
  useEffect(() => {
    const fetchTestNames = async () => {
      try {
        setLoading(true);
        const response = await fetch(allTestNamesURL);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const testNames = data.TestName || [];
        setTests(testNames.map((name: string) => ({ TestName: name })));
        if (testNames.length === 0) setError("No test names received from API");
      } catch (err: any) {
        setError("⚠️ API connection failed. Please check the server.");
      } finally {
        setLoading(false);
      }
    };
    fetchTestNames();
  }, []);

  // Initialize test selections for both tabs
  useEffect(() => {
    if (tests.length > 0) {
      const initialSelections: TestSelection[] = tests.map((test) => ({
        testName: test.TestName,
        isSelected: false,
        isExpanded: false,
        configSelections: [],
      }));
      setTestSelections(initialSelections);

      const initialCustomQueryTests: CustomQueryTest[] = tests.map((test) => ({
        testName: test.TestName,
        isSelected: false,
        isExpanded: false,
        customQueryConfigs: [],
      }));
      setCustomQueryTests(initialCustomQueryTests);
    }
  }, [tests]);

  // Fetch configs when a test is selected (for both tabs)
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
        fetchConfigs(testName);
      }
    });
  }, [testSelections, customQueryTests, configs]);

  const fetchConfigs = async (testName: string) => {
    try {
      const response = await fetch(configNamesURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ TestName: testName }),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const configNames = data.ConfigName || [];
      setConfigs((prev) => ({ ...prev, [testName]: configNames }));

      // Update filter tab
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
            : sel,
        ),
      );

      // Update custom query tab
      setCustomQueryTests((prev) =>
        prev.map((sel) =>
          sel.testName === testName
            ? {
                ...sel,
                customQueryConfigs: configNames.map((config: string) => ({
                  configName: config,
                  isExpanded: false,
                  selectedChannels: [],
                  selectedOperators: [],
                  channelExpression: "",
                  outputChannelName: "",
                  startTime: null,
                  endTime: null,
                })),
              }
            : sel,
        ),
      );
    } catch (err: any) {
      setError(`Failed to fetch configurations for test ${testName}.`);
    }
  };

  // Fetch test config details
  const fetchTestConfigDetails = async (
    testName: string,
    configName: string,
  ) => {
    const key = `${testName}_${configName}`;
    if (!cards[key]) {
      try {
        const response = await fetch(
          `${testConfigDetailsURL}?TestName=${encodeURIComponent(testName)}&ConfigName=${encodeURIComponent(
            configName,
          )}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data: TestConfigDetailsResponse = await response.json();
        const cardList = data.details.map((detail) => detail.cardType);
        setCards((prev) => ({ ...prev, [key]: cardList }));

        const channelsMap: Record<string, number[]> = {};
        const allChannelsSet = new Set<number>();

        data.details.forEach((detail) => {
          channelsMap[`${testName}_${configName}_${detail.cardType}`] =
            detail.channels;
          detail.channels.forEach((ch) => allChannelsSet.add(ch));
        });

        setChannels((prev) => ({ ...prev, ...channelsMap }));
        setAllChannels(Array.from(allChannelsSet).sort((a, b) => a - b));

        setTestSelections((prev) =>
          prev.map((sel) =>
            sel.testName === testName
              ? {
                  ...sel,
                  configSelections: sel.configSelections.map(
                    (config: ConfigSelection) =>
                      config.configName === configName
                        ? {
                            ...config,
                            cardSelections: cardList.map((c: string) => ({
                              cardName: c,
                              selectedChannels: [],
                            })),
                            startTime: data.testStartTime
                              ? dayjs(data.testStartTime)
                              : null,
                            endTime: data.testEndTime
                              ? dayjs(data.testEndTime)
                              : null,
                          }
                        : config,
                  ),
                }
              : sel,
          ),
        );

        // Update custom query tab with time range
        setCustomQueryTests((prev) =>
          prev.map((sel) =>
            sel.testName === testName
              ? {
                  ...sel,
                  customQueryConfigs: sel.customQueryConfigs.map(
                    (config: CustomQueryConfig) =>
                      config.configName === configName
                        ? {
                            ...config,
                            startTime: data.testStartTime
                              ? dayjs(data.testStartTime)
                              : null,
                            endTime: data.testEndTime
                              ? dayjs(data.testEndTime)
                              : null,
                          }
                        : config,
                  ),
                }
              : sel,
          ),
        );
      } catch (err: any) {
        setError(
          `Failed to fetch test config details for ${testName} - ${configName}.`,
        );
      }
    }
  };

  // Filter Tab Handlers
  const handleTestSelect = (
    selected: SingleValue<SelectOption> | MultiValue<SelectOption>,
    action: ActionMeta<SelectOption>,
  ) => {
    const selectedNames = (selected as MultiValue<SelectOption>).map(
      (s) => s.value as string,
    );
    setTestSelections((prev) =>
      prev.map((sel) => ({
        ...sel,
        isSelected: selectedNames.includes(sel.testName),
        isExpanded: selectedNames.includes(sel.testName),
      })),
    );
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
          : selection,
      ),
    );
  };

  const handleTestAccordionToggle = (testName: string) => {
    setTestSelections((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? { ...selection, isExpanded: !selection.isExpanded }
          : selection,
      ),
    );
  };

  const handleConfigAccordionToggle = (
    testName: string,
    configName: string,
  ) => {
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: sel.configSelections.map(
                (config: ConfigSelection) =>
                  config.configName === configName
                    ? { ...config, isExpanded: !config.isExpanded }
                    : config,
              ),
            }
          : sel,
      ),
    );
    if (!cards[`${testName}_${configName}`]) {
      fetchTestConfigDetails(testName, configName);
    }
  };

  const handleChannelSelect = (
    testName: string,
    configName: string,
    cardName: string,
    selected: MultiValue<SelectOption> | null,
    action: ActionMeta<SelectOption>,
  ) => {
    const selectedChannels = selected
      ? selected.map((option) => Number(option.value))
      : [];
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: sel.configSelections.map(
                (config: ConfigSelection) =>
                  config.configName === configName
                    ? {
                        ...config,
                        cardSelections: config.cardSelections.map(
                          (cardSel: CardSelection) =>
                            cardSel.cardName === cardName
                              ? { ...cardSel, selectedChannels }
                              : cardSel,
                        ),
                      }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  const handleTimeChange = (
    testName: string,
    configName: string,
    field: "startTime" | "endTime",
    value: Dayjs | null,
  ) => {
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: sel.configSelections.map(
                (config: ConfigSelection) =>
                  config.configName === configName
                    ? { ...config, [field]: value }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  // Custom Query Tab Handlers
  const handleCustomQueryTestSelect = (
    selected: SingleValue<SelectOption> | MultiValue<SelectOption>,
    action: ActionMeta<SelectOption>,
  ) => {
    const selectedNames = (selected as MultiValue<SelectOption>).map(
      (s) => s.value as string,
    );
    setCustomQueryTests((prev) =>
      prev.map((sel) => ({
        ...sel,
        isSelected: selectedNames.includes(sel.testName),
        isExpanded: selectedNames.includes(sel.testName),
      })),
    );
  };

  const handleCustomQueryTestToggle = (testName: string) => {
    setCustomQueryTests((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? {
              ...selection,
              isSelected: !selection.isSelected,
              isExpanded: !selection.isSelected,
            }
          : selection,
      ),
    );
  };

  const handleCustomQueryTestAccordionToggle = (testName: string) => {
    setCustomQueryTests((prev) =>
      prev.map((selection) =>
        selection.testName === testName
          ? { ...selection, isExpanded: !selection.isExpanded }
          : selection,
      ),
    );
  };

  const handleCustomQueryConfigAccordionToggle = (
    testName: string,
    configName: string,
  ) => {
    setCustomQueryTests((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              customQueryConfigs: sel.customQueryConfigs.map(
                (config: CustomQueryConfig) =>
                  config.configName === configName
                    ? { ...config, isExpanded: !config.isExpanded }
                    : config,
              ),
            }
          : sel,
      ),
    );
    if (!cards[`${testName}_${configName}`]) {
      fetchTestConfigDetails(testName, configName);
    }
  };

  const handleCustomQueryTimeChange = (
    testName: string,
    configName: string,
    field: "startTime" | "endTime",
    value: Dayjs | null,
  ) => {
    setCustomQueryTests((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              customQueryConfigs: sel.customQueryConfigs.map(
                (config: CustomQueryConfig) =>
                  config.configName === configName
                    ? { ...config, [field]: value }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  // Handle channel selection in custom query
  const handleCustomQueryChannelSelect = (
    testName: string,
    configName: string,
    selected: MultiValue<SelectOption> | null,
  ) => {
    const selectedChannels = selected
      ? selected.map((option) => Number(option.value))
      : [];

    setCustomQueryTests((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              customQueryConfigs: sel.customQueryConfigs.map(
                (config: CustomQueryConfig) =>
                  config.configName === configName
                    ? {
                        ...config,
                        selectedChannels,
                        channelExpression: buildChannelExpression(
                          selectedChannels,
                          config.selectedOperators,
                        ),
                      }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  // Add operator to expression
  const handleAddOperator = (
    testName: string,
    configName: string,
    operator: string,
  ) => {
    setCustomQueryTests((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              customQueryConfigs: sel.customQueryConfigs.map(
                (config: CustomQueryConfig) => {
                  if (config.configName === configName) {
                    const newOperators = [
                      ...config.selectedOperators,
                      operator,
                    ];
                    return {
                      ...config,
                      selectedOperators: newOperators,
                      channelExpression: buildChannelExpression(
                        config.selectedChannels,
                        newOperators,
                      ),
                    };
                  }
                  return config;
                },
              ),
            }
          : sel,
      ),
    );
  };

  // Build channel expression from selected channels and operators
  const buildChannelExpression = (
    channels: number[],
    operators: string[],
  ): string => {
    if (channels.length === 0) return "";
    if (channels.length === 1) return channels[0].toString();

    let expression = channels[0].toString();
    for (let i = 1; i < channels.length; i++) {
      const operator = operators[i - 1] || "+";
      expression += ` ${operator} ${channels[i]}`;
    }
    return expression;
  };

  // Clear operators
  const handleClearOperators = (testName: string, configName: string) => {
    setCustomQueryTests((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              customQueryConfigs: sel.customQueryConfigs.map(
                (config: CustomQueryConfig) =>
                  config.configName === configName
                    ? {
                        ...config,
                        selectedOperators: [],
                        channelExpression: buildChannelExpression(
                          config.selectedChannels,
                          [],
                        ),
                      }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  const handleOutputChannelNameChange = (
    testName: string,
    configName: string,
    value: string,
  ) => {
    setCustomQueryTests((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              customQueryConfigs: sel.customQueryConfigs.map(
                (config: CustomQueryConfig) =>
                  config.configName === configName
                    ? { ...config, outputChannelName: value }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  // Validation for custom query
  const validateCustomQuery = (
    config: CustomQueryConfig,
  ): { isValid: boolean; error?: string } => {
    if (config.selectedChannels.length === 0) {
      return { isValid: false, error: "Please select at least one channel" };
    }

    if (!config.channelExpression.trim()) {
      return { isValid: false, error: "Channel expression is empty" };
    }

    if (!config.outputChannelName.trim()) {
      return { isValid: false, error: "Output channel name is required" };
    }

    return { isValid: true };
  };

  const clearAllSelections = () => {
    setTestSelections((prev) =>
      prev.map((selection) => ({
        ...selection,
        isSelected: false,
        isExpanded: false,
        configSelections: selection.configSelections.map(
          (config: ConfigSelection) => ({
            ...config,
            isExpanded: false,
            cardSelections: [],
            startTime: null,
            endTime: null,
          }),
        ),
      })),
    );

    setCustomQueryTests((prev) =>
      prev.map((selection) => ({
        ...selection,
        isSelected: false,
        isExpanded: false,
        customQueryConfigs: selection.customQueryConfigs.map(
          (config: CustomQueryConfig) => ({
            ...config,
            isExpanded: false,
            selectedChannels: [],
            selectedOperators: [],
            channelExpression: "",
            outputChannelName: "",
            startTime: null,
            endTime: null,
          }),
        ),
      })),
    );

    setFilteredData([]);
    setTotalCount(0);
    setSelectedConfigs([]);
    setSelectedCustomQueries([]);
    setCurrentPage(0);
    setLocalPage(1);
    setPageSize(10);
    setLocalPageSize("10");
  };

  // Fetch regular filtered data
  const fetchFilteredData = async (
    page: number,
    pageSize: number,
    testName: string,
    configSelection: ConfigSelection,
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
        channels:
          channels[`${testName}_${configSelection.configName}_${card}`] || [],
      }));
    }

    try {
      const response = await fetch(filterApiURL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const data = (result.data || []).map((row: DataRow, index: number) => ({
        ...row,
        id: offset + index,
      }));
      return { data, totalCount: result.totalCount || 0 };
    } catch (err: any) {
      throw new Error(
        `Failed to fetch data for ${testName} - ${configSelection.configName}.`,
      );
    }
  };

  // Fetch custom query data
  const fetchCustomQueryData = async (
    testName: string,
    configName: string,
    config: CustomQueryConfig,
  ) => {
    const validation = validateCustomQuery(config);
    if (!validation.isValid) {
      return [];
    }

    const requestBody: CustomQueryRequest = {
      TestName: testName,
      ConfigName: configName,
      ChannelOperation: config.channelExpression,
      outputChannelName: config.outputChannelName,
      startTime: config.startTime?.toISOString(),
      endTime: config.endTime?.toISOString(),
    };

    try {
      const response = await fetch(customQueryApiURL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const data = (result || []).map((row: any, index: number) => ({
        ...row,
        id: `custom_${testName}_${configName}_${index}`,
      }));
      return data;
    } catch (err: any) {
      console.error(`Failed to fetch custom query data: ${err.message}`);
      return [];
    }
  };

  const loadData = async () => {
    if (selectedConfigs.length === 0 && selectedCustomQueries.length === 0)
      return;

    setDataLoading(true);
    try {
      let allData: DataRow[] = [];
      let total = 0;

      // Fetch regular filtered data
      for (const sc of selectedConfigs) {
        const { data, totalCount } = await fetchFilteredData(
          currentPage,
          pageSize,
          sc.testName,
          sc.configSelection,
        );
        allData = allData.concat(data);
        total += totalCount;
      }

      // Fetch custom query data
      for (const cq of selectedCustomQueries) {
        const customData = await fetchCustomQueryData(
          cq.testName,
          cq.configName,
          cq.config,
        );
        allData = allData.concat(customData);
        total += customData.length;
      }

      // Sort by Timestamp
      allData.sort(
        (a, b) =>
          new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime(),
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
  }, [currentPage, selectedConfigs, selectedCustomQueries, pageSize]);

  const handleSubmit = async () => {
    const selectedConfigsList: SelectedConfig[] = [];
    const selectedCustomQueriesList: {
      testName: string;
      configName: string;
      config: CustomQueryConfig;
    }[] = [];

    // Collect filter selections
    testSelections.forEach((sel) => {
      if (sel.isSelected) {
        sel.configSelections.forEach((config) => {
          if (
            config.cardSelections.some(
              (card: CardSelection) => card.selectedChannels.length > 0,
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
          const validation = validateCustomQuery(config);
          if (validation.isValid) {
            selectedCustomQueriesList.push({
              testName: sel.testName,
              configName: config.configName,
              config: config,
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
    setSelectedConfigs(selectedConfigsList);
    setSelectedCustomQueries(selectedCustomQueriesList);
    setCurrentPage(0);
    setDrawerOpen(false);
  };

  const toggleDrawer =
    (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event.type === "keydown" &&
        ((event as React.KeyboardEvent).key === "Tab" ||
          (event as React.KeyboardEvent).key === "Shift")
      ) {
        return;
      }
      setDrawerOpen(open);
    };

  const pagedRows = useMemo(() => {
    return filteredData;
  }, [filteredData]);

  const columns: GridColDef[] = useMemo(() => {
    if (pagedRows.length === 0) return [];
    const keys = Object.keys(pagedRows[0]).filter((key) => key !== "id");
    return keys.map((key) => ({
      field: key,
      headerName: key.replace(/([A-Z])/g, " $1").trim(),
      flex: 1,
      sortable: false,
    }));
  }, [pagedRows]);

  const chartData: SeriesData[] = useMemo(() => {
    if (pagedRows.length === 0) {
      return [];
    }

    // Try to parse Channel field - could be numeric or string expression
    const channelsToPlot = Array.from(
      new Set(
        pagedRows.map((row: DataRow) => row.Channel).filter((ch: string) => ch),
      ),
    );

    const dataByChannel: { [key: string]: DataRow[] } = {};
    pagedRows.forEach((row: DataRow) => {
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
  }, [pagedRows]);

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
    [chartData],
  );

  const exportToCSV = () => {
    if (filteredData.length === 0) {
      setError("No data available to export");
      return;
    }

    try {
      // Get column headers
      const headers = columns.map((col) => col.headerName || col.field);
      const headerRow = headers.join(",");

      // Get data rows
      const dataRows = filteredData.map((row) => {
        return columns
          .map((col) => {
            const value = row[col.field];
            // Handle values that contain commas or quotes
            if (value === null || value === undefined) return "";
            const stringValue = String(value);
            if (
              stringValue.includes(",") ||
              stringValue.includes('"') ||
              stringValue.includes("\n")
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",");
      });

      // Combine headers and data
      const csvContent = [headerRow, ...dataRows].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      // Generate filename with timestamp and test name
      const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
      const testName =
        selectedConfigs.length > 0 ? selectedConfigs[0].testName : "data";
      const filename = `${testName}_${timestamp}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Failed to export CSV: " + err.message);
    }
  };

  const testOptions = useMemo(
    () =>
      tests.map((test) => ({
        value: test.TestName,
        label: test.TestName,
      })),
    [tests],
  );

  const selectedTestsCount = testSelections.filter(
    (sel) => sel.isSelected,
  ).length;
  const selectedCustomQueryTestsCount = customQueryTests.filter(
    (sel) => sel.isSelected,
  ).length;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    setLocalPage(currentPage + 1);
  }, [currentPage]);

  const handlePageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setLocalPage(value ? Number(value) : "");
  };

  const handlePageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      let newPage = typeof localPage === "number" ? localPage - 1 : 0;
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

  const handleViewChange = (
    _: React.MouseEvent<HTMLElement>,
    newView: "table" | "plot" | null,
  ) => {
    if (newView) {
      setView(newView);
    }
  };

  const handleTabChange = (
    event: React.SyntheticEvent,
    newValue: "filter" | "customQuery",
  ) => {
    setActiveTab(newValue);
  };

  // Create all channel options for custom query
  const allChannelOptions = useMemo(
    () =>
      allChannels.map((channel) => ({
        value: channel.toString(),
        label: `Ch: ${channel}`,
      })),
    [allChannels],
  );

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
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
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
                          "&:hover": {
                            backgroundColor: "#1565c0",
                          },
                        },
                        "&:hover": {
                          backgroundColor: "#e0e0e0",
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
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={exportToCSV}
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
              <Box sx={{ height: 500, width: "100%", overflow: "hidden" }}>
                {view === "table" ? (
                  <DataGrid
                    rows={pagedRows}
                    columns={columns}
                    loading={loading || dataLoading}
                    hideFooter={true}
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
                    No data available for plotting. Please select channels and
                    apply.
                  </Typography>
                ) : (
                  <CanvasJSReact.CanvasJSChart
                    options={chartOptions}
                    containerProps={{
                      style: { width: "100%", height: "500px" },
                    }}
                  />
                )}
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
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
                    let num =
                      typeof newValue === "string"
                        ? parseInt(newValue, 10)
                        : newValue;
                    if (isNaN(num) || num <= 0) num = 10;
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
                <IconButton
                  onClick={handlePreviousPage}
                  disabled={currentPage === 0}
                >
                  <ArrowBackIcon />
                </IconButton>
                <TextField
                  size="small"
                  type="number"
                  value={localPage}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageKeyDown}
                  sx={{ width: 70 }}
                  inputProps={{ min: 1, max: totalPages }}
                />
                <Typography variant="body2">/ {totalPages || 1}</Typography>
                <IconButton
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1 || totalPages === 0}
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

                {loading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                    <CircularProgress size={24} />
                    <Typography sx={{ ml: 1, fontSize: "0.75rem" }}>
                      Loading test data...
                    </Typography>
                  </Box>
                ) : tests.length > 0 ? (
                  <Box sx={{ mb: 2, maxHeight: "65vh", overflow: "auto" }}>
                    {/* Filter Tab Content */}
                    {activeTab === "filter" && (
                      <>
                        <Box sx={{ mb: 1.5 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: "#666", fontSize: "0.75rem" }}
                          >
                            Select tests, configure channels, and set time
                            ranges
                          </Typography>
                          {selectedTestsCount > 0 && (
                            <Chip
                              label={`${selectedTestsCount} test${selectedTestsCount !== 1 ? "s" : ""} selected`}
                              color="primary"
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ mb: 1, fontWeight: 600, fontSize: "0.85rem" }}
                        >
                          Select Tests
                        </Typography>
                        <CustomSelect
                          isMulti={true}
                          options={testOptions}
                          value={testOptions.filter((option) =>
                            testSelections.some(
                              (sel) =>
                                sel.testName === option.value && sel.isSelected,
                            ),
                          )}
                          onChange={handleTestSelect}
                          placeholder="Search and select tests..."
                        />
                        <Box sx={{ mt: 2 }}>
                          {testSelections
                            .filter((sel) => sel.isSelected)
                            .map((selection) => (
                              <Accordion
                                key={selection.testName}
                                expanded={selection.isExpanded}
                                onChange={() =>
                                  handleTestAccordionToggle(selection.testName)
                                }
                                sx={{
                                  mb: 1,
                                  border: "1px solid #e0e0e0",
                                  borderRadius: "6px !important",
                                }}
                              >
                                <AccordionSummary
                                  expandIcon={<ExpandMoreIcon />}
                                  sx={{
                                    bgcolor: selection.isSelected
                                      ? "#e3f2fd"
                                      : "#f8f9fa",
                                    borderRadius: "6px",
                                    "&.Mui-expanded": {
                                      borderRadius: "6px 6px 0 0",
                                    },
                                    minHeight: "40px",
                                    "& .MuiAccordionSummary-content": {
                                      my: 0.5,
                                    },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      width: "100%",
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
                                        sx={{
                                          fontWeight: 600,
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        {selection.testName}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1, pb: 1.5 }}>
                                  {selection.configSelections.map(
                                    (config: ConfigSelection) => (
                                      <Accordion
                                        key={config.configName}
                                        expanded={config.isExpanded}
                                        onChange={() =>
                                          handleConfigAccordionToggle(
                                            selection.testName,
                                            config.configName,
                                          )
                                        }
                                        sx={{
                                          mb: 1,
                                          border: "1px solid #e0e0e0",
                                          borderRadius: "4px !important",
                                          ml: 2,
                                        }}
                                      >
                                        <AccordionSummary
                                          expandIcon={<ExpandMoreIcon />}
                                          sx={{
                                            bgcolor: config.isExpanded
                                              ? "#e8f4f8"
                                              : "#fafafa",
                                            borderRadius: "4px",
                                            "&.Mui-expanded": {
                                              borderRadius: "4px 4px 0 0",
                                            },
                                            minHeight: "36px",
                                            "& .MuiAccordionSummary-content": {
                                              my: 0.5,
                                            },
                                          }}
                                        >
                                          <Typography
                                            sx={{
                                              fontWeight: 600,
                                              fontSize: "0.8rem",
                                            }}
                                          >
                                            {config.configName}
                                          </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails
                                          sx={{ pt: 1, pb: 1.5 }}
                                        >
                                          <Box sx={{ mb: 1.5 }}>
                                            <Typography
                                              variant="subtitle2"
                                              sx={{
                                                mb: 0.5,
                                                display: "flex",
                                                alignItems: "center",
                                                fontSize: "0.85rem",
                                              }}
                                            >
                                              <AccessTimeIcon
                                                sx={{
                                                  mr: 0.5,
                                                  fontSize: "1rem",
                                                }}
                                              />
                                              Time Range
                                            </Typography>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                gap: 1,
                                                mt: 0.5,
                                                mb: 1,
                                              }}
                                            >
                                              <DateTimePicker<Dayjs>
                                                label="Start Time"
                                                value={config.startTime}
                                                onChange={(value) =>
                                                  handleTimeChange(
                                                    selection.testName,
                                                    config.configName,
                                                    "startTime",
                                                    value,
                                                  )
                                                }
                                                renderInput={(params) => (
                                                  <TextField
                                                    {...params}
                                                    size="small"
                                                    fullWidth
                                                    InputProps={{
                                                      ...params.InputProps,
                                                      sx: {
                                                        fontSize: "0.75rem",
                                                      },
                                                    }}
                                                  />
                                                )}
                                                views={[
                                                  "year",
                                                  "month",
                                                  "day",
                                                  "hours",
                                                  "minutes",
                                                  "seconds",
                                                ]}
                                                ampm={false}
                                              />
                                              <DateTimePicker<Dayjs>
                                                label="End Time"
                                                value={config.endTime}
                                                onChange={(value) =>
                                                  handleTimeChange(
                                                    selection.testName,
                                                    config.configName,
                                                    "endTime",
                                                    value,
                                                  )
                                                }
                                                renderInput={(params) => (
                                                  <TextField
                                                    {...params}
                                                    size="small"
                                                    fullWidth
                                                    InputProps={{
                                                      ...params.InputProps,
                                                      sx: {
                                                        fontSize: "0.75rem",
                                                      },
                                                    }}
                                                  />
                                                )}
                                                views={[
                                                  "year",
                                                  "month",
                                                  "day",
                                                  "hours",
                                                  "minutes",
                                                  "seconds",
                                                ]}
                                                ampm={false}
                                              />
                                            </Box>
                                            <Box
                                              sx={{ display: "flex", gap: 1 }}
                                            >
                                              <TextField
                                                label="Start ms"
                                                type="number"
                                                size="small"
                                                fullWidth
                                                value={
                                                  config.startTime?.millisecond() ??
                                                  0
                                                }
                                                onChange={(e) => {
                                                  const ms = parseInt(
                                                    e.target.value,
                                                    10,
                                                  );
                                                  if (!isNaN(ms)) {
                                                    const newTime =
                                                      config.startTime?.millisecond(
                                                        ms,
                                                      ) || null;
                                                    handleTimeChange(
                                                      selection.testName,
                                                      config.configName,
                                                      "startTime",
                                                      newTime,
                                                    );
                                                  }
                                                }}
                                                inputProps={{
                                                  min: 0,
                                                  max: 999,
                                                  step: 1,
                                                }}
                                                helperText="0-999 ms"
                                                sx={{
                                                  "& .MuiFormHelperText-root": {
                                                    fontSize: "0.65rem",
                                                  },
                                                }}
                                              />
                                              <TextField
                                                label="End ms"
                                                type="number"
                                                size="small"
                                                fullWidth
                                                value={
                                                  config.endTime?.millisecond() ??
                                                  0
                                                }
                                                onChange={(e) => {
                                                  const ms = parseInt(
                                                    e.target.value,
                                                    10,
                                                  );
                                                  if (!isNaN(ms)) {
                                                    const newTime =
                                                      config.endTime?.millisecond(
                                                        ms,
                                                      ) || null;
                                                    handleTimeChange(
                                                      selection.testName,
                                                      config.configName,
                                                      "endTime",
                                                      newTime,
                                                    );
                                                  }
                                                }}
                                                inputProps={{
                                                  min: 0,
                                                  max: 999,
                                                  step: 1,
                                                }}
                                                helperText="0-999 ms"
                                                sx={{
                                                  "& .MuiFormHelperText-root": {
                                                    fontSize: "0.65rem",
                                                  },
                                                }}
                                              />
                                            </Box>
                                          </Box>
                                          <Divider sx={{ my: 1 }} />
                                          <Box>
                                            <Typography
                                              variant="subtitle2"
                                              sx={{
                                                mb: 1,
                                                fontWeight: 600,
                                                fontSize: "0.85rem",
                                              }}
                                            >
                                              Card Types & Channels
                                            </Typography>
                                            {config.cardSelections.map(
                                              (cardSel: CardSelection) => {
                                                const channelOptions = (
                                                  channels[
                                                    `${selection.testName}_${config.configName}_${cardSel.cardName}`
                                                  ] || []
                                                ).map((channel) => ({
                                                  value: channel.toString(),
                                                  label: `Ch: ${channel}`,
                                                }));
                                                return (
                                                  <Paper
                                                    key={cardSel.cardName}
                                                    sx={{
                                                      mb: 1,
                                                      border:
                                                        "1px solid #e0e0e0",
                                                      borderRadius: 1,
                                                    }}
                                                  >
                                                    <Box
                                                      sx={{
                                                        p: 0.75,
                                                        bgcolor: "#f8f9fa",
                                                      }}
                                                    >
                                                      <Typography
                                                        sx={{
                                                          fontWeight: 600,
                                                          fontSize: "0.8rem",
                                                          mb: 0.5,
                                                        }}
                                                      >
                                                        {cardSel.cardName}
                                                      </Typography>
                                                      <CustomSelect
                                                        isMulti={true}
                                                        options={channelOptions}
                                                        value={channelOptions.filter(
                                                          (option) =>
                                                            cardSel.selectedChannels.includes(
                                                              Number(
                                                                option.value,
                                                              ),
                                                            ),
                                                        )}
                                                        onChange={(
                                                          selected,
                                                          action,
                                                        ) =>
                                                          handleChannelSelect(
                                                            selection.testName,
                                                            config.configName,
                                                            cardSel.cardName,
                                                            selected as MultiValue<SelectOption>,
                                                            action,
                                                          )
                                                        }
                                                        placeholder="Select channels..."
                                                      />
                                                    </Box>
                                                  </Paper>
                                                );
                                              },
                                            )}
                                          </Box>
                                        </AccordionDetails>
                                      </Accordion>
                                    ),
                                  )}
                                </AccordionDetails>
                              </Accordion>
                            ))}
                        </Box>
                      </>
                    )}

                    {/* Custom Query Tab Content */}
                    {activeTab === "customQuery" && (
                      <>
                        <Box sx={{ mb: 1.5 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: "#666", fontSize: "0.75rem" }}
                          >
                            Create custom channel operations with mathematical
                            expressions
                          </Typography>
                          {selectedCustomQueryTestsCount > 0 && (
                            <Chip
                              label={`${selectedCustomQueryTestsCount} test${
                                selectedCustomQueryTestsCount !== 1 ? "s" : ""
                              } selected`}
                              color="secondary"
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ mb: 1, fontWeight: 600, fontSize: "0.85rem" }}
                        >
                          Select Tests
                        </Typography>
                        <CustomSelect
                          isMulti={true}
                          options={testOptions}
                          value={testOptions.filter((option) =>
                            customQueryTests.some(
                              (sel) =>
                                sel.testName === option.value && sel.isSelected,
                            ),
                          )}
                          onChange={handleCustomQueryTestSelect}
                          placeholder="Search and select tests..."
                        />
                        <Box sx={{ mt: 2 }}>
                          {customQueryTests
                            .filter((sel) => sel.isSelected)
                            .map((selection) => (
                              <Accordion
                                key={selection.testName}
                                expanded={selection.isExpanded}
                                onChange={() =>
                                  handleCustomQueryTestAccordionToggle(
                                    selection.testName,
                                  )
                                }
                                sx={{
                                  mb: 1,
                                  border: "1px solid #e0e0e0",
                                  borderRadius: "6px !important",
                                }}
                              >
                                <AccordionSummary
                                  expandIcon={<ExpandMoreIcon />}
                                  sx={{
                                    bgcolor: selection.isSelected
                                      ? "#f3e5f5"
                                      : "#f8f9fa",
                                    borderRadius: "6px",
                                    "&.Mui-expanded": {
                                      borderRadius: "6px 6px 0 0",
                                    },
                                    minHeight: "40px",
                                    "& .MuiAccordionSummary-content": {
                                      my: 0.5,
                                    },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      width: "100%",
                                    }}
                                  >
                                    <Switch
                                      checked={selection.isSelected}
                                      onChange={() =>
                                        handleCustomQueryTestToggle(
                                          selection.testName,
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      size="small"
                                      color="secondary"
                                    />
                                    <Box sx={{ flexGrow: 1, ml: 1 }}>
                                      <Typography
                                        sx={{
                                          fontWeight: 600,
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        {selection.testName}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 1, pb: 1.5 }}>
                                  {selection.customQueryConfigs.map(
                                    (config: CustomQueryConfig) => {
                                      const validation =
                                        validateCustomQuery(config);
                                      return (
                                        <Accordion
                                          key={config.configName}
                                          expanded={config.isExpanded}
                                          onChange={() =>
                                            handleCustomQueryConfigAccordionToggle(
                                              selection.testName,
                                              config.configName,
                                            )
                                          }
                                          sx={{
                                            mb: 1,
                                            border: "1px solid #e0e0e0",
                                            borderRadius: "4px !important",
                                            ml: 2,
                                          }}
                                        >
                                          <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                            sx={{
                                              bgcolor: config.isExpanded
                                                ? "#fce4ec"
                                                : "#fafafa",
                                              borderRadius: "4px",
                                              "&.Mui-expanded": {
                                                borderRadius: "4px 4px 0 0",
                                              },
                                              minHeight: "36px",
                                              "& .MuiAccordionSummary-content":
                                                { my: 0.5 },
                                            }}
                                          >
                                            <Typography
                                              sx={{
                                                fontWeight: 600,
                                                fontSize: "0.8rem",
                                              }}
                                            >
                                              {config.configName}
                                            </Typography>
                                          </AccordionSummary>
                                          <AccordionDetails
                                            sx={{ pt: 1, pb: 1.5 }}
                                          >
                                            <Box sx={{ mb: 1.5 }}>
                                              <Typography
                                                variant="subtitle2"
                                                sx={{
                                                  mb: 0.5,
                                                  display: "flex",
                                                  alignItems: "center",
                                                  fontSize: "0.85rem",
                                                }}
                                              >
                                                <AccessTimeIcon
                                                  sx={{
                                                    mr: 0.5,
                                                    fontSize: "1rem",
                                                  }}
                                                />
                                                Time Range
                                              </Typography>
                                              <Box
                                                sx={{
                                                  display: "flex",
                                                  gap: 1,
                                                  mt: 0.5,
                                                  mb: 1,
                                                }}
                                              >
                                                <DateTimePicker<Dayjs>
                                                  label="Start Time"
                                                  value={config.startTime}
                                                  onChange={(value) =>
                                                    handleCustomQueryTimeChange(
                                                      selection.testName,
                                                      config.configName,
                                                      "startTime",
                                                      value,
                                                    )
                                                  }
                                                  renderInput={(params) => (
                                                    <TextField
                                                      {...params}
                                                      size="small"
                                                      fullWidth
                                                      InputProps={{
                                                        ...params.InputProps,
                                                        sx: {
                                                          fontSize: "0.75rem",
                                                        },
                                                      }}
                                                    />
                                                  )}
                                                  views={[
                                                    "year",
                                                    "month",
                                                    "day",
                                                    "hours",
                                                    "minutes",
                                                    "seconds",
                                                  ]}
                                                  ampm={false}
                                                />
                                                <DateTimePicker<Dayjs>
                                                  label="End Time"
                                                  value={config.endTime}
                                                  onChange={(value) =>
                                                    handleCustomQueryTimeChange(
                                                      selection.testName,
                                                      config.configName,
                                                      "endTime",
                                                      value,
                                                    )
                                                  }
                                                  renderInput={(params) => (
                                                    <TextField
                                                      {...params}
                                                      size="small"
                                                      fullWidth
                                                      InputProps={{
                                                        ...params.InputProps,
                                                        sx: {
                                                          fontSize: "0.75rem",
                                                        },
                                                      }}
                                                    />
                                                  )}
                                                  views={[
                                                    "year",
                                                    "month",
                                                    "day",
                                                    "hours",
                                                    "minutes",
                                                    "seconds",
                                                  ]}
                                                  ampm={false}
                                                />
                                              </Box>
                                              <Box
                                                sx={{ display: "flex", gap: 1 }}
                                              >
                                                <TextField
                                                  label="Start ms"
                                                  type="number"
                                                  size="small"
                                                  fullWidth
                                                  value={
                                                    config.startTime?.millisecond() ??
                                                    0
                                                  }
                                                  onChange={(e) => {
                                                    const ms = parseInt(
                                                      e.target.value,
                                                      10,
                                                    );
                                                    if (!isNaN(ms)) {
                                                      const newTime =
                                                        config.startTime?.millisecond(
                                                          ms,
                                                        ) || null;
                                                      handleCustomQueryTimeChange(
                                                        selection.testName,
                                                        config.configName,
                                                        "startTime",
                                                        newTime,
                                                      );
                                                    }
                                                  }}
                                                  inputProps={{
                                                    min: 0,
                                                    max: 999,
                                                    step: 1,
                                                  }}
                                                  helperText="0-999 ms"
                                                  sx={{
                                                    "& .MuiFormHelperText-root":
                                                      {
                                                        fontSize: "0.65rem",
                                                      },
                                                  }}
                                                />
                                                <TextField
                                                  label="End ms"
                                                  type="number"
                                                  size="small"
                                                  fullWidth
                                                  value={
                                                    config.endTime?.millisecond() ??
                                                    0
                                                  }
                                                  onChange={(e) => {
                                                    const ms = parseInt(
                                                      e.target.value,
                                                      10,
                                                    );
                                                    if (!isNaN(ms)) {
                                                      const newTime =
                                                        config.endTime?.millisecond(
                                                          ms,
                                                        ) || null;
                                                      handleCustomQueryTimeChange(
                                                        selection.testName,
                                                        config.configName,
                                                        "endTime",
                                                        newTime,
                                                      );
                                                    }
                                                  }}
                                                  inputProps={{
                                                    min: 0,
                                                    max: 999,
                                                    step: 1,
                                                  }}
                                                  helperText="0-999 ms"
                                                  sx={{
                                                    "& .MuiFormHelperText-root":
                                                      {
                                                        fontSize: "0.65rem",
                                                      },
                                                  }}
                                                />
                                              </Box>
                                            </Box>
                                            <Divider sx={{ my: 1 }} />
                                            <Box>
                                              <Typography
                                                variant="subtitle2"
                                                sx={{
                                                  mb: 1,
                                                  fontWeight: 600,
                                                  fontSize: "0.85rem",
                                                }}
                                              >
                                                Channel Selection
                                              </Typography>
                                              <Typography
                                                variant="caption"
                                                sx={{
                                                  fontSize: "0.65rem",
                                                  color: "#666",
                                                  mb: 0.5,
                                                  display: "block",
                                                }}
                                              >
                                                Select channels in order, then
                                                add operators between them
                                              </Typography>
                                              <CustomSelect
                                                isMulti={true}
                                                options={allChannelOptions}
                                                value={allChannelOptions.filter(
                                                  (option) =>
                                                    config.selectedChannels.includes(
                                                      Number(option.value),
                                                    ),
                                                )}
                                                onChange={(selected, action) =>
                                                  handleCustomQueryChannelSelect(
                                                    selection.testName,
                                                    config.configName,
                                                    selected as MultiValue<SelectOption>,
                                                  )
                                                }
                                                placeholder="Select channels..."
                                              />

                                              {config.selectedChannels.length >
                                                1 && (
                                                <Box sx={{ mt: 1.5 }}>
                                                  <Typography
                                                    variant="caption"
                                                    sx={{
                                                      fontSize: "0.65rem",
                                                      color: "#666",
                                                      mb: 0.5,
                                                      display: "block",
                                                    }}
                                                  >
                                                    Add operators between
                                                    channels (you need{" "}
                                                    {config.selectedChannels
                                                      .length - 1}{" "}
                                                    operator
                                                    {config.selectedChannels
                                                      .length -
                                                      1 !==
                                                    1
                                                      ? "s"
                                                      : ""}
                                                    )
                                                  </Typography>
                                                  <ButtonGroup
                                                    size="small"
                                                    sx={{ mb: 1 }}
                                                  >
                                                    <Button
                                                      onClick={() =>
                                                        handleAddOperator(
                                                          selection.testName,
                                                          config.configName,
                                                          "+",
                                                        )
                                                      }
                                                    >
                                                      + Add
                                                    </Button>
                                                    <Button
                                                      onClick={() =>
                                                        handleAddOperator(
                                                          selection.testName,
                                                          config.configName,
                                                          "-",
                                                        )
                                                      }
                                                    >
                                                      - Subtract
                                                    </Button>
                                                    <Button
                                                      onClick={() =>
                                                        handleAddOperator(
                                                          selection.testName,
                                                          config.configName,
                                                          "*",
                                                        )
                                                      }
                                                    >
                                                      × Multiply
                                                    </Button>
                                                    <Button
                                                      onClick={() =>
                                                        handleAddOperator(
                                                          selection.testName,
                                                          config.configName,
                                                          "/",
                                                        )
                                                      }
                                                    >
                                                      ÷ Divide
                                                    </Button>
                                                  </ButtonGroup>
                                                  <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() =>
                                                      handleClearOperators(
                                                        selection.testName,
                                                        config.configName,
                                                      )
                                                    }
                                                    sx={{ ml: 1 }}
                                                  >
                                                    Clear
                                                  </Button>
                                                </Box>
                                              )}

                                              <Box sx={{ mt: 1.5 }}>
                                                <Typography
                                                  variant="subtitle2"
                                                  sx={{
                                                    mb: 0.5,
                                                    fontWeight: 600,
                                                    fontSize: "0.85rem",
                                                  }}
                                                >
                                                  Expression Preview
                                                </Typography>
                                                <Paper
                                                  sx={{
                                                    p: 1,
                                                    bgcolor: "#f5f5f5",
                                                    border: "1px solid #ddd",
                                                    fontFamily: "monospace",
                                                    fontSize: "0.75rem",
                                                    minHeight: "30px",
                                                  }}
                                                >
                                                  {config.channelExpression ||
                                                    "No expression yet"}
                                                </Paper>
                                              </Box>

                                              <Box sx={{ mt: 1.5 }}>
                                                <Typography
                                                  variant="subtitle2"
                                                  sx={{
                                                    mb: 0.5,
                                                    fontWeight: 600,
                                                    fontSize: "0.85rem",
                                                  }}
                                                >
                                                  Output Channel Name
                                                </Typography>
                                                <TextField
                                                  fullWidth
                                                  size="small"
                                                  placeholder="e.g., 10306001 + 10306002"
                                                  value={
                                                    config.outputChannelName
                                                  }
                                                  onChange={(e) =>
                                                    handleOutputChannelNameChange(
                                                      selection.testName,
                                                      config.configName,
                                                      e.target.value,
                                                    )
                                                  }
                                                  sx={{
                                                    "& .MuiInputBase-input": {
                                                      fontSize: "0.75rem",
                                                    },
                                                  }}
                                                />
                                              </Box>
                                            </Box>
                                          </AccordionDetails>
                                        </Accordion>
                                      );
                                    },
                                  )}
                                </AccordionDetails>
                              </Accordion>
                            ))}
                        </Box>
                      </>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: "center",
                      bgcolor: "#fff3cd",
                      borderRadius: 1,
                      border: `1px solid #ffeaa7`,
                    }}
                  >
                    <Typography
                      color="warning.main"
                      sx={{ mb: 1, fontSize: "0.85rem" }}
                    >
                      No tests available.
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: "0.75rem" }}
                    >
                      {error ||
                        "Please check the API connection or try again later."}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      tests.length === 0 ||
                      (selectedTestsCount === 0 &&
                        selectedCustomQueryTestsCount === 0)
                    }
                    sx={{
                      minWidth: 80,
                      fontWeight: 600,
                      textTransform: "none",
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={clearAllSelections}
                    disabled={
                      loading ||
                      (selectedTestsCount === 0 &&
                        selectedCustomQueryTestsCount === 0)
                    }
                    sx={{ minWidth: 80, textTransform: "none" }}
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
