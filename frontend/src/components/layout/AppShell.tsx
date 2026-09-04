import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  pageTitle?: string;
  alertCount?: number;
}

export const AppShell: React.FC<AppShellProps> = ({ pageTitle, alertCount = 0 }) => {
  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <TopBar title={pageTitle} alertCount={alertCount} />


        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
