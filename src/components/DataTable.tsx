import React from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Box, CircularProgress } from "@mui/material";
import { DataRow } from "../types/historicalData.types";

interface DataTableProps {
  data: DataRow[];
  columns: GridColDef[];
  loading: boolean;
}

const DataTable: React.FC<DataTableProps> = ({ data, columns, loading }) => {
  return (
    <Box sx={{ height: 500, width: "100%", overflow: "hidden" }}>
      <DataGrid
        rows={data}
        columns={columns}
        loading={loading}
        hideFooter={true}
        sx={{
          boxShadow: 1,
          borderRadius: 1,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          "& .MuiDataGrid-columnHeaders": { bgcolor: "#f5f5f5" },
          fontSize: "0.75rem",
        }}
      />
    </Box>
  );
};

export default DataTable;
