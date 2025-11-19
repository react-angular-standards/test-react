# Historical Data Component - Split Structure

This directory contains the properly organized and split code from `asit.tsx`.

## 📁 File Structure

```
split/
├── types/
│   └── historicalData.types.ts      # All TypeScript interfaces and types
├── theme/
│   └── muiTheme.ts                  # Material-UI theme configuration
├── utils/
│   └── csvExport.ts                 # CSV export utility function
├── services/
│   └── historicalDataApi.ts         # API service class for data operations
└── pages/
    └── HistoricalData.tsx            # Main component with all functionality
```

## 🔧 How to Use

### 1. Copy Files to Your Project

Copy the entire `split/` directory structure to your project's `src/` folder:

```
your-project/
└── src/
    ├── types/
    │   └── historicalData.types.ts
    ├── theme/
    │   └── muiTheme.ts
    ├── utils/
    │   └── csvExport.ts
    ├── services/
    │   └── historicalDataApi.ts
    └── pages/
        └── HistoricalData.tsx
```

### 2. Update Import Paths

If you place files in different locations, update the import paths in `HistoricalData.tsx`:

```typescript
// Current imports (assuming files are in src/)
import { muiTheme } from "../theme/muiTheme";
import { exportToCSV } from "../utils/csvExport";
import { ... } from "../types/historicalData.types";

// Adjust based on your actual file structure
```

### 3. Ensure Dependencies are Installed

Make sure your project has these dependencies:

```bash
npm install @mui/material @mui/x-data-grid @mui/x-date-pickers
npm install @mui/icons-material
npm install dayjs
npm install react-select
npm install @canvasjs/react-charts
```

## 📦 File Descriptions

### `types/historicalData.types.ts`
Contains all TypeScript interfaces:
- `DataRow`, `Test`, `SelectOption`
- `TestSelection`, `ConfigSelection`, `CardSelection`
- `CustomQueryConfig`, `CustomQueryTest`
- `FilterRequestBody`, `CustomQueryRequest`
- `TestConfigDetailsResponse`, `SeriesData`

### `theme/muiTheme.ts`
MUI theme configuration with custom styling for:
- Select components
- Input fields
- Buttons
- Typography
- Form controls

### `utils/csvExport.ts`
Utility function for exporting data to CSV:
- Handles special characters (commas, quotes, newlines)
- Generates timestamped filenames
- Returns success/error status

### `services/historicalDataApi.ts`
API service class with methods:
- `fetchTestNames()` - Get all test names
- `fetchConfigNames(testName)` - Get configs for a test
- `fetchTestConfigDetails(testName, configName)` - Get test details
- `fetchFilteredData(requestBody)` - Fetch filtered data
- `fetchCustomQueryData(requestBody)` - Fetch custom query results

### `pages/HistoricalData.tsx`
Main component containing:
- All state management
- Event handlers
- Data fetching logic
- UI rendering (DataGrid, Charts, Drawer, etc.)
- CSV export functionality

## ✅ Benefits of This Structure

1. **Separation of Concerns** - Each file has a single responsibility
2. **Reusability** - Types, utils, and services can be reused elsewhere
3. **Maintainability** - Easier to find and fix issues
4. **Testability** - Individual functions can be unit tested
5. **Scalability** - Easy to extend with new features

## 🔍 Key Features

- **Dual Mode**: Filter mode and Custom Query mode
- **Data Visualization**: Table view and Chart view
- **CSV Export**: Export filtered data with timestamp
- **Time Range Selection**: Precise time filtering with milliseconds
- **Channel Selection**: Multi-select for channels across card types
- **Custom Queries**: Build mathematical expressions with channels
- **Pagination**: Configurable page size and navigation

## 🚀 Usage Example

```typescript
import HistoricalData from './pages/HistoricalData';

function App() {
  return (
    <div>
      <HistoricalData />
    </div>
  );
}
```

## 📝 Notes

- The component requires `UrlConstant.HISTORICAL_DATA_API` to be configured
- Ensure `CustomSelect` component is available at `../../component/Widgets/CustomSelect`
- The API should follow the expected request/response format
- CSV export works client-side, no server required

## 🔗 Original File

Backup of original file: `/Users/dhanraj/Desktop/asit/asit.backup.tsx`
