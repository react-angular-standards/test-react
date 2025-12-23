import React from "react";
import { Header, Avatar, StyledOcticon } from "@primer/react";
import { PersonIcon, ShieldLockIcon } from "@primer/octicons-react";

interface AppHeaderProps {
  currentPage: "historical" | "users";
  onNavigate: (page: "historical" | "users") => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  isAdmin: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  currentPage,
  onNavigate,
  user,
  isAdmin,
}) => {
  return (
    <Header
      sx={{
        backgroundColor: "#1976d2",
        color: "white",
        padding: "12px 24px",
      }}
    >
      <Header.Item>
        <Header.Link
          href="#"
          sx={{
            fontSize: 3,
            fontWeight: "bold",
            color: "white",
            "&:hover": { color: "white", textDecoration: "none" },
          }}
        >
          TAS Data Platform
        </Header.Link>
      </Header.Item>

      <Header.Item full></Header.Item>

      <Header.Item>
        <Header.Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("historical");
          }}
          sx={{
            color: "white",
            fontWeight: currentPage === "historical" ? "bold" : "normal",
            borderBottom:
              currentPage === "historical" ? "2px solid white" : "none",
            paddingBottom: "4px",
            "&:hover": { color: "white" },
          }}
        >
          Historical Data
        </Header.Link>
      </Header.Item>

      {isAdmin && (
        <Header.Item>
          <Header.Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("users");
            }}
            sx={{
              color: "white",
              fontWeight: currentPage === "users" ? "bold" : "normal",
              borderBottom:
                currentPage === "users" ? "2px solid white" : "none",
              paddingBottom: "4px",
              "&:hover": { color: "white" },
            }}
          >
            <StyledOcticon icon={ShieldLockIcon} sx={{ mr: 1 }} />
            User Management
          </Header.Link>
        </Header.Item>
      )}

      {user && (
        <Header.Item sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Avatar
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
            size={32}
            alt={user.name}
          />
          <span style={{ color: "white", fontSize: "14px" }}>
            {user.name}
            {isAdmin && " (Admin)"}
          </span>
        </Header.Item>
      )}
    </Header>
  );
};

export default AppHeader;
