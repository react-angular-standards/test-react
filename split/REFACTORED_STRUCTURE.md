# Refactored Structure - Components Under 500 Lines

## 📁 New Structure

```
split/
├── hooks/
│   ├── useHistoricalData.ts          (~200 lines) - API calls & data fetching
│   ├── useTestSelections.ts          (~220 lines) - Filter tab state management
│   └── useCustomQuerySelections.ts   (~150 lines) - Custom query tab state
├── components/
│   ├── DataTable.tsx                 (~40 lines)  - DataGrid wrapper
│   ├── ChartView.tsx                 (~115 lines) - Chart visualization
│   ├── Pagination.tsx                (~105 lines) - Pagination controls
│   ├── FilterDrawer/
│   │   ├── index.tsx                 (~150 lines) - Main drawer container
│   │   ├── TestAccordion.tsx         (~200 lines) - Test selection accordion
│   │   └── ConfigAccordion.tsx       (~250 lines) - Config & channel selection
│   └── CustomQueryDrawer/
│       ├── index.tsx                 (~150 lines) - Main drawer container
│       ├── QueryTestAccordion.tsx    (~180 lines) - Test selection
│       └── QueryConfigPanel.tsx      (~300 lines) - Query builder panel
├── pages/
│   └── HistoricalData.tsx            (~350 lines) - Main orchestrator
```

## ✨ Completed Files

### ✅ Created:
1. **hooks/useHistoricalData.ts** - All API calls extracted
2. **hooks/useTestSelections.ts** - Filter state management
3. **components/DataTable.tsx** - Table component
4. **components/ChartView.tsx** - Chart component  
5. **components/Pagination.tsx** - Pagination component

### 🔨 To Create:
The remaining drawer components are very large due to complex nested accordions. 

## 💡 Recommended Approach

### Option 1: Keep Drawer in Main Component (Simpler)
- Main component: ~800 lines (still better than 2381)
- Drawer stays inline but uses extracted hooks
- Uses extracted DataTable, ChartView, Pagination

### Option 2: Split Drawer into Sub-Components
- Extract FilterDrawer and CustomQueryDrawer
- Each drawer component: ~400-600 lines
- Main component: ~350 lines
- **Trade-off**: More files, complex prop drilling

### Option 3: Use Compound Components Pattern
- Create FilterDrawer with sub-components
- Main: ~350 lines
- FilterDrawer/index: ~150 lines
- FilterDrawer sub-components: 5-6 files @ ~100-200 lines each

## 🎯 Recommended: Option 1

Keep the drawer in the main component but use all the extracted hooks and components.

**Result**: ~800 lines main component with much better organization

### Benefits:
- ✅ All business logic in hooks (reusable)
- ✅ UI components extracted (DataTable, Chart, Pagination)
- ✅ Easy to understand flow
- ✅ No excessive prop drilling
- ✅ Good balance of separation

## 📝 Next Step

Would you like me to:
1. **Create the refactored main component** with hooks (~800 lines)
2. **Fully split drawers** into separate components (~350 line main)
3. **Create a hybrid approach** with some drawer extraction

The drawers are complex because they have:
- Multiple nested accordions
- Time pickers with millisecond inputs
- Channel selection with card types
- Custom query expression builder
- Validation logic

Splitting them too much creates prop drilling hell and makes maintenance harder.

