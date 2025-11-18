import { createTheme } from "@mui/material/styles";

// Material UI theme configuration for Historical Data components
export const muiTheme = createTheme({
  components: {
    MuiSelect: {
      styleOverrides: {
        select: { fontSize: "0.75rem", padding: "4px 8px" },
      },
    },
    MuiInputBase: {
      styleOverrides: { root: { fontSize: "0.75rem" } },
    },
    MuiButton: {
      styleOverrides: {
        root: { fontSize: "0.7rem", padding: "2px 6px", minWidth: "60px" },
      },
    },
    MuiTypography: {
      styleOverrides: { root: { fontSize: "0.85rem" } },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: "0.7rem" } },
    },
  },
});
