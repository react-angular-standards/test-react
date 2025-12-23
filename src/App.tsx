import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { ThemeProvider, BaseStyles } from "@primer/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import HistoricalData from "./pages/HistoricalDataRefactored";
import UserManagement from "./pages/UserManagement";
import AppHeader from "./components/AppHeader";
import ProtectedRoute from "./components/ProtectedRoute";
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
          // Check if user is admin using explicit endpoint
          checkAdminStatus();
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };

    const checkAdminStatus = async () => {
      try {
        const response = await fetch(`${AUTH_API_BASE}/api/me/is-admin`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (err) {
        setIsAdmin(false);
      }
    };

    checkSession();
  }, []);

  return (
    <ThemeProvider>
      <BaseStyles>
        <MuiThemeProvider theme={muiTheme}>
          <div className="App">
            <AppHeader
              currentPage={currentPage}
              onNavigate={setCurrentPage}
              user={user}
              isAdmin={isAdmin}
            />

            <Box sx={{ mt: 0 }}>
              {currentPage === "historical" && <HistoricalData />}
              {currentPage === "users" && (
                <ProtectedRoute
                  isAdmin={isAdmin}
                  userRole={user?.role}
                  onGoBack={() => setCurrentPage("historical")}
                >
                  <UserManagement />
                </ProtectedRoute>
              )}
            </Box>
          </div>
        </MuiThemeProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}

export default App;
