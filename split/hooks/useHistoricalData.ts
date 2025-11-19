import { useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  Test,
  TestSelection,
  CustomQueryTest,
  ConfigSelection,
  CustomQueryConfig,
  SelectedConfig,
  DataRow,
  FilterRequestBody,
  CustomQueryRequest,
} from "../types/historicalData.types";

const useHistoricalData = (apiBase: string) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [configs, setConfigs] = useState<Record<string, string[]>>({});
  const [cards, setCards] = useState<Record<string, string[]>>({});
  const [channels, setChannels] = useState<Record<string, number[]>>({});
  const [allChannels, setAllChannels] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all test names
  useEffect(() => {
    const fetchTestNames = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBase}/all-test-names`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
  }, [apiBase]);

  const fetchConfigs = async (testName: string) => {
    try {
      const response = await fetch(`${apiBase}/config-names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ TestName: testName }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const configNames = data.ConfigName || [];
      setConfigs((prev) => ({ ...prev, [testName]: configNames }));
      return configNames;
    } catch (err: any) {
      setError(`Failed to fetch configurations for test ${testName}.`);
      return [];
    }
  };

  const fetchTestConfigDetails = async (testName: string, configName: string) => {
    const key = `${testName}_${configName}`;
    if (!cards[key]) {
      try {
        const response = await fetch(
          `${apiBase}/test-config-details?TestName=${encodeURIComponent(
            testName
          )}&ConfigName=${encodeURIComponent(configName)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const cardList = data.details.map((detail: any) => detail.cardType);
        setCards((prev) => ({ ...prev, [key]: cardList }));

        const channelsMap: Record<string, number[]> = {};
        const allChannelsSet = new Set<number>();
        data.details.forEach((detail: any) => {
          channelsMap[`${testName}_${configName}_${detail.cardType}`] = detail.channels;
          detail.channels.forEach((ch: number) => allChannelsSet.add(ch));
        });
        setChannels((prev) => ({ ...prev, ...channelsMap }));
        setAllChannels(Array.from(allChannelsSet).sort((a, b) => a - b));

        return {
          cards: cardList,
          startTime: data.testStartTime ? dayjs(data.testStartTime) : null,
          endTime: data.testEndTime ? dayjs(data.testEndTime) : null,
        };
      } catch (err: any) {
        setError(`Failed to fetch test config details for ${testName} - ${configName}.`);
        return null;
      }
    }
    return null;
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
        .filter((cardSel) => cardSel.selectedChannels.length > 0)
        .map((cardSel) => ({
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

    const response = await fetch(`${apiBase}/filter`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
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
  };

  const fetchCustomQueryData = async (
    testName: string,
    configName: string,
    config: CustomQueryConfig
  ) => {
    const requestBody: CustomQueryRequest = {
      TestName: testName,
      ConfigName: configName,
      ChannelOperation: config.channelExpression,
      outputChannelName: config.outputChannelName,
      startTime: config.startTime?.toISOString(),
      endTime: config.endTime?.toISOString(),
    };

    const response = await fetch(`${apiBase}/custom-query`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    return (result || []).map((row: any, index: number) => ({
      ...row,
      id: `custom_${testName}_${configName}_${index}`,
    }));
  };

  return {
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
  };
};

export default useHistoricalData;
