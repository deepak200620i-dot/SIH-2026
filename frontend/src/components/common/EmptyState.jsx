import React from 'react';
import { MdInbox } from 'react-icons/md';

export default function EmptyState({ icon, title = 'No data', message = 'There is nothing to display' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
      <div className="text-gray-600">
        {icon || <MdInbox className="size-10" />}
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs">{message}</p>
      </div>
    </div>
  );
}
