# Custom Query Feature Status

## 📊 Current Status

### ✅ What's Included:
- **Filter Tab**: Fully working with all features
  - Test selection
  - Config selection
  - Channel selection  
  - Time range selection
  - Card types
  - Data fetching
  - CSV export

### 🔨 What's Missing:
- **Custom Query Tab**: Not yet implemented in refactored version

## 🎯 Why Custom Query Is Not Included

The Custom Query feature is **very complex**:
- ~400-500 lines of UI code
- Channel expression builder
- Mathematical operators (+, -, *, /)
- Output channel naming
- Validation logic
- Custom API endpoint

## 📝 Where to Find Custom Query

The full implementation exists in the **original file**:

```
/Users/dhanraj/Desktop/asit/asit.tsx
```

Lines: ~1400-1900 (Custom Query drawer and logic)

## 🔧 How to Add Custom Query

### Option 1: Use Original File (Quick)
If you need Custom Query immediately, use the original `asit.tsx` file:

```bash
# Copy original to React app
cp /Users/dhanraj/Desktop/asit/asit.tsx \\
   /Users/dhanraj/Desktop/asit/react-app/src/pages/HistoricalDataOriginal.tsx
```

Then use that instead of HistoricalDataRefactored.tsx

### Option 2: Extract Custom Query (Proper)

I can create the custom query feature as separate components:

**Files to Create**:
1. `hooks/useCustomQuerySelections.ts` (~350 lines) ✅ CREATED
2. `components/drawers/CustomQueryDrawer.tsx` (~400 lines)
3. Update `HistoricalDataRefactored.tsx` to include tabs (~50 lines added)

**Result**: Main component would be ~400 lines (still under 500!)

### Option 3: Simplified Custom Query

Create a simplified version:
- Basic expression builder
- Limited to 2 channels
- Simple operators only
- ~150 lines total

## 🚀 Quick Implementation

### If You Want Me to Add It:

I can add the Custom Query tab with these steps:

1. **Create CustomQueryDrawer.tsx** (~400 lines)
   - Channel selection
   - Operator buttons (+, -, *, /)
   - Expression preview
   - Output channel naming
   - Validation

2. **Update Main Component** (~50 lines)
   - Add Tabs component
   - Switch between Filter/CustomQuery
   - Handle custom query data fetching

3. **Integrate with API** 
   - Use existing `fetchCustomQueryData` hook

**Time**: ~30 minutes
**Result**: Full custom query feature working

## 💡 Recommendation

### For Now:
Use the **Filter Tab** which has all the essential features:
- Select tests, configs, channels
- Filter by time range
- View data (table/chart)
- Export to CSV

### When You Need Custom Query:
1. Let me know and I'll create the components
2. Or use the original `asit.tsx` file
3. Or extract it yourself from the original

## 📊 Comparison

| Feature | Filter Tab | Custom Query |
|---------|-----------|--------------|
| Select Tests | ✅ | ✅ |
| Select Channels | ✅ | ✅ |
| Time Range | ✅ | ✅ |
| View Data | ✅ | ✅ |
| Export CSV | ✅ | ✅ |
| **Math Operations** | ❌ | ✅ |
| **Custom Expressions** | ❌ | ✅ |
| **Channel Algebra** | ❌ | ✅ |

## 🎯 Decision

**Do you want me to add Custom Query now?**

If yes, I'll create:
- CustomQueryDrawer component
- Tab switching in main component
- Full mathematical expression builder
- Integration with custom query API

Total addition: ~450 lines across 2 files
Main component: Still under 450 lines ✅

**Current Status**: Filter tab fully working, Custom Query hook created but drawer not implemented yet.

---

**Note**: The refactored version prioritizes maintainability. Adding Custom Query properly keeps the code clean and modular!
