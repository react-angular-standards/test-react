# Quick Start Guide

## 🚀 Quick Integration Steps

### 1. Copy Files to Your Project

```bash
# From your project root
cp -r /Users/dhanraj/Desktop/asit/split/types ./src/
cp -r /Users/dhanraj/Desktop/asit/split/theme ./src/
cp -r /Users/dhanraj/Desktop/asit/split/utils ./src/
cp -r /Users/dhanraj/Desktop/asit/split/services ./src/
cp -r /Users/dhanraj/Desktop/asit/split/pages ./src/
```

### 2. Install Dependencies

```bash
npm install @mui/material @mui/x-data-grid @mui/x-date-pickers @mui/icons-material
npm install dayjs react-select @canvasjs/react-charts
```

### 3. Use the Component

```typescript
import HistoricalData from './pages/HistoricalData';

function App() {
  return <HistoricalData />;
}
```

## 📝 What Each File Does

| File | Purpose | Exports |
|------|---------|---------|
| `types/historicalData.types.ts` | Type definitions | All interfaces |
| `theme/muiTheme.ts` | MUI styling | `muiTheme` |
| `utils/csvExport.ts` | CSV download | `exportToCSV()` |
| `services/historicalDataApi.ts` | API calls | `HistoricalDataApi` class |
| `pages/HistoricalData.tsx` | Main UI | `HistoricalData` component |

## ✅ Verification Checklist

- [ ] All dependencies installed
- [ ] Files copied to correct locations
- [ ] Import paths updated if needed
- [ ] `CustomSelect` component available
- [ ] `UrlConstant.HISTORICAL_DATA_API` configured
- [ ] Component renders without errors
- [ ] CSV export works
- [ ] API calls successful

## 🎯 Next Steps

1. Update `UrlConstant.HISTORICAL_DATA_API` with your API endpoint
2. Test the component in development mode
3. Verify all features work (filter, custom query, export, charts)
4. Customize theme in `theme/muiTheme.ts` if needed

## 💡 Pro Tips

- Use `index.ts` for cleaner imports
- Types are shared, reuse them in other components
- CSV export function can be used elsewhere
- API service class can be extended for more endpoints

---

Need help? Check `README.md` for detailed documentation.
