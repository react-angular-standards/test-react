# Running the Historical Data React App

## ✅ Setup Complete

All dependencies are installed and the app is ready to run!

## 🚀 Quick Start

### 1. Start the Development Server

```bash
cd /Users/dhanraj/Desktop/asit/react-app
npm start
```

The app will open at: **http://localhost:3000**

### 2. Configure API Endpoint

Edit `.env` file to set your API URL:

```bash
REACT_APP_API_URL=https://localhost/api/v1/data
```

Or for development without HTTPS:

```bash
REACT_APP_API_URL=http://localhost:8000/api/v1/data
```

## 📁 Project Structure

```
react-app/
├── src/
│   ├── components/
│   │   ├── DataTable.tsx          - Table view
│   │   ├── ChartView.tsx          - Chart view
│   │   ├── Pagination.tsx         - Pagination controls
│   │   └── drawers/
│   │       └── FilterDrawer.tsx   - Filter drawer
│   ├── hooks/
│   │   ├── useHistoricalData.ts   - API calls
│   │   └── useTestSelections.ts   - State management
│   ├── pages/
│   │   └── HistoricalDataRefactored.tsx  - Main component (348 lines)
│   ├── types/
│   │   └── historicalData.types.ts
│   ├── theme/
│   │   └── muiTheme.ts
│   ├── utils/
│   │   └── csvExport.ts
│   ├── component/
│   │   ├── Widgets/
│   │   │   └── CustomSelect.tsx
│   │   └── util/
│   │       └── UrlConstans.ts
│   ├── App.tsx
│   └── index.tsx
├── .env                           - API configuration
└── package.json
```

## 🎯 Features

✅ Filter data by test, config, and channels
✅ Time range selection with precision
✅ Table view with pagination
✅ Chart view with zoom
✅ CSV export functionality
✅ Responsive Material-UI design

## 🔧 Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000)

### `npm test`
Launches the test runner

### `npm run build`
Builds the app for production to the `build` folder

## 🐛 Troubleshooting

### API Connection Issues

1. **CORS Error**: Make sure your API server allows requests from `http://localhost:3000`
2. **HTTPS Certificate**: If using HTTPS with self-signed certificate, you may need to accept it in browser
3. **API Not Running**: Ensure your backend API is running on the configured URL

### Import Errors

If you see module not found errors, try:
```bash
npm install
```

## 📝 API Requirements

Your API should support these endpoints:

1. **GET** `/all-test-names` - Returns list of test names
2. **POST** `/config-names` - Returns configs for a test
3. **GET** `/test-config-details?TestName=X&ConfigName=Y` - Returns test details
4. **POST** `/filter` - Returns filtered data
5. **POST** `/custom-query` - Returns custom query results

## 🎨 Customization

### Change Theme
Edit `src/theme/muiTheme.ts` to customize colors and fonts

### Change API URL
Edit `.env` file and restart the development server

### Modify Components
All components are in `src/components/` and are independently editable

## 📊 Main Component Stats

- **Main Component**: 348 lines (vs 2,381 original)
- **Reduction**: 85.4%
- **Custom Hooks**: 2 files (422 lines total)
- **UI Components**: 4 files (445 lines total)
- **Fully Typed**: TypeScript throughout

## 🚀 Production Build

To create a production build:

```bash
npm run build
```

This creates an optimized build in the `build/` folder ready for deployment.

---

**Note**: Make sure your API server is running before starting the React app!
