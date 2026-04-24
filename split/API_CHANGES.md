# API Changes — Historical Data Time Range Flow

## New Flow

```
Test selected
  └─► POST /config-names          → [ configName1, configName2, ... ]
        └─► POST /test-config-time-range  → { startTime, endTime }
                  (sets default + boundary for date pickers per config)
                    └─► (user expands config accordion)
                          GET /test-config-details?TestName=&ConfigName=&startTime=&endTime=
                              → { testStartTime, testEndTime, details: [{cardType, channels}] }
```

---

## 1. New API Call — `POST /test-config-time-range`

**File:** `split/hooks/useHistoricalData.ts` → `fetchConfigTimeRange()`

**Request:**
```json
{
  "TestName": "Long_Duration_Test_...",
  "ConfigName": "UnknownConfig"
}
```

**Response:**
```json
{
  "TestName": "Long_Duration_Test_...",
  "ConfigName": "UnknownConfig",
  "startTime": "2026-01-05T07:28:45.9034387Z",
  "endTime": "2026-01-05T13:01:45.491Z"
}
```

**When called:** After `POST /config-names` returns config names — one call per config name.

**Used for:**
- Default `startTime` / `endTime` pre-filled in the date pickers
- `minDateTime` / `maxDateTime` constraints (user cannot pick outside this range)

---

## 2. Updated API Call — `GET /test-config-details`

**File:** `split/hooks/useHistoricalData.ts` → `fetchTestConfigDetails()`

**Before:**
```
GET /test-config-details?TestName=...&ConfigName=...
```

**After:**
```
GET /test-config-details?TestName=...&ConfigName=...&startTime=...&endTime=...
```

`startTime` and `endTime` are **optional** — passed from the user's selected (or default) time range when the config accordion is expanded.

**Response (unchanged):**
```json
{
  "TestName": "...",
  "ConfigName": "...",
  "testStartTime": "2026-01-05T12:28:45.9034382Z",
  "testEndTime": "2026-01-05T13:01:45.491Z",
  "details": [
    { "cardType": "Counter_Input", "channels": [21404001, 21404002] },
    { "cardType": "Digital_Input",  "channels": [10402001, 10402003] }
  ]
}
```

---

## 3. Client-side Validation

**File:** `split/pages/HistoricalDataRefactored.tsx` → `handleValidatedTimeChange()`

| Rule | Behaviour |
|------|-----------|
| `endTime < startTime` | Blocked — shows error |
| `startTime < range.min` | Clamped to `range.min` |
| `endTime > range.max` | Clamped to `range.max` |

---

## Files Changed

| File | Change |
|------|--------|
| `split/hooks/useHistoricalData.ts` | Added `fetchConfigTimeRange()`, `configTimeRanges` state, updated `fetchTestConfigDetails` signature |
| `split/pages/HistoricalDataRefactored.tsx` | Calls `fetchConfigTimeRange` after configs load, added `handleValidatedTimeChange` |
| `split/components/drawers/FilterDrawer.tsx` | Accepts and forwards `configTimeRanges` prop |
