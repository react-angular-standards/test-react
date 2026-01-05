# Channel Display Format: "ChannelID - ChannelName"

## Current Implementation

### 1. Data Fetching (`fetchConfiguredChannels.ts`)
The API returns channels in the format:
```tsx
continuousDataChannel.push({
  value: channelId + ' - ' + channel.channel_name,  // e.g., "10704001 - Temperature Sensor"
  label: channelId + ' - ' + channel.channel_name,
  chassisId: chassisName,
  cardId: card.Task_id,
  isSelectAll: false,
  channelName: channel.channel_name ?? 'Unknown',
});
```

### 2. Channel Selection (CascadingMultiSelect)
When users select channels:
- The `value` field (already formatted as "channelId - channelName") is used
- This value is passed to `onChannelSelect` callback
- Stored in `availableChannels` array

### 3. Display in Groups (PlotGroupSelection)
Channels are displayed as:
```tsx
{channel}  // This displays the full "channelId - channelName" string
```

## Expected Behavior

### In Dropdown
```
Select Channels:
☑ 10704001 - Temperature Sensor
☑ 10704002 - Pressure Sensor  
☑ 10704003 - Humidity Sensor
```

### In Available Channels (Primary Group)
```
[10704001 - Temperature Sensor] [10704002 - Pressure Sensor]
```

### In Channel Groups
```
Group 1:
[10704001 - Temperature Sensor] [×]
[10704003 - Humidity Sensor] [×]
```

## Verification Steps

To verify the format is working correctly:

1. **Open Browser DevTools Console**
2. **Connect** to Local or Remote
3. **Select channels** from dropdown
4. **Check Console** for:
   ```
   selectedChannels ["10704001 - Temperature Sensor", "10704002 - Pressure Sensor"]
   ```
5. **Check UI** - should display full format in:
   - Available channels chips
   - Channel group chips
   - Drag-and-drop items

## Data Flow

```
API Response
    ↓
fetchConfiguredChannels
    ↓
Options created with:
  value: "channelId - channelName"
  label: "channelId - channelName"
    ↓
User selects channels
    ↓
selectedOptions array contains full format
    ↓
handleStreamButtonClick
    ↓
onChannelSelect(channelIds)  // Pass array of "channelId - channelName"
    ↓
availableChannels state updated
    ↓
PlotGroupSelection displays {channel}
```

## Important Notes

1. **Channel Storage**: The `availableChannels` and `channelGroups.channels` arrays store the complete string format
2. **Channel ID Extraction**: When you need just the numeric ID (e.g., for WebSocket requests), extract it:
   ```tsx
   const channelId = channel.split(' - ')[0];  // "10704001 - Temperature" → "10704001"
   ```
3. **Display**: Always use the full string for UI display
4. **Refs**: The `activePlotChannelsRef` uses numeric channelId as key, but stores name with format

## If Only Seeing Channel ID

If you're only seeing the channel ID without the name, check:

1. ✅ API response includes `channel_name` field
2. ✅ `fetchConfiguredChannels` is concatenating correctly
3. ✅ Console log shows full format in `availableOptionListToSelect`
4. ✅ Selected options maintain the format
5. ✅ Display components are using `{channel}` not `{channel.split('-')[0]}`

## Code References

- **Fetching**: `src/components/LiveMonitoring/utils/fetchConfiguredChannels.ts:135-145`
- **Selection**: `src/components/LiveMonitoring/components/CascadingMultiSelect.tsx:145-155`
- **Display**: `src/components/LiveMonitoring/components/PlotGroupSelection.tsx:212, 135`
