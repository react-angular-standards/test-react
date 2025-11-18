import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Autocomplete,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}) => {
  const [localPage, setLocalPage] = useState<number | string>(1);
  const [localPageSize, setLocalPageSize] = useState<string>("10");
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    setLocalPage(currentPage + 1);
  }, [currentPage]);

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLocalPage(value ? Number(value) : "");
  };

  const handlePageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      let newPage = typeof localPage === "number" ? localPage - 1 : 0;
      const maxPage = Math.max(0, totalPages - 1);
      if (newPage < 0) newPage = 0;
      if (newPage > maxPage) newPage = maxPage;
      if (!isNaN(newPage)) {
        onPageChange(newPage);
      }
    }
  };

  const handlePreviousPage = () => {
    onPageChange(Math.max(0, currentPage - 1));
  };

  const handleNextPage = () => {
    onPageChange(Math.min(totalPages - 1, currentPage + 1));
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 1,
        mt: 2,
      }}
    >
      <Typography variant="body2">Rows per page:</Typography>
      <Autocomplete
        freeSolo
        disableClearable
        options={[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
        getOptionLabel={(option) => option.toString()}
        value={pageSize}
        onChange={(event, newValue) => {
          let num = typeof newValue === "string" ? parseInt(newValue, 10) : newValue;
          if (isNaN(num) || num <= 0) num = 10;
          onPageSizeChange(num);
          onPageChange(0);
        }}
        inputValue={localPageSize}
        onInputChange={(event, newInputValue) => {
          setLocalPageSize(newInputValue);
        }}
        renderInput={(params) => <TextField {...params} size="small" sx={{ width: 100 }} />}
      />
      <IconButton onClick={handlePreviousPage} disabled={currentPage === 0}>
        <ArrowBackIcon />
      </IconButton>
      <TextField
        size="small"
        type="number"
        value={localPage}
        onChange={handlePageInputChange}
        onKeyDown={handlePageKeyDown}
        sx={{ width: 70 }}
        inputProps={{ min: 1, max: totalPages }}
      />
      <Typography variant="body2">/ {totalPages || 1}</Typography>
      <IconButton
        onClick={handleNextPage}
        disabled={currentPage >= totalPages - 1 || totalPages === 0}
      >
        <ArrowForwardIcon />
      </IconButton>
    </Box>
  );
};

export default Pagination;
