/** @format */

import { useCallback, useRef, useState } from "react";
import { UrlConstant } from "../util/UrlConstans";

/**
 * Shape of a single recorded data point returned by the backend API.
 * Matches InfluxDB-style fields referenced in Plots.tsx:
 *   data.ChannelId, data._time, data._value
 */
export interface RecordedDataPoint {
  ChannelId: string;
  _time: string;
  _value: number | string;
  [key: string]: any;
}

/**
 * useRecordedLiveData
 *
 * Provides:
 *  - recordedDataTimeRangeRef : MutableRef<[startMs, endMs]>
 *      The currently visible time window anchored to the latest live timestamp.
 *      Stored as a ref so the CustomSlider can read it without causing re-renders.
 *
 *  - refreshTimeRangeRef(latestTimeMs)
 *      Call this with the latest data timestamp (in ms) whenever the user
 *      pauses — it re-anchors the window to a 10-second span ending at that time.
 *
 *  - fetchRecordedData(startTimeISO, durationSecs?)
 *      Fetches recorded channel data from the backend.
 *      Returns a Promise<RecordedDataPoint[] | null>.
 *
 *  - loading
 *      True while a fetch is in-flight.
 */
export const useRecordedLiveData = () => {
  const [loading, setLoading] = useState(false);

  /**
   * [startMs, endMs] — the slider's full allowable range.
   * Initialised to the last 10 seconds relative to mount time.
   */
  const recordedDataTimeRangeRef = useRef<[number, number]>([
    Date.now() - 10_000,
    Date.now(),
  ]);

  /**
   * Re-anchors the time window to a 10-second span ending at `latestTimeMs`.
   * Should be called just before the recorded-data fetch on pause.
   */
  const refreshTimeRangeRef = useCallback((latestTimeMs: number) => {
    recordedDataTimeRangeRef.current = [
      latestTimeMs - 10_000,
      latestTimeMs,
    ];
  }, []);

  /**
   * Fetches recorded channel data from the backend API.
   *
   * GET /api/live-data/recorded?start=<ISO>&duration=<seconds>
   *
   * @param startTimeISO  ISO-8601 string — start of the window.
   * @param durationSecs  Width of the window in seconds (default 10).
   * @returns             Promise resolving to RecordedDataPoint[] or null on error.
   */
  const fetchRecordedData = useCallback(
    (
      startTimeISO: string,
      durationSecs: number = 10,
    ): Promise<RecordedDataPoint[] | null> => {
      setLoading(true);

      const baseUrl =
        (UrlConstant as any).RECORDED_DATA_URL ||
        "http://localhost:5000/api/live-data/recorded";

      const url = new URL(baseUrl);
      url.searchParams.set("start", startTimeISO);
      url.searchParams.set("duration", String(durationSecs));

      return fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include", // carry auth session cookies
      })
        .then((res) => {
          if (!res.ok) {
            console.error(
              `[useRecordedLiveData] API error ${res.status}: ${res.statusText}`,
            );
            return null;
          }
          return res.json() as Promise<RecordedDataPoint[]>;
        })
        .catch((err) => {
          console.error("[useRecordedLiveData] Fetch failed:", err);
          return null;
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [],
  );

  return {
    recordedDataTimeRangeRef,
    refreshTimeRangeRef,
    fetchRecordedData,
    loading,
  };
};
