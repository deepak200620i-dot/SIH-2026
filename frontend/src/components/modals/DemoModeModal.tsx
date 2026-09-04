import React from "react";
import { Play, Square } from "lucide-react";

interface DemoModeModalProps {
  isActive: boolean;
  onToggle: () => void;
}

export const DemoModeModal: React.FC<DemoModeModalProps> = ({ isActive, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-6 left-6 px-4 py-3 rounded font-semibold text-sm transition flex items-center gap-2 ${
        isActive
          ? "bg-purple-600 hover:bg-purple-700 text-white"
          : "bg-gray-800 hover:bg-gray-700 text-gray-300"
      }`}
    >
      {isActive ? (
        <>
          <Square size={16} /> Stop Demo
        </>
      ) : (
        <>
          <Play size={16} /> Start Demo
        </>
      )}
    </button>
  );
};
