import React from "react";
import { useNavigate } from "react-router-dom";
import Forbidden403 from "../pages/Forbidden403";

interface ProtectedRouteProps {
  isAdmin: boolean;
  userRole?: string;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAdmin,
  userRole,
  children,
}) => {
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <Forbidden403
        userRole={userRole}
        onGoBack={() => navigate("/")}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
