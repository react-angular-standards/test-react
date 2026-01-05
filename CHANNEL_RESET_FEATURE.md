# Channel Reset on Connection Off Feature

## Overview
When the connection status changes to `'Off'`, the application now automatically resets all selected channels and channel groups to ensure a clean state.

## Changes Made

### 1. CascadingMultiSelect Component
**File**: `src/components/LiveMonitoring/components/CascadingMultiSelect.tsx`

**What was changed:**
- Split the useEffect logic into two separate effects for better control
- Added dedicated useEffect to reset channels when `connectionStatus === 'Off'`

**What gets reset:**
```tsx
- selectedOptions → []
- availableChannels → []
- activeDiscreteChannelsRef.current → {}
- activePlotChannelsRef.current → {}
- channelIdToPlotInfoRef.current → {}
```

### 2. LiveMonitorContext
**File**: `src/components/LiveMonitoring/context/LiveMonitorContext.tsx`

**What was added:**
- New useEffect hook that monitors `connectionState`
- Automatically clears channel groups and available channels when connection turns off

**What gets reset:**
```tsx
- channelGroups → []
- availableChannels → []
```

## Behavior

### Before Connection Off:
- User has selected channels in the dropdown
- User has created channel groups
- Channels are assigned to various groups
- Data is streaming

### After Connection Off:
✅ Selected channels dropdown is cleared
✅ All channel groups are removed
✅ Available channels list is cleared
✅ Plot channels references are cleared
✅ Discrete channels references are cleared
✅ Channel ID to plot info mapping is cleared

### When Reconnecting:
- User starts with a clean slate
- Must re-select channels
- Must re-create channel groups if needed
- Ensures no stale data from previous connection

## Benefits

1. **Clean State** - No leftover data from previous connections
2. **Memory Management** - Clears all references to prevent memory leaks
3. **User Experience** - Clear visual feedback that connection is lost
4. **Data Integrity** - Prevents mixing data from different connection sessions
5. **Predictable Behavior** - Users know exactly what to expect when disconnecting

## Code Example

```tsx
// In LiveMonitorContext
useEffect(() => {
  if (connectionState === 'Off') {
    setChannelGroups([]);
    setAvailableChannels([]);
  }
}, [connectionState]);

// In CascadingMultiSelect
useEffect(() => {
  if (connectionStatus === 'Off') {
    setSelectedOptions([]);
    setAvailableChannels([]);
    activeDiscreteChannelsRef.current = {};
    activePlotChannelsRef.current = {};
    channelIdToPlotInfoRef.current = {};
  }
}, [connectionStatus, setAvailableChannels, activeDiscreteChannelsRef, activePlotChannelsRef, channelIdToPlotInfoRef]);
```

## Testing

To test this feature:

1. **Connect** to Local or Remote
2. **Select** some channels from the dropdown
3. **Create** channel groups
4. **Add** channels to groups
5. **Disconnect** (switch to 'Off')
6. **Verify**:
   - Dropdown shows no selected channels
   - Channel groups are empty
   - Available channels list is cleared

## Related Files

- `src/components/LiveMonitoring/context/LiveMonitorContext.tsx`
- `src/components/LiveMonitoring/components/CascadingMultiSelect.tsx`
- `src/components/LiveMonitoring/components/Monitoring.tsx`
