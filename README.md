
A React TypeScript application for visualizing and analyzing historical test data with filtering and custom query capabilities.

## Features

- **Filter Tab**: Select tests, configs, cards, and channels with time range filtering
- **Custom Query Tab**: Create mathematical expressions with channel operations
- **Data Visualization**: Toggle between table and plot views
- **CSV Export**: Export filtered data to CSV format
- **Responsive UI**: Material-UI components with clean design

## Tech Stack

- React 18 with TypeScript
- Material-UI (MUI) v5
- MUI DataGrid for tables
- CanvasJS for charts
- Day.js for date/time handling
- React Select for multi-select dropdowns

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```

The app will run on [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── DataTable.tsx
│   ├── ChartView.tsx
│   ├── Pagination.tsx
│   └── drawers/        # Drawer content components
│       ├── FilterDrawerContent.tsx
│       └── CustomQueryDrawerContent.tsx
├── hooks/              # Custom React hooks
│   ├── useHistoricalData.ts
│   ├── useTestSelections.ts
│   └── useCustomQuerySelections.ts
├── pages/              # Main page components
│   └── HistoricalDataRefactored.tsx
├── types/              # TypeScript type definitions
│   └── historicalData.types.ts
├── utils/              # Utility functions
│   └── csvExport.ts
├── theme/              # MUI theme configuration
│   └── muiTheme.ts
└── component/          # Legacy components
    ├── Widgets/
    └── util/
```

## Component Architecture

The main component (`HistoricalDataRefactored.tsx`) is kept under 500 lines by extracting:
- API logic into custom hooks
- UI components into separate files
- Type definitions into shared types file
- Utility functions into separate modules

## API Configuration

Update the API base URL in `src/component/util/UrlConstans.ts`:

```typescript
export const UrlConstant = {
  HISTORICAL_DATA_API: 'http://your-api-url/api/v1/data'
};
```

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## License

MIT
