// ============================================================================
// FILE: types/historicalData.types.ts
// ============================================================================

import { Dayjs } from "dayjs";

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

export interface SeriesData {
  type: string;
  name: string;
  showInLegend: boolean;
  visible: boolean;
  dataPoints: { x: Date; y: number }[];
}

// ============================================================================
// FILE: theme/muiTheme.ts
// ============================================================================

import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
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

// ============================================================================
// FILE: utils/csvExport.ts
// ============================================================================

import dayjs from "dayjs";

interface Column {
  field: string;
  headerName?: string;
}

/**
 * Exports data to CSV format and triggers download
 */
export const exportToCSV = (
  data: DataRow[],
  columns: Column[],
  filename?: string
): { success: boolean; error?: string } => {
  if (data.length === 0) {
    return { success: false, error: "No data available to export" };
  }

  try {
    const headers = columns.map((col) => col.headerName || col.field);
    const headerRow = headers.join(",");

    const dataRows = data.map((row) => {
      return columns
        .map((col) => {
          const value = row[col.field];
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

    const csvContent = [headerRow, ...dataRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
    const finalFilename = filename
      ? `${filename}_${timestamp}.csv`
      : `export_${timestamp}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", finalFilename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Failed to export CSV: ${err.message}` };
  }
};

// ============================================================================
// FILE: services/historicalDataApi.ts
// ============================================================================

/**
 * API service for Historical Data operations
 */
export class HistoricalDataApi {
  private apiBase: string;

  constructor(apiBase: string) {
    this.apiBase = apiBase;
  }

  async fetchTestNames(): Promise<string[]> {
    const response = await fetch(`${this.apiBase}/all-test-names`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.TestName || [];
  }

  async fetchConfigNames(testName: string): Promise<string[]> {
    const response = await fetch(`${this.apiBase}/config-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TestName: testName }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.ConfigName || [];
  }

  async fetchTestConfigDetails(
    testName: string,
    configName: string
  ): Promise<TestConfigDetailsResponse> {
    const response = await fetch(`${this.apiBase}/test-config-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TestName: testName, ConfigName: configName }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  }

  async fetchFilteredData(
    requestBody: FilterRequestBody
  ): Promise<{ data: any[]; totalCount: number }> {
    const response = await fetch(`${this.apiBase}/filter`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    return {
      data: result.data || [],
      totalCount: result.totalCount || 0,
    };
  }

  async fetchCustomQueryData(
    requestBody: CustomQueryRequest
  ): Promise<{ data: any[]; totalCount: number }> {
    const response = await fetch(`${this.apiBase}/custom-query`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    return {
      data: result.data || [],
      totalCount: result.totalCount || 0,
    };
  }
}

// ============================================================================
// FILE: pages/HistoricalData.tsx (MAIN COMPONENT)
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
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
import DownloadIcon from "@mui/icons-material/Download";
import { ThemeProvider } from "@mui/material/styles";
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

// Import types from above
// import { ... } from "../types/historicalData.types";
// import { muiTheme } from "../theme/muiTheme";
// import { exportToCSV } from "../utils/csvExport";
// import { HistoricalDataApi } from "../services/historicalDataApi";

const CanvasJSChart = CanvasJSReact.CanvasJSChart;

const HistoricalData: React.FC = () => {
  // State management
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"filter" | "customQuery">("filter");
  const [tests, setTests] = useState<Test[]>([]);
  const [configs, setConfigs] = useState<Record<string, string[]>>({});
  const [cards, setCards] = useState<Record<string, string[]>>({});
  const [channels, setChannels] = useState<Record<string, number[]>>({});
  const [allChannels, setAllChannels] = useState<number[]>([]);
  const [filteredData, setFilteredData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSelections, setTestSelections] = useState<TestSelection[]>([]);
  const [selectedConfigs, setSelectedConfigs] = useState<SelectedConfig[]>([]);
  const [customQueryTests, setCustomQueryTests] = useState<CustomQueryTest[]>([]);
  const [selectedCustomQueries, setSelectedCustomQueries] = useState<
    { testName: string; configName: string; config: CustomQueryConfig }[]
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [localPage, setLocalPage] = useState<number | string>(1);
  const [pageSize, setPageSize] = useState(10);
  const [localPageSize, setLocalPageSize] = useState<string>("10");
  const [view, setView] = useState<"table" | "plot">("table");

  // API instance
  const apiBase = UrlConstant.HISTORICAL_DATA_API;
  const api = useMemo(() => new HistoricalDataApi(apiBase), [apiBase]);

  // CSV Export handler
  const handleExportCSV = () => {
    const testName = selectedConfigs.length > 0 ? selectedConfigs[0].testName : undefined;
    const result = exportToCSV(filteredData, columns, testName);

    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  // ... rest of your component logic from asit.tsx ...

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <Container maxWidth={false} disableGutters sx={{ mt: 4 }}>
          {/* Export Button */}
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

          {/* Rest of your JSX... */}
        </Container>
      </ThemeProvider>
    </LocalizationProvider>
  );
};

export default HistoricalData;

// ============================================================================
// END OF FILE STRUCTURE
// ============================================================================
//
// INSTRUCTIONS FOR SPLITTING:
//
// 1. Create file: src/types/historicalData.types.ts
//    - Copy everything between the first ============ markers
//
// 2. Create file: src/theme/muiTheme.ts
//    - Copy the theme section
//
// 3. Create file: src/utils/csvExport.ts
//    - Copy the CSV export function section
//
// 4. Create file: src/services/historicalDataApi.ts
//    - Copy the API service class section
//
// 5. Update file: src/pages/HistoricalData.tsx
//    - Copy the main component section
//    - Uncomment the imports at the top
//    - Keep all your existing component logic from asit.tsx
//
// ============================================================================
