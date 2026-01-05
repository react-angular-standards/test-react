/** @format */

// Define interface types
export type DiscreteChannelState = 'HIGH' | 'LOW';
export type SupportedChannelTypes = 'Discrete' | 'Continuous';

export type UpdateChannelsFunc = (channels: Channel[]) => void;
export type UpdateChannelSelectionListFunc = (groups: Option[]) => void;

export interface Channel {
  Card_Type?: string;
  card_task_id: string;
  channel_name?: string;
  channelName?: string;
  channel_number: string;
  enabled?: string;
  graph_id?: string;
  id?: string;
  name?: string;
  type?: string;
  channel_type?: string;
  uniqueId: number;
  colorScheme?: string;
  channelState?: DiscreteChannelState;
  node_type?: string;
  Waveform_Type?: string;
  Waveform_type?: string;
  Waveform_Frequency?: string;
  Waveform_Amplitude?: string;
  Waveform_Time_Limit?: string;
}

export interface ChannelGroup {
  id: string;
  name: string;
  channels: string[];
}

export interface ChannelConfigApiResponse {
  Details?: {
    Test_Details?: {
      Chassis?: {
        system_name?: string;
        InputModule?: Array<{
          node_type: string;
          enabled: string;
          Card: Array<{
            enabled: string;
            Task_id: string;
            node_type: string;
            Module_Model: string;
            Channel: Channel[];
          }>;
        }>;
      };
    };
  };
  [key: string]: any;
}

export interface Option {
  value: string;
  label: string;
  chassisId?: string;
  cardId?: string;
  isSelectAll?: boolean;
  isCard?: boolean;
  channelName: string;
  yAxisIndex?: number;
  unit?: string;
}
