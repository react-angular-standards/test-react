import { useState, useEffect } from "react";
import { SingleValue, MultiValue, ActionMeta } from "react-select";
import { Dayjs } from "dayjs";
import {
  Test,
  CustomQueryTest,
  CustomQueryConfig,
  SelectOption,
} from "../types/historicalData.types";

const useCustomQuerySelections = (tests: Test[]) => {
  const [customQueryTests, setCustomQueryTests] = useState<CustomQueryTest[]>(
    [],
  );

  // Initialize custom query tests
  useEffect(() => {
    if (tests.length > 0) {
      const initialCustomQueryTests: CustomQueryTest[] = tests.map((test) => ({
        testName: test.TestName,
        isSelected: false,
        isExpanded: false,
        customQueryConfigs: [],
      }));
      setCustomQueryTests(initialCustomQueryTests);
    }
  }, [tests]);

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

  // Build channel expression from selected channels and operators
  const buildChannelExpression = (
    channels: number[],
    operators: string[],
  ): string => {
    if (channels.length === 0) return "";
    if (channels.length === 1) return `id_${channels[0]}`;
    let expression = `id_${channels[0]}`;
    for (let i = 1; i < channels.length; i++) {
      const operator = operators[i - 1] || "+";
      expression += ` ${operator} id_${channels[i]}`;
    }
    return expression;
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

  // Handle constant value change
  const handleConstantValueChange = (
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
                    ? { ...config, constantValue: value }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  // Add constant to expression
  const handleAddConstant = (
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
                  if (
                    config.configName === configName &&
                    config.constantValue
                  ) {
                    const newExpression = config.channelExpression
                      ? `${config.channelExpression} ${operator} ${config.constantValue}`
                      : config.constantValue;
                    return {
                      ...config,
                      channelExpression: newExpression,
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

  const updateCustomQueryConfigs = (
    testName: string,
    configNames: string[],
  ) => {
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
                constantValue: "",
                outputChannelName: "",
                startTime: null,
                endTime: null,
              })),
            }
          : sel,
      ),
    );
  };

  const updateCustomQueryTime = (
    testName: string,
    configName: string,
    timeData: { startTime: Dayjs | null; endTime: Dayjs | null },
  ) => {
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
                        startTime: timeData.startTime || config.startTime,
                        endTime: timeData.endTime || config.endTime,
                      }
                    : config,
              ),
            }
          : sel,
      ),
    );
  };

  const clearAllCustomQuerySelections = () => {
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
            constantValue: "",
            outputChannelName: "",
            startTime: null,
            endTime: null,
          }),
        ),
      })),
    );
  };

  return {
    customQueryTests,
    setCustomQueryTests,
    handleCustomQueryTestSelect,
    handleCustomQueryTestToggle,
    handleCustomQueryTestAccordionToggle,
    handleCustomQueryConfigAccordionToggle,
    handleCustomQueryTimeChange,
    handleCustomQueryChannelSelect,
    handleAddOperator,
    handleClearOperators,
    handleConstantValueChange,
    handleAddConstant,
    handleOutputChannelNameChange,
    updateCustomQueryConfigs,
    updateCustomQueryTime,
    clearAllCustomQuerySelections,
  };
};

export default useCustomQuerySelections;
