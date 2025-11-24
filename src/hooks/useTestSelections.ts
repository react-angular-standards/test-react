import { useState, useEffect } from "react";
import dayjs, { Dayjs } from "dayjs";
import { SingleValue, MultiValue, ActionMeta } from "react-select";
import {
  Test,
  TestSelection,
  ConfigSelection,
  CardSelection,
  SelectOption,
} from "../types/historicalData.types";

const useTestSelections = (tests: Test[]) => {
  const [testSelections, setTestSelections] = useState<TestSelection[]>([]);

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
  };

  const handleChannelSelect = (
    testName: string,
    configName: string,
    cardName: string,
    selected: MultiValue<SelectOption> | null,
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

  const updateConfigSelections = (
    testName: string,
    configNames: string[],
    timeData?: { startTime: Dayjs | null; endTime: Dayjs | null },
  ) => {
    setTestSelections((prev) =>
      prev.map((sel) =>
        sel.testName === testName
          ? {
              ...sel,
              configSelections: configNames.map((configName: string) => {
                // Preserve existing config selection if it exists
                const existingConfig = sel.configSelections.find(
                  (c) => c.configName === configName,
                );
                return (
                  existingConfig || {
                    configName,
                    isExpanded: false,
                    cardSelections: [],
                    startTime: timeData?.startTime || null,
                    endTime: timeData?.endTime || null,
                  }
                );
              }),
            }
          : sel,
      ),
    );
  };

  const updateCardSelections = (
    testName: string,
    configName: string,
    cards: string[],
    timeData?: { startTime: Dayjs | null; endTime: Dayjs | null },
  ) => {
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
                        cardSelections: cards.map((c: string) => ({
                          cardName: c,
                          selectedChannels: [],
                        })),
                        startTime: timeData?.startTime || config.startTime,
                        endTime: timeData?.endTime || config.endTime,
                      }
                    : config,
              ),
            }
          : sel,
      ),
    );
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
  };

  return {
    testSelections,
    setTestSelections,
    handleTestSelect,
    handleTestToggle,
    handleTestAccordionToggle,
    handleConfigAccordionToggle,
    handleChannelSelect,
    handleTimeChange,
    updateConfigSelections,
    updateCardSelections,
    clearAllSelections,
  };
};

export default useTestSelections;
