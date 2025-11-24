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
  constantValue: string;
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
  pushToDB: boolean;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
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
