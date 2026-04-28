import React from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { Dayjs } from "dayjs";
import { TestSelection, Test, ConfigSelection } from "../../types/historicalData.types";
import { ConfigTimeRange } from "../../hooks/useHistoricalData";
import CustomSelect from "../../../component/Widgets/CustomSelect";

interface FilterTestAccordionProps {
  selection: TestSelection;
  test: Test;
  cards: Record<string, string[]>;
  channels: Record<string, number[]>;
  configTimeRanges: Record<string, ConfigTimeRange | null>;
  onTestToggle: (testName: string) => void;
  onTestAccordionToggle: (testName: string) => void;
  onConfigAccordionToggle: (testName: string, configName: string) => void;
  onChannelSelect: (testName: string, configName: string, cardName: string, selected: any, action: any) => void;
  onTimeChange: (testName: string, configName: string, field: "startTime" | "endTime", value: Dayjs | null) => void;
  onFetchTestConfigDetails: (testName: string, configName: string) => void;
}

const FilterTestAccordion: React.FC<FilterTestAccordionProps> = ({
  selection,
  test,
  cards,
  channels,
  configTimeRanges,
  onTestAccordionToggle,
  onConfigAccordionToggle,
  onChannelSelect,
  onTimeChange,
  onFetchTestConfigDetails,
}) => {
  return (
    <Accordion
      expanded={selection.isExpanded}
      onChange={() => onTestAccordionToggle(selection.testName)}
      sx={{ mb: 1, border: "1px solid #e0e0e0", boxShadow: "none" }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#f5f5f5" }}>
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
          {test.TestName}
        </Typography>
        {selection.configSelections.length > 0 && (
          <Chip
            label={`${selection.configSelections.length} config(s)`}
            size="small"
            color="primary"
            sx={{ ml: 1, fontSize: "0.7rem" }}
          />
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        {selection.configSelections.map((config: ConfigSelection) => {
          const key = `${selection.testName}_${config.configName}`;
          const range = configTimeRanges[key] ?? null;
          const cardList = cards[key] ?? [];

          return (
            <Accordion
              key={config.configName}
              expanded={config.isExpanded}
              onChange={() => {
                onConfigAccordionToggle(selection.testName, config.configName);
                onFetchTestConfigDetails(selection.testName, config.configName);
              }}
              sx={{ mb: 1, border: "1px solid #e8e8e8", boxShadow: "none" }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#fafafa" }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 500 }}>
                  {config.configName}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1.5 }}>
                {/* Time range section */}
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: "0.9rem", mr: 0.5, color: "#666" }} />
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>
                    Time Range
                  </Typography>
                  {range && (
                    <Typography sx={{ fontSize: "0.65rem", color: "#999", ml: 1 }}>
                      ({range.min.format("MM/DD HH:mm:ss")} – {range.max.format("MM/DD HH:mm:ss")})
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
                  <DateTimePicker<Dayjs>
                    label="Start Time"
                    value={config.startTime}
                    minDateTime={range?.min}
                    maxDateTime={config.endTime ?? range?.max}
                    onChange={(value) =>
                      onTimeChange(selection.testName, config.configName, "startTime", value)
                    }
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true,
                        error: !!(config.startTime && config.endTime && config.startTime.isAfter(config.endTime)),
                        helperText:
                          config.startTime && config.endTime && config.startTime.isAfter(config.endTime)
                            ? "Start must be before end"
                            : range && config.startTime && config.startTime.isBefore(range.min)
                            ? "Before valid range"
                            : undefined,
                        sx: { "& input": { fontSize: "0.75rem" } },
                      },
                      day: {
                        sx: {
                          // Disabled days: muted background + strikethrough
                          "&.Mui-disabled": {
                            backgroundColor: "#f0f0f0",
                            color: "#bdbdbd !important",
                            textDecoration: "line-through",
                            borderRadius: "50%",
                            opacity: 0.6,
                          },
                        },
                      },
                    }}
                    views={["year", "month", "day", "hours", "minutes", "seconds"]}
                    ampm={false}
                  />
                  <DateTimePicker<Dayjs>
                    label="End Time"
                    value={config.endTime}
                    minDateTime={config.startTime ?? range?.min}
                    maxDateTime={range?.max}
                    onChange={(value) =>
                      onTimeChange(selection.testName, config.configName, "endTime", value)
                    }
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true,
                        error: !!(config.startTime && config.endTime && config.endTime.isBefore(config.startTime)),
                        helperText:
                          config.startTime && config.endTime && config.endTime.isBefore(config.startTime)
                            ? "End must be after start"
                            : range && config.endTime && config.endTime.isAfter(range.max)
                            ? "Exceeds valid range"
                            : undefined,
                        sx: { "& input": { fontSize: "0.75rem" } },
                      },
                      day: {
                        sx: {
                          "&.Mui-disabled": {
                            backgroundColor: "#f0f0f0",
                            color: "#bdbdbd !important",
                            textDecoration: "line-through",
                            borderRadius: "50%",
                            opacity: 0.6,
                          },
                        },
                      },
                    }}
                    views={["year", "month", "day", "hours", "minutes", "seconds"]}
                    ampm={false}
                  />
                </Box>

                {/* Card + channel selection */}
                {cardList.map((cardName) => {
                  const cardKey = `${selection.testName}_${config.configName}_${cardName}`;
                  const cardChannels = channels[cardKey] ?? [];
                  const channelOptions = cardChannels.map((ch) => ({
                    value: ch,
                    label: String(ch),
                  }));
                  const cardSel = config.cardSelections.find((cs) => cs.cardName === cardName);
                  const selectedValues = channelOptions.filter((opt) =>
                    cardSel?.selectedChannels.includes(Number(opt.value))
                  );

                  return (
                    <Box key={cardName} sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.5, color: "#444" }}>
                        {cardName}
                      </Typography>
                      <CustomSelect
                        isMulti
                        options={channelOptions}
                        value={selectedValues}
                        onChange={(selected, action) =>
                          onChannelSelect(
                            selection.testName,
                            config.configName,
                            cardName,
                            selected,
                            action
                          )
                        }
                        placeholder="Select channels..."
                      />
                    </Box>
                  );
                })}

                {cardList.length === 0 && (
                  <Typography sx={{ fontSize: "0.75rem", color: "#999", textAlign: "center", py: 1 }}>
                    Expand to load cards and channels
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
};

export default FilterTestAccordion;
