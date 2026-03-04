/** @format */

import { useState, useRef, useCallback } from "react";
import useFetch from "./useFetch";
import { UrlConstant } from "../util/UrlConstans";

interface RecordedData {
  [key: string]: string | number;
}

export const useRecordedLiveData = () => {
  const recordedDataTimeRangeRef = useRef<number[]>([0, 100]);
  const { loading, error, fetchData } = useFetch<Array<RecordedData>>(
    (UrlConstant as any).RECORDED_DATA_URL ||
      "http://localhost:5000/api/live-data/recorded",
  );

  const refreshTimeRangeRef = useCallback((latestTime: number) => {
    //const currentTime = Date.now();
    const pastTime = latestTime - 15 * 60 * 1000;
    recordedDataTimeRangeRef.current = [pastTime, latestTime];
  }, []);

  const fetchRecordedData = useCallback(
    async (timeStamp: string, duration: number) => {
      //refreshTimeRangeRef();
      return await fetchData({ startTime: timeStamp, duration: duration });
    },
    [fetchData],
  );

  return { recordedDataTimeRangeRef, refreshTimeRangeRef, fetchRecordedData };
};
