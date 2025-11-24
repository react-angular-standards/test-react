import React from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  Paper,
  Divider,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { MultiValue } from "react-select";
import {
  TestSelection,
  Test,
  SelectOption,
  ConfigSelection,
  CardSelection,
} from "../../types/historicalData.types";
import CustomSelect from "../../component/Widgets/CustomSelect";

interface FilterDrawerContentProps {
  loading: boolean;
  tests: Test[];
  testSelections: TestSelection[];
  testOptions: SelectOption[];
  selectedTestsCount: number;
  cards: Record<string, string[]>;
  channels: Record<string, number[]>;
  error: string | null;
  onTestSelect: (selected: any) => void;
  onTestToggle: (testName: string) => void;
  onTestAccordionToggle: (testName: string) => void;
  onConfigAccordionToggle: (testName: string, configName: string) => void;
  onChannelSelect: (
    testName: string,
    configName: string,
    cardName: string,
    selected: any,
  ) => void;
  onTimeChange: (
    testName: string,
    configName: string,
    field: "startTime" | "endTime",
    value: any,
  ) => void;
  onSubmit: () => void;
  onClear: () => void;
}

const FilterDrawerContent: React.FC<FilterDrawerContentProps> = ({
  loading,
  tests,
  testSelections,
  testOptions,
  selectedTestsCount,
  cards,
  channels,
  error,
  onTestSelect,
  onTestToggle,
  onTestAccordionToggle,
  onConfigAccordionToggle,
  onChannelSelect,
  onTimeChange,
  onSubmit,
  onClear,
}) => {
  return (
    <Box sx={{ width: "100%" }}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={24} />
          <Typography sx={{ ml: 1, fontSize: "0.75rem" }}>
            Loading test data...
          </Typography>
        </Box>
      ) : tests.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="body2"
              sx={{ color: "#666", fontSize: "0.75rem" }}
            >
              Select tests, configure channels, and set time ranges
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
                (sel) => sel.testName === option.value && sel.isSelected,
              ),
            )}
            onChange={onTestSelect}
            placeholder="Search and select tests..."
          />
          <Box sx={{ mt: 2 }}>
            {testSelections
              .filter((sel) => sel.isSelected)
              .map((selection) => {
                const test = tests.find(
                  (t) => t.TestName === selection.testName,
                );
                if (!test) return null;

                return (
                  <Accordion
                    key={selection.testName}
                    expanded={selection.isExpanded}
                    onChange={() => onTestAccordionToggle(selection.testName)}
                    sx={{
                      mb: 1,
                      border: "1px solid #e0e0e0",
                      borderRadius: "6px !important",
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        bgcolor: selection.isSelected ? "#e3f2fd" : "#f8f9fa",
                        borderRadius: "6px",
                        "&.Mui-expanded": { borderRadius: "6px 6px 0 0" },
                        minHeight: "40px",
                        "& .MuiAccordionSummary-content": { my: 0.5 },
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
                          onChange={() => onTestToggle(selection.testName)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          color="primary"
                        />
                        <Box sx={{ flexGrow: 1, ml: 1 }}>
                          <Typography
                            sx={{ fontWeight: 600, fontSize: "0.85rem" }}
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
                              onConfigAccordionToggle(
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
                                "& .MuiAccordionSummary-content": { my: 0.5 },
                              }}
                            >
                              <Typography
                                sx={{ fontWeight: 600, fontSize: "0.8rem" }}
                              >
                                {config.configName}
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 1, pb: 1.5 }}>
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
                                    sx={{ mr: 0.5, fontSize: "1rem" }}
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
                                  <DateTimePicker
                                    label="Start Time"
                                    value={config.startTime}
                                    onChange={(value) =>
                                      onTimeChange(
                                        selection.testName,
                                        config.configName,
                                        "startTime",
                                        value,
                                      )
                                    }
                                    slotProps={{
                                      textField: {
                                        size: "small",
                                        fullWidth: true,
                                      },
                                    }}
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
                                  <DateTimePicker
                                    label="End Time"
                                    value={config.endTime}
                                    onChange={(value) =>
                                      onTimeChange(
                                        selection.testName,
                                        config.configName,
                                        "endTime",
                                        value,
                                      )
                                    }
                                    slotProps={{
                                      textField: {
                                        size: "small",
                                        fullWidth: true,
                                      },
                                    }}
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
                                          border: "1px solid #e0e0e0",
                                          borderRadius: 1,
                                        }}
                                      >
                                        <Box
                                          sx={{ p: 0.75, bgcolor: "#f8f9fa" }}
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
                                                  Number(option.value),
                                                ),
                                            )}
                                            onChange={(selected) =>
                                              onChannelSelect(
                                                selection.testName,
                                                config.configName,
                                                cardSel.cardName,
                                                selected as MultiValue<SelectOption>,
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
                );
              })}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            p: 2,
            textAlign: "center",
            bgcolor: "#fff3cd",
            borderRadius: 1,
            border: "1px solid #ffeaa7",
          }}
        >
          <Typography color="warning.main" sx={{ mb: 1, fontSize: "0.85rem" }}>
            No tests available.
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: "0.75rem" }}
          >
            {error || "Please check the API connection or try again later."}
          </Typography>
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={onSubmit}
          disabled={loading || tests.length === 0 || selectedTestsCount === 0}
          sx={{ minWidth: 80, fontWeight: 600, textTransform: "none" }}
        >
          Apply
        </Button>
        <Button
          variant="outlined"
          onClick={onClear}
          disabled={loading || selectedTestsCount === 0}
          sx={{ minWidth: 80, textTransform: "none" }}
        >
          Clear
        </Button>
      </Box>
    </Box>
  );
};

export default FilterDrawerContent;
