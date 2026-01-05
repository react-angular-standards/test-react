# LiveMonitoring Component Library

This directory contains refactored components from `live_backup.tsx`, organized into a maintainable structure.

## Directory Structure

```
LiveMonitoring/
├── components/          # React components
│   ├── CascadingMultiSelect.tsx
│   └── PlotGroupSelection.tsx
├── context/            # React context providers
│   └── LiveMonitorContext.tsx
├── types/              # TypeScript type definitions
│   ├── ChartSchema.ts
│   └── ConfiguredChannelSchema.ts
├── utils/              # Utility functions
│   └── fetchConfiguredChannels.ts
├── index.ts            # Public API exports
└── README.md           # This file
```

## Components

### CascadingMultiSelect
Multi-select dropdown component for selecting data channels.
- **Props**: `onChannelSelect`, `onRecordCall`, `connectionStatus`
- **Features**: Supports "Select All" functionality, dynamic channel loading

### PlotGroupSelection
Dashboard settings panel for managing plot groups and channels.
- **Props**: Various props for channel group management
- **Features**: Drag-and-drop support, buffering range selection, legend toggle

## Context

### LiveMonitoringProvider
Global state management for live monitoring features.
- Manages WebSocket connections (local/remote)
- Handles plot channels and discrete channels
- Controls streaming and recording states

**Usage**:
```tsx
import { LiveMonitoringProvider } from './components/LiveMonitoring';

<LiveMonitoringProvider>
  <YourApp />
</LiveMonitoringProvider>
```

## Types

### ConfiguredChannelSchema
- `Channel`: Individual channel configuration
- `ChannelGroup`: Group of related channels
- `Option`: Select dropdown option type
- `DiscreteChannelState`: 'HIGH' | 'LOW'

### ChartSchema
- `SeriesData`: Chart series data structure
- `PlotOptions`: Chart configuration options
- `ChartInstance`: Chart instance type

## Utils

### fetchConfiguredChannels
Fetches configured channels from the API and processes them into categorized channel lists.

**Parameters**:
- `setLoading`: Loading state setter
- `setError`: Error state setter
- `upateContinuousChannels`: Optional continuous channels updater
- `upateDiscreteInChannels`: Optional discrete input channels updater
- `upateDiscreteOutChannels`: Optional discrete output channels updater
- `upateRelayChannels`: Optional relay channels updater
- `upadteAnalogOutput`: Optional analog output channels updater

## Migration Guide

### Before (using live_backup.tsx):
```tsx
import { fetchConfiguredChannels } from './components/live_backup';
import { useLiveMonitoringContext } from './components/live_backup';
```

### After (using refactored structure):
```tsx
import { fetchConfiguredChannels, useLiveMonitoringContext } from './components/LiveMonitoring';
```

## Remaining Work

The following components from `live_backup.tsx` still need to be refactored:
1. **Monitoring component** - Main monitoring dashboard
2. **Plots component** - Plot visualization component with CanvasJS
3. **Custom hooks** - `useGridLayoutSettings`, `useRecordedLiveData`, `useDataStreamRequester`

These can be extracted following the same pattern established here.

## Notes

- All components maintain their original functionality
- Type safety is preserved with TypeScript
- Context API is used for state management instead of prop drilling
- Components are now more testable and reusable
