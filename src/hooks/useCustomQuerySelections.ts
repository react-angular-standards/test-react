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

  const handleChannelExpressionChange = (
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
                    ? { ...config, channelExpression: value }
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
                channelExpression: "",
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
            channelExpression: "",
            outputChannelName: "",
            startTime: null,
            endTime: null,
          }),
        ),
      })),
    );
  };

  const validateChannelExpression = (
    expression: string,
  ): { isValid: boolean; error?: string } => {
    if (!expression.trim()) {
      return { isValid: false, error: "Expression cannot be empty" };
    }
    // Allow numbers, operators (+, -, *, /), parentheses, and spaces
    const validPattern = /^[\d\s+\-*/().]+$/;
    if (!validPattern.test(expression)) {
      return {
        isValid: false,
        error:
          "Expression can only contain numbers, operators (+, -, *, /), and parentheses",
      };
    }
    // Check for valid channel numbers
    const tokens = expression.split(/[\s+\-*/()]+/).filter((t) => t);
    const hasNumbers = tokens.some((token) => /^\d+$/.test(token));
    if (!hasNumbers) {
      return {
        isValid: false,
        error: "Expression must contain at least one channel number",
      };
    }
    return { isValid: true };
  };

  return {
    customQueryTests,
    setCustomQueryTests,
    handleCustomQueryTestSelect,
    handleCustomQueryTestToggle,
    handleCustomQueryTestAccordionToggle,
    handleCustomQueryConfigAccordionToggle,
    handleCustomQueryTimeChange,
    handleChannelExpressionChange,
    handleOutputChannelNameChange,
    updateCustomQueryConfigs,
    updateCustomQueryTime,
    clearAllCustomQuerySelections,
    validateChannelExpression,
  };
};

export default useCustomQuerySelections;
