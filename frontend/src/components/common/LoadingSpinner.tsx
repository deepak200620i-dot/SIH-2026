import React from "react";

export const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-400 border-t-transparent" />
  </div>
);
