/** @format */

import { UrlConstant } from '../../util/UrlConstans';
import { getRandomColorScheme } from '../../Widgets/CustomStyle';
import {
  Channel,
  Option,
  ChannelConfigApiResponse,
  UpdateChannelsFunc,
  UpdateChannelSelectionListFunc,
} from '../types/ConfiguredChannelSchema';

export const fetchConfiguredChannels = async (
  setLoading: (st: boolean) => void,
  setError: (st: string | null) => void,
  upateContinuousChannels?: UpdateChannelSelectionListFunc,
  upateDiscreteInChannels?: UpdateChannelsFunc,
  upateDiscreteOutChannels?: UpdateChannelsFunc,
  upateRelayChannels?: UpdateChannelsFunc,
  upadteAnalogOutput?: UpdateChannelsFunc
): Promise<void> => {
  if (
    !upateContinuousChannels &&
    !upateDiscreteInChannels &&
    !upateDiscreteOutChannels &&
    !upateRelayChannels &&
    !upadteAnalogOutput
  ) {
    console.log('Pass atleast one function to update channel');
    return;
  }
  setLoading(true);
  try {
    console.log('Starting data fetch...');
    const apiURL = UrlConstant.CONFIGURED_CHANNELS;
    console.log(apiURL);
    const response = await fetch(apiURL);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data: ChannelConfigApiResponse = await response.json();
    const chassisName = data?.Details?.Test_Details?.Chassis?.system_name;
    const inputModules = data?.Details?.Test_Details?.Chassis?.InputModule;
    const discreteInputChannel: Channel[] = [];
    const discreteOutputChannel: Channel[] = [];
    const relayOutputChannels: Channel[] = [];
    const continuousDataChannel: Option[] = [];
    const analogOutputDataChannel: Channel[] = [];
    if (inputModules && Array.isArray(inputModules)) {
      inputModules.forEach((module, moduleIndex: number) => {
        if (
          module.enabled !== 'YES' ||
          (module.node_type === 'Discrete' &&
            !upateDiscreteInChannels &&
            !upateDiscreteOutChannels) ||
          (module.node_type !== 'Discrete' &&
            !upateContinuousChannels &&
            !upadteAnalogOutput &&
            !upateRelayChannels)
        ) {
          return;
        }

        if (Array.isArray(module.Card)) {
          module.Card.forEach((card, cardIndex: number) => {
            if (card.enabled !== 'YES') {
              return;
            }
            if (Array.isArray(card.Channel)) {
              if (
                module.node_type !== 'Discrete' &&
                module.node_type !== 'Relay' &&
                module.node_type !== 'Voltage_Output' &&
                upateContinuousChannels &&
                !upadteAnalogOutput
              ) {
                continuousDataChannel.push({
                  value: `Select All - Card-${card.Task_id}`,
                  label: `${module.node_type || 'Unknown Module'} - ${card.Module_Model}`,
                  chassisId: chassisName,
                  cardId: card.Task_id,
                  isSelectAll: true,
                  channelName: card.Module_Model,
                });
              }
              card.Channel.forEach((channel) => {
                if (channel.enabled !== 'YES') {
                  return;
                }
                const channelId = Number(channel.card_task_id + channel.id).toString();
                if (module.node_type === 'Discrete') {
                  const processedChannel: Channel = {
                    ...channel,
                    channel_number: channelId,
                    colorScheme: getRandomColorScheme(),
                    uniqueId: Number(channelId),
                    channelState: 'LOW',
                  };
                  if (
                    upateDiscreteInChannels &&
                    processedChannel.channel_type === 'INPUT'
                  ) {
                    discreteInputChannel.push(processedChannel);
                  } else if (
                    upateDiscreteOutChannels &&
                    processedChannel.channel_type === 'OUTPUT'
                  ) {
                    discreteOutputChannel.push(processedChannel);
                  }
                } else if (module.node_type === 'Relay') {
                  const processedChannel: Channel = {
                    ...channel,
                    channel_number: channelId,
                    channel_type: 'OUTPUT',
                    colorScheme: getRandomColorScheme(),
                    uniqueId: Number(channelId),
                    channelState: 'LOW',
                  };
                  discreteOutputChannel.push(processedChannel);
                } else if (module.node_type === 'Voltage_Output' && upadteAnalogOutput) {
                  analogOutputDataChannel.push({
                    ...channel,
                    channel_number: channelId,
                    colorScheme: getRandomColorScheme(),
                    uniqueId: Number(channelId),
                    channelState: 'LOW',
                  });
                } else if (
                  upateContinuousChannels &&
                  module.node_type !== 'Voltage_Output'
                ) {
                  continuousDataChannel.push({
                    value: channelId + ' - ' + channel.channel_name,
                    label: channelId + ' - ' + channel.channel_name,
                    chassisId: chassisName,
                    cardId: card.Task_id,
                    isSelectAll: false,
                    channelName: channel.channel_name ?? 'Unknown',
                  });
                }
              });
            } else {
              console.log(`No channels found in Card ${cardIndex}`);
            }
          });
          if (upateDiscreteInChannels) {
            upateDiscreteInChannels(
              discreteInputChannel.sort((c1, c2) => c1.uniqueId - c2.uniqueId)
            );
          }
          if (upateDiscreteOutChannels) {
            upateDiscreteOutChannels(
              discreteOutputChannel.sort((c1, c2) => c1.uniqueId - c2.uniqueId)
            );
          }
          if (upateRelayChannels) {
            upateRelayChannels(
              relayOutputChannels.sort((c1, c2) => c1.uniqueId - c2.uniqueId)
            );
          }
          if (upateContinuousChannels) {
            upateContinuousChannels(continuousDataChannel);
          }
          if (upadteAnalogOutput) {
            upadteAnalogOutput(analogOutputDataChannel);
          }
        } else {
          console.log(`No cards found in Module ${moduleIndex}`);
        }
      });
    } else {
      console.log('No valid InputModule data found. Checking for alternative structures...');
      setError('No valid InputModule data found');
    }
  } catch (err) {
    console.error('Error in fetchData:', err);
    setError(`Error in fetchData:${err}`);
  }
  setLoading(false);
};
