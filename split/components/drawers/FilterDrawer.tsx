import React from "react";
import {
  Drawer,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from "@mui/material";
import { TestSelection, Test, SelectOption } from "../../types/historicalData.types";
import { ConfigTimeRange } from "../../hooks/useHistoricalData";
import CustomSelect from "../../../component/Widgets/CustomSelect";
import FilterTestAccordion from "./FilterTestAccordion";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  tests: Test[];
  testSelections: TestSelection[];
  testOptions: SelectOption[];
  selectedTestsCount: number;
  cards: Record<string, string[]>;
  channels: Record<string, number[]>;
  configTimeRanges: Record<string, ConfigTimeRange | null>;
  error: string | null;
  onTestSelect: (selected: any, action: any) => void;
  onTestToggle: (testName: string) => void;
  onTestAccordionToggle: (testName: string) => void;
  onConfigAccordionToggle: (testName: string, configName: string) => void;
  onChannelSelect: (testName: string, configName: string, cardName: string, selected: any, action: any) => void;
  onTimeChange: (testName: string, configName: string, field: "startTime" | "endTime", value: any) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFetchTestConfigDetails: (testName: string, configName: string) => void;
}

const FilterDrawer: React.FC<FilterDrawerProps> = ({
  open,
  onClose,
  loading,
  tests,
  testSelections,
  testOptions,
  selectedTestsCount,
  cards,
  channels,
  configTimeRanges,
  error,
  onTestSelect,
  onTestToggle,
  onTestAccordionToggle,
  onConfigAccordionToggle,
  onChannelSelect,
  onTimeChange,
  onSubmit,
  onClear,
  onFetchTestConfigDetails,
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        width: "40%",
        "& .MuiDrawer-paper": { width: "40%", boxSizing: "border-box" },
      }}
    >
      <Box sx={{ width: "100%", p: 2 }}>
        <Typography
          variant="h6"
          sx={{
            fontSize: "1rem",
            mb: 1.5,
            color: "#1976d2",
            fontWeight: 600,
            borderBottom: "2px solid #1976d2",
            pb: 0.5,
          }}
        >
          Filter Data
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
            <Typography sx={{ ml: 1, fontSize: "0.75rem" }}>
              Loading test data...
            </Typography>
          </Box>
        ) : tests.length > 0 ? (
          <Box sx={{ mb: 2, maxHeight: "70vh", overflow: "auto" }}>
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ color: "#666", fontSize: "0.75rem" }}>
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

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: "0.85rem" }}>
              Select Tests
            </Typography>

            <CustomSelect
              isMulti={true}
              options={testOptions}
              value={testOptions.filter((option) =>
                testSelections.some((sel) => sel.testName === option.value && sel.isSelected)
              )}
              onChange={onTestSelect}
              placeholder="Search and select tests..."
            />

            <Box sx={{ mt: 2 }}>
              {testSelections
                .filter((sel) => sel.isSelected)
                .map((selection) => {
                  const test = tests.find((t) => t.TestName === selection.testName);
                  if (!test) return null;

                  return (
                    <FilterTestAccordion
                      key={selection.testName}
                      selection={selection}
                      test={test}
                      cards={cards}
                      channels={channels}
                      configTimeRanges={configTimeRanges}
                      onTestToggle={onTestToggle}
                      onTestAccordionToggle={onTestAccordionToggle}
                      onConfigAccordionToggle={onConfigAccordionToggle}
                      onChannelSelect={onChannelSelect}
                      onTimeChange={onTimeChange}
                      onFetchTestConfigDetails={onFetchTestConfigDetails}
                    />
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
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
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
    </Drawer>
  );
};

export default FilterDrawer;
