import React from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";

interface Forbidden403Props {
  userRole?: string;
  onGoBack?: () => void;
}

const Forbidden403: React.FC<Forbidden403Props> = ({
  userRole = "non_admin",
  onGoBack,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80vh",
        padding: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          maxWidth: 600,
          textAlign: "center",
          borderTop: "4px solid #d32f2f",
        }}
      >
        <BlockIcon
          sx={{
            fontSize: 80,
            color: "#d32f2f",
            marginBottom: 2,
          }}
        />
        <Typography variant="h3" component="h1" gutterBottom color="#d32f2f">
          403 Forbidden
        </Typography>
        <Typography variant="h6" gutterBottom color="text.secondary">
          You don't have permission to access this resource
        </Typography>
        <Box sx={{ marginTop: 3, marginBottom: 3 }}>
          <Typography variant="body1" paragraph>
            Your current role: <strong>{userRole}</strong>
          </Typography>
          <Typography variant="body1" paragraph>
            Required role: <strong>admin</strong>
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Please contact your administrator to request access to this resource.
        </Typography>
        {onGoBack && (
          <Button
            variant="contained"
            color="primary"
            onClick={onGoBack}
            sx={{ marginTop: 2 }}
          >
            Go Back to Home
          </Button>
        )}
      </Paper>
    </Box>
  );
};

export default Forbidden403;
