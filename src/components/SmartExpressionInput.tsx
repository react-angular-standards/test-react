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
  placeholder = "Type expression: e.g., id_1 + id_2 * 5",
}) => {
  const [inputValue, setInputValue] = useState(expression);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Operators and common constants
  const operators = ["+", "-", "*", "/", "(", ")"];
  const commonConstants = ["0", "1", "2", "5", "10", "100", "0.5", "1.5"];

  useEffect(() => {
    setInputValue(expression);
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
      const newSuggestions: string[] = [];

      // Suggest channel IDs
      if (currentToken.startsWith("id_") || currentToken === "i" || currentToken === "id") {
        allChannelOptions.forEach((opt) => {
          const channelId = `id_${opt.value}`;
          if (channelId.toLowerCase().includes(currentToken.toLowerCase())) {
            newSuggestions.push(channelId);
          }
        });
      }

      // Suggest operators
      operators.forEach((op) => {
        if (op.includes(currentToken) && currentToken.length === 1) {
          newSuggestions.push(op);
        }
      });

      // Suggest common constants if typing numbers
      if (/^\d/.test(currentToken)) {
        commonConstants.forEach((constant) => {
          if (constant.startsWith(currentToken)) {
            newSuggestions.push(constant);
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
          allChannelOptions.slice(0, 10).map((opt) => `id_${opt.value}`)
        );
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    const beforeCursor = inputValue.substring(0, cursorPosition);
    const afterCursor = inputValue.substring(cursorPosition);
    const currentToken = getLastToken(beforeCursor, cursorPosition);

    // Replace the current token with the suggestion
    const newValue =
      beforeCursor.substring(0, beforeCursor.length - currentToken.length) +
      suggestion +
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

  const handleBlur = () => {
    // Delay hiding suggestions to allow click
    setTimeout(() => {
      setShowSuggestions(false);
      onChange(inputValue.trim());
    }, 200);
  };

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
              allChannelOptions.slice(0, 10).map((opt) => `id_${opt.value}`)
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
        <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#999", mr: 1 }}>
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
                    primary={suggestion}
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

      {/* Expression Preview */}
      <Paper
        sx={{
          mt: 1,
          p: 1,
          bgcolor: "#f8f9fa",
          border: "1px solid #ddd",
          minHeight: "40px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {inputValue ? (
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "0.85rem",
              color: "#1976d2",
              fontWeight: 600,
            }}
          >
            {inputValue}
          </Typography>
        ) : (
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "#999",
              fontStyle: "italic",
            }}
          >
            Expression preview will appear here...
          </Typography>
        )}
      </Paper>

      {/* Help Text */}
      <Typography
        variant="caption"
        sx={{
          fontSize: "0.65rem",
          color: "#666",
          display: "block",
          mt: 0.5,
        }}
      >
        💡 Type "id_" for channels, numbers for constants, or click operator chips above
      </Typography>
    </Box>
  );
};

export default SmartExpressionInput;
