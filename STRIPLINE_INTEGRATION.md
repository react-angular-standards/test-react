# Stripline Component Integration Guide

## Overview
The Stripline architecture was refactored from a monolithic Custom Hook (useStriplines) into a declarative, self-contained React Component (<Stripline />). This solves React lifecycle syncing issues with CanvasJS, improves state isolation (each chart tracks its own markers), and prevents tooltip clipping by using React Portals.

## How it Works and Integrates (Plots.tsx)

1. **Declarative Rendering**:
   Inside Plots.tsx, the <Stripline /> component is conditionally mounted next to the <CanvasJSChart /> only when isPlotPausedForAnalysis is true.
   
2. **Component References (forwardRef)**:
   Because CanvasJS events (like clicking on the chart) are intercepted by the parent (Plots.tsx), Plots needs a way to tell the Stripline component that a click occurred.
   - Plots.tsx maintains a dictionary of refs.
   - It passes this ref to the <Stripline ref={...} /> component.
   - Inside Stripline.tsx, useImperativeHandle exposes two methods to the parent: applyStriplineAt(ts: Date) and clearStriplines().

3. **Click Interception**:
   When the chart is paused, Plots.tsx overrides the CanvasJS click handler. Instead of relying on clicking directly on the series line, it reads the pixel coordinate (e.x), maps it to a timestamp using axis.convertPixelToValue(e.x), and immediately calls striplineRefs.current[chartId].applyStriplineAt(ts).

4. **React Portals for Tooltips**:
   To prevent the tooltip from being constrained or clipped by the chart overflow: hidden containers, the tooltip JSX is wrapped in createPortal(..., document.body). It calculates its initial position based on the chart bounding rect, and then relies on position: fixed to float independently.

## Component Props / Parameters

The <Stripline /> component accepts the following props (StriplineProps):

*   **chartId** (string): The unique identifier for the chart (e.g., "main", "group-1"). Used to lookup active channels from the context.
*   **chartRef** (React.MutableRefObject<any>): A reference pointing directly to the underlying CanvasJS instance (chartInst). This allows the Stripline component to imperatively push stripLines config arrays directly into chartInst.options.axisX and force a render().

*Note: It also natively consumes useLiveMonitoringContext() to access activePlotChannelsRef (for data lookups) and group definitions.*

## Helper Functions Deep Dive

Inside striplines.tsx, there are several pure helper functions responsible for data extraction and formatting:

### 1. findClosestValue(dataPoints, ts)
*   **Purpose**: CanvasJS holds data as an array of { x, y } objects. When a user clicks a coordinate on the graph, we get a specific Timestamp (ts), but that exact millisecond might not exist in the data array. This function finds the nearest actual recorded data point.
*   **How it works**: It iterates over the dataPoints array, converting the x values to epoch time. It calculates the absolute difference and keeps track of the minimum difference.
*   **Returns**: The y value (number | null) of the closest historical data point.

### 2. fmt(d: Date)
*   **Purpose**: Formats the selected marker timestamps into a human-readable string.
*   **Returns**: A string in the HH:mm:ss.SSS format, extracted via toISOString().

### 3. fmtDiff(d1: Date, d2: Date)
*   **Purpose**: Calculates the time differential between the two placed markers (X1 and X2).
*   **Returns**: The absolute difference formatted as seconds and milliseconds (e.g., 1.250s).

### 4. fmtNum(n: number)
*   **Purpose**: Safely formats the Y-axis data values for display in the table.
*   **Returns**: A localized string ensuring a minimum of 2 and maximum of 4 decimal places. If the value is missing/null, it returns --.
