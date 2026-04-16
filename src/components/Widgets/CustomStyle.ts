/** @format */

const colorSchemes = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
  "#FF6384",
  "#C9CBCF",
];

let colorIndex = 0;

export const getRandomColorScheme = (): string => {
  const color = colorSchemes[colorIndex % colorSchemes.length];
  colorIndex++;
  return color;
};

// -- Tooltip overlay styles

export const customPlotsStyles = `
  .bg-custom-green { background-color: #daefff; }
  .bg-light-blue { background-color: #e7f1ff; }
  .bg-light-green { background-color: #e9ffe7; }
  .bg-light-yellow { background-color: #fffde7; }
  .bg-light-pink { background-color: #ffe7f1; }
  .bg-light-purple { background-color: #f1e7ff; }
  .bg-light-teal { background-color: #e7fff7; }
  .bg-light-orange { background-color: #fff3e7; }
  .bg-light-indigo { background-color: #ede7ff; }

  .chip { display: inline-block; padding: 0.15rem 0.4rem; font-size: 0.65rem; font-weight: 500; border-radius: 9999px; margin: 0.2rem; }
  .chip-blue { background-color: #cce5ff; color: #004085; }
  .chip-blue:hover { background-color: #b3d7ff; }
  .chip-green { background-color: #d4edda; color: #155724; }
  .chip-red { background-color: #f8d7da; color: #721c24; }
  .chip-red:hover { background-color: #f5c6cb; }

  .custom-drop-area { border: 1px dashed gray; padding: 10px; border-radius: 6px; }
  .no-shrink { flex-shrink: 0; }

  .chart-container { position: relative; }

  .resize-handle { position: absolute; width: 20px; height: 20px; bottom: 10px; right: 10px; cursor: se-resize; z-index: 10; }
  .time-range-handle { position: absolute; width: calc(100% - 50px); left: 10px; bottom: 10px; padding-right: 25px; padding-left: 20px; z-index: 10; }
  .plot-pause-handle { position: absolute; right: 92px; top: 6px; z-index: 10; }
  .draggable-handle { position: absolute; left: 10px; top: 10px; cursor: grabbing; z-index: 10; }

  .main-content { margin-top: 5px; }

  .controls-section { padding: 10px; }

  .row { padding-bottom: 20px; --bs-gutter-x: 0; }

  .channels-section { height: calc(85vh); overflow-y: auto; position: relative; margin-right: 1.5rem; }

  .channels-section-live-table { overflow-y: auto; position: relative; margin-right: 1.5rem; }

  .toggle-icon { position: absolute; right: 9px; cursor: pointer; }

  .toggle-icon-hidden { position: absolute; top: 20px; right: 40px; z-index: 10; cursor: pointer; }

  .chart-wrapper { box-sizing: border-box; padding: 20px 30px 80px 20px; width: 100%; overflow: hidden; }

  .react-grid-item { transition: all 200ms ease; }

  .react-grid-item.dragging { z-index: 100; }

  .group-input { border: hidden; background: inherit; border-radius: 6px; }

  .round-border { border: 1.5px ridge #007bff; border-radius: 5px; padding: 5px; }

  .lt-border { border: 1px dashed #aeaeaf; border-radius: 5px; padding: 5px; }

  .custom-btn { --bs-btn-padding-y: 0.2rem; --bs-btn-padding-x: 0rem; --bs-btn-font-size: 0.75rem; --bs-btn-border-radius: var(--bs-border-radius-sm); }

  .plot-margin { margin-left: 0.8rem; margin-top: 1.0rem; }

  .dashboard-header { top: 0; position: sticky; background: #daefff; height: 50px; border-bottom: 2px solid #036fe3; z-index: 1; }
`;
