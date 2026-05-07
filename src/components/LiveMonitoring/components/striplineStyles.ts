import React from "react";

// --- Constants & Styles ---
export const striplineTooltipStyles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    borderRadius: "8px",
    padding: "12px",
    boxShadow:
      "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
    border: "1px solid #334155",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: "12px",
    width: "max-content",
    minWidth: "320px",
    pointerEvents: "auto",
    userSelect: "none",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #334155",
    cursor: "default",
  },
  icon: {
    color: "#94a3b8",
    fontSize: "14px",
    cursor: "grab",
  },
  title: {
    fontWeight: 600,
    fontSize: "13px",
    color: "#e2e8f0",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "14px",
    padding: "4px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tableWrapper: {
    maxHeight: "200px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  th: {
    padding: "6px 8px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#94a3b8",
    borderBottom: "1px solid #334155",
    position: "sticky",
    top: 0,
    backgroundColor: "#0f172a",
    zIndex: 1,
  },
  tr: {
    borderBottom: "1px solid #1e293b",
  },
  td: {
    padding: "6px 8px",
    color: "#cbd5e1",
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
  },
  footer: {
    marginTop: "12px",
    paddingTop: "8px",
    borderTop: "1px solid #334155",
    display: "flex",
    justifyContent: "center",
  },
};

