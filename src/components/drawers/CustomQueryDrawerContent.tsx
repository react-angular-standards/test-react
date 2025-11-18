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
  Divider,
  TextField,
  ButtonGroup,
  Paper,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import {
  CustomQueryTest,
  Test,
  SelectOption,
  CustomQueryConfig,
} from "../../types/historicalData.types";
import CustomSelect from "../../component/Widgets/CustomSelect";
import SmartExpressionInput from "../SmartExpressionInput";

interface CustomQueryDrawerContentProps {
  loading: boolean;
  tests: Test[];
  customQueryTests: CustomQueryTest[];
  testOptions: SelectOption[];
  allChannelOptions: SelectOption[];
  selectedCustomQueryTestsCount: number;
  error: string | null;
  onTestSelect: (selected: any, action: any) => void;
  onTestToggle: (testName: string) => void;
  onTestAccordionToggle: (testName: string) => void;
  onConfigAccordionToggle: (testName: string, configName: string) => void;
  onTimeChange: (
    testName: string,
    configName: string,
    field: "startTime" | "endTime",
    value: any,
  ) => void;
  onChannelSelect: (
    testName: string,
    configName: string,
    selected: any,
  ) => void;
  onAddOperator: (
    testName: string,
    configName: string,
    operator: string,
  ) => void;
  onClearOperators: (testName: string, configName: string) => void;
  onExpressionChange: (
    testName: string,
    configName: string,
    value: string,
  ) => void;
  onConstantValueChange: (
    testName: string,
    configName: string,
    value: string,
  ) => void;
  onAddConstant: (
    testName: string,
    configName: string,
    operator: string,
  ) => void;
  onOutputChannelNameChange: (
    testName: string,
    configName: string,
    value: string,
  ) => void;
  onSubmit: (pushToDB: boolean) => void;
  onClear: () => void;
}

const CustomQueryDrawerContent: React.FC<CustomQueryDrawerContentProps> = ({
  loading,
  tests,
  customQueryTests,
  testOptions,
  allChannelOptions,
  selectedCustomQueryTestsCount,
  error,
  onTestSelect,
  onTestToggle,
  onTestAccordionToggle,
  onConfigAccordionToggle,
  onTimeChange,
  onChannelSelect,
  onAddOperator,
  onClearOperators,
  onExpressionChange,
  onConstantValueChange,
  onAddConstant,
  onOutputChannelNameChange,
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
              Create custom channel operations with mathematical expressions
            </Typography>
            {selectedCustomQueryTestsCount > 0 && (
              <Chip
                label={`${selectedCustomQueryTestsCount} test${selectedCustomQueryTestsCount !== 1 ? "s" : ""} selected`}
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
              customQueryTests.some(
                (sel) => sel.testName === option.value && sel.isSelected,
              ),
            )}
            onChange={onTestSelect}
            placeholder="Search and select tests..."
          />

          <Box sx={{ mt: 2 }}>
            {customQueryTests
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
                      {selection.customQueryConfigs.map(
                        (config: CustomQueryConfig) => {
                          return (
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
                                  <Box sx={{ display: "flex", gap: 1 }}>
                                    <TextField
                                      label="Start ms"
                                      type="number"
                                      size="small"
                                      fullWidth
                                      value={
                                        config.startTime?.millisecond() ?? 0
                                      }
                                      onChange={(e) => {
                                        const ms = parseInt(e.target.value, 10);
                                        if (!isNaN(ms) && config.startTime) {
                                          const newTime =
                                            config.startTime.millisecond(ms);
                                          onTimeChange(
                                            selection.testName,
                                            config.configName,
                                            "startTime",
                                            newTime,
                                          );
                                        }
                                      }}
                                      inputProps={{ min: 0, max: 999, step: 1 }}
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
                                      value={config.endTime?.millisecond() ?? 0}
                                      onChange={(e) => {
                                        const ms = parseInt(e.target.value, 10);
                                        if (!isNaN(ms) && config.endTime) {
                                          const newTime =
                                            config.endTime.millisecond(ms);
                                          onTimeChange(
                                            selection.testName,
                                            config.configName,
                                            "endTime",
                                            newTime,
                                          );
                                        }
                                      }}
                                      inputProps={{ min: 0, max: 999, step: 1 }}
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
                                  <SmartExpressionInput
                                    expression={config.channelExpression}
                                    allChannelOptions={allChannelOptions}
                                    onChange={(value) =>
                                      onExpressionChange(
                                        selection.testName,
                                        config.configName,
                                        value
                                      )
                                    }
                                    placeholder="Type expression: e.g., id_1 + id_2 * 5"
                                  />

                                  

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
                                    placeholder="e.g., 10306001_+_10306002"
                                    value={config.outputChannelName}
                                    onChange={(e) =>
                                      onOutputChannelNameChange(
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
                              </AccordionDetails>
                            </Accordion>
                          );
                        },
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
          onClick={() => onSubmit(false)}
          disabled={
            loading || tests.length === 0 || selectedCustomQueryTestsCount === 0
          }
          sx={{ minWidth: 100, fontWeight: 600, textTransform: "none" }}
        >
          View
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => onSubmit(true)}
          disabled={
            loading || tests.length === 0 || selectedCustomQueryTestsCount === 0
          }
          sx={{ minWidth: 120, fontWeight: 600, textTransform: "none" }}
        >
          Save & View
        </Button>
        <Button
          variant="outlined"
          onClick={onClear}
          disabled={loading || selectedCustomQueryTestsCount === 0}
          sx={{ minWidth: 80, textTransform: "none" }}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default CustomQueryDrawerContent;
