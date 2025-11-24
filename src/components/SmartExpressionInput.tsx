import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
} from "@mui/material";
import { SelectOption } from "../types/historicalData.types";

interface SmartExpressionInputProps {
  expression: string;
  allChannelOptions: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const SmartExpressionInput: React.FC<SmartExpressionInputProps> = ({
  expression,
  allChannelOptions,
  onChange,
  placeholder = "Type expression: e.g., 1 + 2 * 5",
}) => {
  const [inputValue, setInputValue] = useState(expression);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Operators and common constants
  const operators = ["+", "-", "*", "/", "(", ")"];
  const commonConstants = ["0", "1", "2", "5", "10", "100", "0.5", "1.5"];

  // Only sync when expression changes from parent (not from our own changes)
  const previousExpressionRef = useRef(expression);

  useEffect(() => {
    // Only update if the expression changed externally (e.g., from clear button)
    if (
      expression !== inputValue &&
      expression !== previousExpressionRef.current
    ) {
      setInputValue(expression);
    }
    previousExpressionRef.current = expression;
  }, [expression]);

  const getLastToken = (text: string, position: number): string => {
    const beforeCursor = text.substring(0, position);
    const tokens = beforeCursor.split(/[\s+\-*/()]/);
    return tokens[tokens.length - 1] || "";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;

    setInputValue(value);
    setCursorPosition(position);

    // Get the current token being typed
    const currentToken = getLastToken(value, position);

    if (currentToken.length > 0) {
      const newSuggestions: Array<{ value: string; label: string }> = [];

      // Suggest channel IDs (with Ch: prefix in display)
      if (/^\d/.test(currentToken)) {
        allChannelOptions.forEach((opt) => {
          const channelId = String(opt.value);
          if (channelId.includes(currentToken)) {
            newSuggestions.push({
              value: channelId,
              label: opt.label || `Ch: ${channelId}`,
            });
          }
        });
      }

      // Suggest operators
      operators.forEach((op) => {
        if (op.includes(currentToken) && currentToken.length === 1) {
          newSuggestions.push({ value: op, label: op });
        }
      });

      // Suggest common constants if typing numbers
      if (/^\d/.test(currentToken)) {
        commonConstants.forEach((constant) => {
          if (constant.startsWith(currentToken)) {
            newSuggestions.push({ value: constant, label: constant });
          }
        });
      }

      setSuggestions(newSuggestions.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      // Show all channel options when empty or after operator
      const lastChar = value[position - 1];
      if (!value || operators.includes(lastChar) || lastChar === " ") {
        setSuggestions(
          allChannelOptions.slice(0, 10).map((opt) => ({
            value: String(opt.value),
            label: opt.label || `Ch: ${opt.value}`,
          })),
        );
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  const handleSuggestionClick = (suggestion: {
    value: string;
    label: string;
  }) => {
    const beforeCursor = inputValue.substring(0, cursorPosition);
    const afterCursor = inputValue.substring(cursorPosition);
    const currentToken = getLastToken(beforeCursor, cursorPosition);

    // Replace the current token with the suggestion value (not label)
    const newValue =
      beforeCursor.substring(0, beforeCursor.length - currentToken.length) +
      suggestion.value +
      " " +
      afterCursor;

    setInputValue(newValue);
    onChange(newValue.trim());
    setShowSuggestions(false);

    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleBlur = useCallback(() => {
    // Delay hiding suggestions to allow click
    setTimeout(() => {
      setShowSuggestions(false);
      // Only call onChange if the value actually changed
      if (inputValue.trim() !== expression) {
        onChange(inputValue.trim());
      }
    }, 200);
  }, [inputValue, expression, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[0]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <TextField
        fullWidth
        inputRef={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={(e) => {
          const value = e.target.value;
          const position = e.target.selectionStart || 0;
          setCursorPosition(position);
          if (!value || value.endsWith(" ")) {
            setSuggestions(
              allChannelOptions.slice(0, 10).map((opt) => ({
                value: String(opt.value),
                label: opt.label || `Ch: ${opt.value}`,
              })),
            );
            setShowSuggestions(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size="small"
        sx={{
          fontFamily: "monospace",
          "& .MuiInputBase-input": {
            fontFamily: "monospace",
            fontSize: "0.9rem",
          },
        }}
      />

      {/* Helper Chips */}
      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
        <Typography
          variant="caption"
          sx={{ fontSize: "0.65rem", color: "#999", mr: 1 }}
        >
          Quick add:
        </Typography>
        {operators.map((op) => (
          <Chip
            key={op}
            label={op}
            size="small"
            onClick={() => {
              const newValue = inputValue + (inputValue ? " " : "") + op + " ";
              setInputValue(newValue);
              onChange(newValue.trim());
              inputRef.current?.focus();
            }}
            sx={{ height: "20px", fontSize: "0.7rem", cursor: "pointer" }}
          />
        ))}
      </Box>

      {/* Autocomplete Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Paper
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            mt: 0.5,
            maxHeight: 200,
            overflow: "auto",
            zIndex: 1000,
            boxShadow: 3,
          }}
        >
          <List dense>
            {suggestions.map((suggestion, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton
                  onClick={() => handleSuggestionClick(suggestion)}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary={suggestion.label}
                    primaryTypographyProps={{
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Channel Options - Show next to expression */}
      <Box sx={{ mt: 1 }}>
        <Typography
          variant="caption"
          sx={{ fontSize: "0.7rem", color: "#666", mb: 0.5, display: "block" }}
        >
          Available Channels (click to add):
        </Typography>
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            flexWrap: "wrap",
            maxHeight: 80,
            overflow: "auto",
          }}
        >
          {allChannelOptions.slice(0, 20).map((opt) => (
            <Chip
              key={opt.value}
              label={`Ch: ${opt.value}`}
              size="small"
              onClick={() => {
                const newValue =
                  inputValue +
                  (inputValue && !inputValue.endsWith(" ") ? " " : "") +
                  opt.value +
                  " ";
                setInputValue(newValue);
                onChange(newValue.trim());
                inputRef.current?.focus();
              }}
              sx={{
                height: "22px",
                fontSize: "0.7rem",
                cursor: "pointer",
                bgcolor: "#e3f2fd",
                "&:hover": { bgcolor: "#bbdefb" },
              }}
            />
          ))}
          {allChannelOptions.length > 20 && (
            <Typography
              variant="caption"
              sx={{ fontSize: "0.65rem", color: "#999", alignSelf: "center" }}
            >
              +{allChannelOptions.length - 20} more (type to search)
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SmartExpressionInput;
