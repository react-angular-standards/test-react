/** @format */

const colorSchemes = [
  '#FF6384',
  '#36A2EB',
  '#FFCE56',
  '#4BC0C0',
  '#9966FF',
  '#FF9F40',
  '#FF6384',
  '#C9CBCF',
];

let colorIndex = 0;

export const getRandomColorScheme = (): string => {
  const color = colorSchemes[colorIndex % colorSchemes.length];
  colorIndex++;
  return color;
};

export const customPlotsStyles = `
  .main-content {
    margin: 0;
    padding: 10px;
  }

  .plot-margin {
    margin: 0 10px;
  }

  .controls-section {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
  }

  .bg-custom-green {
    background-color: #e8f5e9;
  }

  .round-border {
    border-radius: 8px;
  }

  .chart-container {
    position: relative;
    margin: 10px;
  }

  .chart-wrapper {
    padding: 15px;
    background: white;
  }

  .draggable-handle {
    position: absolute;
    top: 10px;
    left: 10px;
    cursor: move;
    z-index: 10;
    color: #666;
  }

  .plot-pause-handle {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    z-index: 11;
  }

  .resize-handle {
    position: absolute;
    bottom: 10px;
    right: 10px;
    cursor: se-resize;
    z-index: 10;
    color: #666;
  }

  .time-range-handle {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    z-index: 10;
    background: rgba(255, 255, 255, 0.95);
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .toggle-icon-hidden {
    position: fixed;
    right: 10px;
    top: 10px;
    cursor: pointer;
    padding: 10px;
    background: #fff;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 100;
  }

  .toggle-icon {
    cursor: pointer;
    float: right;
  }

  .channels-section {
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
  }

  .dashboard-header {
    position: relative;
    min-height: 40px;
  }

  .chip {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .chip-lg {
    padding: 6px 16px;
  }

  .chip-blue {
    background-color: #e3f2fd;
    color: #1976d2;
  }

  .chip-green {
    background-color: #e8f5e9;
    color: #2e7d32;
  }

  .chip-red {
    background-color: #ffebee;
    color: #c62828;
  }

  .cursor-pointer {
    cursor: pointer;
  }

  .cursor-move {
    cursor: move;
  }

  .no-shrink {
    flex-shrink: 0;
  }

  .lt-border {
    border: 1px solid #e0e0e0;
  }

  .transition {
    transition: all 0.2s ease;
  }

  .group-input {
    border: none;
    background: transparent;
    font-weight: bold;
    font-size: 0.875rem;
    width: auto;
    min-width: 100px;
  }

  .group-input:focus {
    outline: none;
    border-bottom: 1px solid #1976d2;
  }

  .custom-drop-area {
    min-height: 40px;
    padding: 8px;
    background: #fafafa;
    border-radius: 4px;
  }

  .bg-light-blue { background-color: #e3f2fd; }
  .bg-light-green { background-color: #e8f5e9; }
  .bg-light-yellow { background-color: #fffde7; }
  .bg-light-pink { background-color: #fce4ec; }
  .bg-light-purple { background-color: #f3e5f5; }
  .bg-light-teal { background-color: #e0f2f1; }
  .bg-light-orange { background-color: #fff3e0; }
  .bg-light-indigo { background-color: #e8eaf6; }

  .loader-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
  }

  .shadow {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .shadow-sm {
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .shadow-lg {
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
`;
