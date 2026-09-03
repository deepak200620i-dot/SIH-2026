import React, { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0e17] flex overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      
      <main 
        className={`flex-1 min-h-screen overflow-y-auto transition-all duration-300 
          ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}
      >
        <div className="p-6 max-w-[1920px] mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
