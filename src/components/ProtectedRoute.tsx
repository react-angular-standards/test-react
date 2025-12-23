import React from "react";
import Forbidden403 from "../pages/Forbidden403";

interface ProtectedRouteProps {
  isAdmin: boolean;
  userRole?: string;
  onGoBack: () => void;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAdmin,
  userRole,
  onGoBack,
  children,
}) => {
  if (!isAdmin) {
    return <Forbidden403 userRole={userRole} onGoBack={onGoBack} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
