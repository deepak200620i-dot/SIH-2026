import React from 'react';
import { MdErrorOutline, MdRefresh } from 'react-icons/md';

export default function ErrorState({ message = 'Failed to load data', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
      <MdErrorOutline className="size-10 text-red-500/60" />
      <div className="text-center">
        <h3 className="text-sm font-medium text-gray-400">Connection Error</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 hover:border-gray-600 transition-colors font-mono uppercase tracking-wider"
        >
          <MdRefresh className="size-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
