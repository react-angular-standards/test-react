import React from "react";
import { AppBar, Toolbar, Typography, Avatar, Button, Box } from "@mui/material";
import { ShieldLockIcon } from "@primer/octicons-react";
import { Link, useLocation } from "react-router-dom";

interface AppHeaderProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  isAdmin: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ user, isAdmin }) => {
  const location = useLocation();
  return (
    <AppBar position="static" sx={{ backgroundColor: "#1976d2" }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          component={Link}
          to="/"
          variant="h6"
          sx={{ fontWeight: "bold", color: "white", textDecoration: "none", flexGrow: 0 }}
        >
          TAS Data Platform
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          component={Link}
          to="/"
          sx={{
            color: "white",
            fontWeight: location.pathname === "/" ? "bold" : "normal",
            borderBottom: location.pathname === "/" ? "2px solid white" : "none",
            borderRadius: 0,
          }}
        >
          Historical Data
        </Button>

        {isAdmin && (
          <Button
            component={Link}
            to="/users"
            sx={{
              color: "white",
              fontWeight: location.pathname === "/users" ? "bold" : "normal",
              borderBottom: location.pathname === "/users" ? "2px solid white" : "none",
              borderRadius: 0,
              gap: 0.5,
            }}
          >
            <ShieldLockIcon size={16} />
            User Management
          </Button>
        )}

        {user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
              sx={{ width: 32, height: 32 }}
              alt={user.name}
            />
            <Typography sx={{ color: "white", fontSize: "14px" }}>
              {user.name}
              {isAdmin && " (Admin)"}
            </Typography>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
