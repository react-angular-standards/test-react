/** @format */

import React from "react";
import { ThemeProvider, BaseStyles } from "@primer/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import {
  Monitoring,
  LiveMonitoringProvider,
} from "./components/LiveMonitoring";
import { muiTheme } from "./theme/muiTheme";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <BaseStyles>
        <MuiThemeProvider theme={muiTheme}>
          <LiveMonitoringProvider>
            <div className="App">
              <Monitoring />
            </div>
          </LiveMonitoringProvider>
        </MuiThemeProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}

export default App;
