/** @format */

import { useState, useEffect, useCallback } from "react";

interface UseFetchParams {
  [key: string]: string | number; // Allows for multiple parameters of type string or number
}

const useFetch = <T>(urlTemplate: string) => {
  //const [data, setData] = useState<T | null>(null); // Todo: update to hold latest data
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (params: UseFetchParams): Promise<T | null> => {
      setLoading(true);
      setError(null);
      let result: T | null = null;
      try {
        // Construct the URL based on the template and parameters
        const url = Object.keys(params).reduce((acc, key) => {
          return acc.replace(
            `{${key}}`,
            encodeURIComponent(String(params[key])),
          );
        }, urlTemplate);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        result = await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        result = null;
      } finally {
        setLoading(false);
      }
      return result;
    },
    [],
  );

  return { loading, error, fetchData };
};

export default useFetch;
