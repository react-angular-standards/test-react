import React from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  ButtonGroup,
} from "@mui/material";
import CustomSelect from "../component/Widgets/CustomSelect";
import { SelectOption } from "../types/historicalData.types";

interface ExpressionBuilderProps {
  expression: string;
  constantValue: string;
  allChannelOptions: SelectOption[];
  onAddChannel: (channelValue: string) => void;
  onAddOperator: (operator: string) => void;
  onConstantChange: (value: string) => void;
  onClear: () => void;
}

const ExpressionBuilder: React.FC<ExpressionBuilderProps> = ({
  expression,
  constantValue,
  allChannelOptions,
  onAddChannel,
  onAddOperator,
  onConstantChange,
  onClear,
}) => {
  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 1,
          fontWeight: 600,
          fontSize: "0.85rem",
        }}
      >
        Expression Builder
      </Typography>

      {/* Expression Display */}
      <Paper
        sx={{
          p: 1.5,
          mb: 2,
          minHeight: "60px",
          bgcolor: "#f8f9fa",
          border: "2px dashed #ddd",
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          alignItems: "center",
        }}
      >
        {expression ? (
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "0.9rem",
              color: "#1976d2",
              fontWeight: 600,
            }}
          >
            {expression}
          </Typography>
        ) : (
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "#999",
              fontStyle: "italic",
            }}
          >
            Build your expression step by step using channels, operators, and constants...
          </Typography>
        )}
      </Paper>

      {/* Step 1: Add Channel or Constant */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.7rem",
            color: "#666",
            mb: 1,
            display: "block",
            fontWeight: 600,
          }}
        >
          Step 1: Add Channel or Constant
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <CustomSelect
              isMulti={false}
              options={allChannelOptions}
              value={null}
              onChange={(selected) => {
                if (selected && "value" in selected) {
                  onAddChannel(selected.value.toString());
                }
              }}
              placeholder="Select a channel..."
            />
          </Box>
          <Typography
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1,
              color: "#666",
              fontSize: "0.75rem",
            }}
          >
            OR
          </Typography>
          <Box sx={{ flex: 1 }}>
            <TextField
              size="small"
              type="number"
              placeholder="Enter constant (e.g., 5)"
              value={constantValue}
              onChange={(e) => onConstantChange(e.target.value)}
              fullWidth
              inputProps={{ step: "any" }}
            />
          </Box>
          {constantValue && (
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                if (expression) {
                  // Add with operator prompt
                } else {
                  onAddChannel(constantValue);
                  onConstantChange("");
                }
              }}
              sx={{ minWidth: "80px" }}
            >
              Add
            </Button>
          )}
        </Box>
      </Box>

      {/* Step 2: Add Operator (shows when expression exists) */}
      {expression && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.7rem",
              color: "#666",
              mb: 1,
              display: "block",
              fontWeight: 600,
            }}
          >
            Step 2: Choose Operator (then repeat Step 1)
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <ButtonGroup size="small">
              <Button
                variant="outlined"
                onClick={() => onAddOperator("+")}
                sx={{ minWidth: "60px" }}
              >
                + Add
              </Button>
              <Button
                variant="outlined"
                onClick={() => onAddOperator("-")}
                sx={{ minWidth: "70px" }}
              >
                - Subtract
              </Button>
              <Button
                variant="outlined"
                onClick={() => onAddOperator("*")}
                sx={{ minWidth: "70px" }}
              >
                × Multiply
              </Button>
              <Button
                variant="outlined"
                onClick={() => onAddOperator("/")}
                sx={{ minWidth: "60px" }}
              >
                ÷ Divide
              </Button>
            </ButtonGroup>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={onClear}
              sx={{ minWidth: "80px", ml: "auto" }}
            >
              Clear All
            </Button>
          </Box>
        </Box>
      )}

      {/* Helper Text */}
      <Typography
        variant="caption"
        sx={{
          fontSize: "0.65rem",
          color: "#999",
          display: "block",
          fontStyle: "italic",
        }}
      >
        💡 Example: Select id_1 → click + → select id_2 → click * → enter 5 → click Add
        → Result: id_1 + id_2 * 5
      </Typography>
    </Box>
  );
};

export default ExpressionBuilder;
