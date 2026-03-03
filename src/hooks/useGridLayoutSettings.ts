/** @format */

import { useCallback, useRef, useState } from "react";
import { Layout } from "react-grid-layout";

export interface LayoutItems {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface PlotOption {
  id: string;
  width?: number;
  height?: number;
  [key: string]: any;
}

/**
 * useGridLayoutSettings
 *
 * Manages react-grid-layout state and custom pixel-resize interactions
 * for the Plots dashboard.
 *
 * Returns:
 *  - gridLayout               : current layout array for <GridLayout layout={...}>
 *  - resizeID                 : id of the chart currently being pixel-resized (or null)
 *  - resizeRef                : ref holding drag-start metadata for pixel resize
 *  - buildLayoutFromOptionList: build a GridLayout layout from chartOptions
 *  - handleResizeStart        : onMouseDown handler for the custom resize handle
 *  - handleLayoutChange       : onLayoutChange callback for <GridLayout>
 *  - setGridLayout            : direct setter for gridLayout
 *  - setResizeID              : direct setter for resizeID
 */
export const useGridLayoutSettings = () => {
  const [gridLayout, setGridLayout] = useState<LayoutItems[]>([]);
  const [resizeID, setResizeID] = useState<string | null>(null);

  /**
   * Persists the cursor position and chart pixel dimensions at the moment
   * a custom resize drag begins, so the mousemove handler can compute deltas.
   */
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    chartId: string;
  } | null>(null);

  /**
   * Builds a react-grid-layout layout array from a list of chart option objects.
   *
   * Layout strategy:
   *   - 12-column grid
   *   - When the channel panel is visible (showChannelSection = true) each chart
   *     takes half the grid width (w=6), two per row.
   *   - When the channel panel is hidden each chart takes the full width (w=12),
   *     one per row.
   *
   * @param optionList         Array of chart objects (must each have an `id` field).
   * @param showChannelSection Whether the right-hand channel settings panel is open.
   * @returns                  GridLayout-compatible layout array.
   */
  const buildLayoutFromOptionList = useCallback(
    (optionList: PlotOption[], showChannelSection: boolean): LayoutItems[] => {
      const cols = 12;
      const w = showChannelSection ? Math.floor(cols / 2) : cols;

      return optionList.map((opt, index) => ({
        i: opt.id,
        x: showChannelSection ? (index % 2) * w : 0,
        y: showChannelSection ? Math.floor(index / 2) * 2 : index * 2,
        w,
        h: 2,
        minW: 2,
        minH: 1,
      }));
    },
    [],
  );

  /**
   * Called on mousedown of the custom pixel-resize handle.
   * Records the starting cursor position and chart dimensions into resizeRef
   * and marks which chart is the active resize target.
   *
   * @param e          MouseEvent from the resize handle's onMouseDown prop.
   * @param chartId    Id of the chart being resized.
   * @param initWidth  Current pixel width of the chart container.
   * @param initHeight Current pixel height of the chart container.
   */
  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      chartId: string,
      initWidth: number,
      initHeight: number,
    ) => {
      e.preventDefault();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: initWidth,
        startHeight: initHeight,
        chartId,
      };
      setResizeID(chartId);
    },
    [],
  );

  /**
   * Called by GridLayout's onLayoutChange callback.
   *
   * Re-orders the incoming layout so that it matches the order of chartOptions
   * (preventing drag-reorder from scrambling the options array) and normalises
   * the shape to LayoutItems.
   *
   * @param newLayout          The Layout[] emitted by react-grid-layout.
   * @param currentOptions     The current chartOptions state array.
   * @param showChannelSection Whether the channel panel is open.
   * @returns                  Sorted LayoutItems[] aligned to currentOptions order.
   */
  const handleLayoutChange = useCallback(
    (
      newLayout: Layout[],
      currentOptions: PlotOption[],
      _showChannelSection: boolean,
    ): LayoutItems[] => {
      // Preserve the order defined by currentOptions so dragging charts
      // does not change the options array order.
      const orderedLayout: LayoutItems[] = currentOptions
        .map((opt) => newLayout.find((l) => l.i === opt.id))
        .filter((l): l is Layout => l !== undefined)
        .map((l) => ({
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: 2,
          minH: 1,
        }));

      return orderedLayout;
    },
    [],
  );

  return {
    gridLayout,
    resizeID,
    resizeRef,
    buildLayoutFromOptionList,
    handleResizeStart,
    handleLayoutChange,
    setGridLayout,
    setResizeID,
  };
};
