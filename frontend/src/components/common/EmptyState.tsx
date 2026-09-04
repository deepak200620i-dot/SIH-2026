import React from "react";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, icon }) => (
  <div className="flex flex-col items-center justify-center p-12 text-gray-400">
    {icon && <div className="text-4xl mb-4">{icon}</div>}
    <p>{message}</p>
  </div>
);
