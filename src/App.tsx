import React, { useState, useEffect } from "react";
import { AppBar, Toolbar, Typography, Button, Box, Chip } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import HistoricalData from "./pages/HistoricalDataRefactored";
import UserManagement from "./pages/UserManagement";
import { muiTheme } from "./theme/muiTheme";
import "./App.css";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

const AUTH_API_BASE =
  process.env.REACT_APP_AUTH_API_URL || "http://localhost:5002";

function App() {
  const [currentPage, setCurrentPage] = useState<"historical" | "users">(
    "historical",
  );
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check user session and role on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${AUTH_API_BASE}/auth/session`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          // Check if user is admin by fetching users list (only admins can access)
          checkAdminStatus();
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };

    const checkAdminStatus = async () => {
      try {
        const response = await fetch(`${AUTH_API_BASE}/users`, {
          credentials: "include",
        });
        if (response.ok) {
          setIsAdmin(true);
        }
      } catch (err) {
        setIsAdmin(false);
      }
    };

    checkSession();
  }, []);

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="App">
        <AppBar position="static" sx={{ bgcolor: "#1976d2" }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
              TAS Data Platform
            </Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Button
                color="inherit"
                onClick={() => setCurrentPage("historical")}
                sx={{
                  fontWeight: currentPage === "historical" ? 700 : 400,
                  borderBottom:
                    currentPage === "historical" ? "2px solid white" : "none",
                }}
              >
                Historical Data
              </Button>
              {isAdmin && (
                <Button
                  color="inherit"
                  onClick={() => setCurrentPage("users")}
                  sx={{
                    fontWeight: currentPage === "users" ? 700 : 400,
                    borderBottom:
                      currentPage === "users" ? "2px solid white" : "none",
                  }}
                >
                  User Management
                </Button>
              )}
              {user && (
                <Chip
                  label={`${user.name}${isAdmin ? " (Admin)" : ""}`}
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
                />
              )}
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ mt: 0 }}>
          {currentPage === "historical" && <HistoricalData />}
          {currentPage === "users" && isAdmin && <UserManagement />}
        </Box>
      </div>
    </ThemeProvider>
  );
}

export default App;
