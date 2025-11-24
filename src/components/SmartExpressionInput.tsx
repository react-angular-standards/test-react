import React, { useState, useRef, useEffect } from "react";
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
  placeholder = "Type expression: e.g., 10306001 + 10306002 * 5",
}) => {
  const [inputValue, setInputValue] = useState(expression);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);

  // Operators
  const operators = ["+", "-", "*", "/", "(", ")"];

  // Sync with parent expression only when it changes externally
  useEffect(() => {
    if (!isInternalChange.current && expression !== inputValue) {
      setInputValue(expression);
    }
    isInternalChange.current = false;
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

    // Get the current token being typed
    const currentToken = getLastToken(value, position);

    if (currentToken.length > 0 && /^\d/.test(currentToken)) {
      // Show channel suggestions when typing numbers
      const filtered = allChannelOptions
        .filter((opt) => String(opt.value).includes(currentToken))
        .slice(0, 8)
        .map((opt) => ({
          value: String(opt.value),
          label: `Ch: ${opt.value}`,
        }));
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: {
    value: string;
    label: string;
  }) => {
    if (!inputRef.current) return;

    const cursorPos = inputRef.current.selectionStart || inputValue.length;
    const beforeCursor = inputValue.substring(0, cursorPos);
    const afterCursor = inputValue.substring(cursorPos);
    const currentToken = getLastToken(beforeCursor, cursorPos);

    // Replace the current token with the suggestion value
    const newValue =
      beforeCursor.substring(0, beforeCursor.length - currentToken.length) +
      suggestion.value +
      " " +
      afterCursor;

    isInternalChange.current = true;
    setInputValue(newValue);
    onChange(newValue.trim());
    setShowSuggestions(false);

    // Focus and set cursor at end of inserted value
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos =
          beforeCursor.length -
          currentToken.length +
          suggestion.value.length +
          1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleBlur = () => {
    // Delay to allow suggestion click
    setTimeout(() => {
      setShowSuggestions(false);
      if (inputValue.trim() !== expression) {
        isInternalChange.current = true;
        onChange(inputValue.trim());
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[0]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleOperatorClick = (op: string) => {
    const newValue =
      inputValue +
      (inputValue && !inputValue.endsWith(" ") ? " " : "") +
      op +
      " ";
    isInternalChange.current = true;
    setInputValue(newValue);
    onChange(newValue.trim());

    // Keep focus and cursor at end
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newValue.length, newValue.length);
      }
    }, 0);
  };

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <Typography
        variant="subtitle2"
        sx={{ mb: 0.5, fontWeight: 600, fontSize: "0.85rem" }}
      >
        Channel Expression
      </Typography>

      <TextField
        fullWidth
        inputRef={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => {
          // Show channel suggestions immediately on focus
          if (allChannelOptions.length > 0) {
            setSuggestions(
              allChannelOptions.slice(0, 10).map((opt) => ({
                value: String(opt.value),
                label: `Ch: ${opt.value}`,
              })),
            );
            setShowSuggestions(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size="small"
        sx={{
          "& .MuiInputBase-input": {
            fontFamily: "monospace",
            fontSize: "0.9rem",
          },
        }}
      />

      {/* Operator Chips */}
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          mt: 0.5,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontSize: "0.65rem", color: "#666" }}
        >
          Operators:
        </Typography>
        {operators.map((op) => (
          <Chip
            key={op}
            label={op}
            size="small"
            onClick={() => handleOperatorClick(op)}
            sx={{
              height: "20px",
              fontSize: "0.75rem",
              cursor: "pointer",
              "&:hover": { bgcolor: "#e3f2fd" },
            }}
          />
        ))}
      </Box>

      {/* Autocomplete Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <Paper
          sx={{
            position: "absolute",
            top: "calc(100% - 30px)",
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
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur
                    handleSuggestionClick(suggestion);
                  }}
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

      <Typography
        variant="caption"
        sx={{ fontSize: "0.65rem", color: "#888", display: "block", mt: 0.5 }}
      >
        Type channel numbers to see suggestions. Use operators above or type
        them directly.
      </Typography>
    </Box>
  );
};

export default SmartExpressionInput;
