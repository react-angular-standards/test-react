/** @format */

import { useState, useRef, useCallback } from "react";
import { LayoutItems } from "../types/PlotDashboard";
import { PlotOptions } from "../components/LiveMonitoring/ChartSchema";

interface LayoutSizeInterface {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export const useGridLayoutSettings = () => {
  const [gridLayout, setGridLayout] = useState<LayoutItems[]>([]);
  const [resizeID, setResizeID] = useState<string | null>(null);
  const resizeRef = useRef<LayoutSizeInterface | null>(null);

  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      chartId: string,
      width: number,
      height: number,
    ): void => {
      e.stopPropagation();
      setResizeID(chartId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: width,
        startHeight: height,
      };
    },
    [],
  );

  const buildLayoutFromOptionList = useCallback(
    (layoutOptions: PlotOptions[], showChannelSection: boolean) => {
      const layoutMaxWidth = showChannelSection ? 0.72 : 1;
      const totalWidth = window.innerWidth * layoutMaxWidth;
      const halfWidth = Math.round(totalWidth * 0.5);
      const quarterWidth = Math.round(totalWidth * 0.25);
      const threeByForthWidth = Math.round(totalWidth * 0.75);

      const baseRowHeight = window.innerHeight * 0.11 || 120;
      const adjustedLayout: LayoutItems[] = [];
      let currentY = 0;
      let filledRowSize = 0;
      let rowMaxHeight = 0;

      layoutOptions.forEach((opt) => {
        // Determine grid columns dynamically based on requested pixel width
        const widthInCols =
          quarterWidth >= opt.width
            ? 3
            : halfWidth >= opt.width
              ? 6
              : threeByForthWidth >= opt.width
                ? 9
                : 12;

        // If this item exceeds the 12-column grid row, wrap to the next row
        if (filledRowSize + widthInCols > 12) {
          filledRowSize = 0;
          currentY += rowMaxHeight;
          rowMaxHeight = 0;
        }

        const xPos = filledRowSize;
        filledRowSize += widthInCols;

        // Dynamically calculate grid height using actual window-based rowHeight
        // Adding 20px padding to ensure CanvasJS fits cleanly inside RGL cell
        const calHeight = Math.ceil((opt.height + 20) / baseRowHeight);
        const height = calHeight > 2 ? calHeight : 3;
        rowMaxHeight = Math.max(rowMaxHeight, height);

        adjustedLayout.push({
          i: opt.id,
          x: xPos,
          y: currentY,
          w: widthInCols,
          h: height,
          isDraggable: true,
          isResizable: false,
        });

        if (filledRowSize >= 12) {
          filledRowSize = 0;
          currentY += rowMaxHeight;
          rowMaxHeight = 0;
        }
      });
      return adjustedLayout;
    },
    [],
  );

  const handleLayoutChange = useCallback(
    (
      newLayout: LayoutItems[],
      inputOptions: PlotOptions[],
      showChannelSection: boolean,
    ) => {
      const sortedLayout = [...newLayout].sort((a, b) =>
        a.y === b.y ? a.x - b.x : a.y - b.y,
      );
      const layoutOptions = sortedLayout
        .map((layout) => inputOptions.find((option) => option.id === layout.i))
        .filter((option): option is PlotOptions => option !== undefined);
      const adjustedLayout = buildLayoutFromOptionList(
        layoutOptions,
        showChannelSection,
      );

      setGridLayout(adjustedLayout);
      return layoutOptions;
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
