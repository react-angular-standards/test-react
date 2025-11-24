import React, { useState, useEffect } from "react";
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { muiTheme } from "../theme/muiTheme";

interface User {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

const AUTH_API_BASE = process.env.REACT_APP_AUTH_API_URL || "http://localhost:5002";

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${AUTH_API_BASE}/users`, {
        credentials: "include",
      });

      if (response.status === 403) {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }

      if (response.status === 401) {
        setError("Not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  const handleSave = async (userId: string) => {
    const newRole = pendingChanges[userId];
    if (!newRole) return;

    setSaving(userId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${AUTH_API_BASE}/users/${userId}/permission`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.status === 403) {
        setError("Access denied. Admin privileges required.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update permission");
      }

      const result = await response.json();

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

      // Clear pending change for this user
      setPendingChanges((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });

      setSuccess(`Permission updated: ${result.old_role} -> ${result.new_role}`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update permission");
    } finally {
      setSaving(null);
    }
  };

  const getCurrentRole = (user: User) => {
    return pendingChanges[user.id] ?? user.role;
  };

  const hasChanges = (userId: string) => {
    return pendingChanges[userId] !== undefined;
  };

  if (loading) {
    return (
      <ThemeProvider theme={muiTheme}>
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: "#1976d2" }}>
            User Management
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {users.length === 0 ? (
            <Typography color="text.secondary">No users found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell sx={{ fontWeight: 600 }}>User ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{user.id}</TableCell>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{user.name}</TableCell>
                      <TableCell sx={{ fontSize: "0.85rem" }}>{user.email || "-"}</TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={getCurrentRole(user)}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          sx={{ minWidth: 100, fontSize: "0.85rem" }}
                        >
                          <MenuItem value="admin">Admin</MenuItem>
                          <MenuItem value="user">User</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!hasChanges(user.id) || saving === user.id}
                          onClick={() => handleSave(user.id)}
                          sx={{ textTransform: "none", fontSize: "0.8rem" }}
                        >
                          {saving === user.id ? "Saving..." : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default UserManagement;
