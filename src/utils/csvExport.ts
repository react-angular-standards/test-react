import dayjs from "dayjs";
import { DataRow } from "../types/historicalData.types";

interface Column {
  field: string;
  headerName?: string;
}

/**
 * Exports data to CSV format and triggers download
 * @param data - Array of data rows to export
 * @param columns - Column definitions for the data
 * @param filename - Optional custom filename prefix
 * @returns Success status and error message if failed
 */
export const exportToCSV = (
  data: DataRow[],
  columns: Column[],
  filename?: string
): { success: boolean; error?: string } => {
  if (data.length === 0) {
    return { success: false, error: "No data available to export" };
  }

  try {
    // Get column headers
    const headers = columns.map((col) => col.headerName || col.field);
    const headerRow = headers.join(",");

    // Get data rows
    const dataRows = data.map((row) => {
      return columns
        .map((col) => {
          const value = row[col.field];
          // Handle values that contain commas or quotes
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",");
    });

    // Combine headers and data
    const csvContent = [headerRow, ...dataRows].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    // Generate filename with timestamp
    const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
    const finalFilename = filename
      ? `${filename}_${timestamp}.csv`
      : `export_${timestamp}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", finalFilename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Failed to export CSV: ${err.message}` };
  }
};
