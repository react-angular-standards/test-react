import {
  FilterRequestBody,
  CustomQueryRequest,
  TestConfigDetailsResponse,
} from "../types/historicalData.types";

/**
 * API service class for Historical Data operations
 */
export class HistoricalDataApi {
  private apiBase: string;

  constructor(apiBase: string) {
    this.apiBase = apiBase;
  }

  /**
   * Fetch all test names
   */
  async fetchTestNames(): Promise<string[]> {
    const response = await fetch(`${this.apiBase}/all-test-names`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.TestName || [];
  }

  /**
   * Fetch config names for a specific test
   */
  async fetchConfigNames(testName: string): Promise<string[]> {
    const response = await fetch(`${this.apiBase}/config-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TestName: testName }),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.ConfigName || [];
  }

  /**
   * Fetch test config details
   */
  async fetchTestConfigDetails(
    testName: string,
    configName: string
  ): Promise<TestConfigDetailsResponse> {
    const response = await fetch(
      `${this.apiBase}/test-config-details?TestName=${encodeURIComponent(
        testName
      )}&ConfigName=${encodeURIComponent(configName)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  }

  /**
   * Fetch filtered data
   */
  async fetchFilteredData(
    requestBody: FilterRequestBody
  ): Promise<{ data: any[]; totalCount: number }> {
    const response = await fetch(`${this.apiBase}/filter`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    return {
      data: result.data || [],
      totalCount: result.totalCount || 0,
    };
  }

  /**
   * Fetch custom query data
   */
  async fetchCustomQueryData(
    requestBody: CustomQueryRequest
  ): Promise<any[]> {
    const response = await fetch(`${this.apiBase}/custom-query`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    return result || [];
  }
}
