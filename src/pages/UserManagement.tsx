/** @format */

import React from 'react';
import { Box, Typography } from '@mui/material';

const UserManagement: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">User Management</Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        User management functionality will be implemented here.
      </Typography>
    </Box>
  );
};

export default UserManagement;
