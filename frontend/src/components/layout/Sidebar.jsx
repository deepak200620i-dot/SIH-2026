import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  MdDashboard,
  MdVideocam,
  MdNotifications,
  MdHistory,
  MdFence,
  MdFace,
  MdChevronLeft,
  MdChevronRight,
  MdShield,
} from 'react-icons/md';

const navItems = [
  { path: '/', label: 'Dashboard', icon: MdDashboard },
  { path: '/cameras', label: 'Live Cameras', icon: MdVideocam },
  { path: '/alerts', label: 'Alerts', icon: MdNotifications },
  { path: '/events', label: 'Event History', icon: MdHistory },
  { path: '/fence', label: 'Fence Config', icon: MdFence },
  { path: '/faces', label: 'Face Gallery', icon: MdFace },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen z-40
          bg-[#0d1117] border-r border-gray-800/60
          flex flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-64'}
          ${collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        `}
      >
        {/* Logo / Brand */}
        <div className="h-16 flex items-center border-b border-gray-800/60 px-4 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
            <MdShield className="text-white size-5" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-gray-100 tracking-wide truncate">
                IBVAP
              </h1>
              <p className="text-[9px] text-gray-500 uppercase tracking-[0.15em] truncate">
                Border Operations
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;

            return (
              <NavLink
                key={path}
                to={path}
                onClick={() => {
                  // Close sidebar on mobile
                  if (window.innerWidth < 1024 && !collapsed) {
                    onToggle();
                  }
                }}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5
                  transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }
                `}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-cyan-400 rounded-r-full" />
                )}

                <Icon className={`size-5 shrink-0 ${isActive ? 'text-cyan-400' : ''}`} />

                {!collapsed && (
                  <span className="text-sm font-medium truncate">{label}</span>
                )}

                {/* Tooltip for collapsed mode */}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    {label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-gray-800/60 p-2 shrink-0">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
          >
            {collapsed ? (
              <MdChevronRight className="size-5" />
            ) : (
              <>
                <MdChevronLeft className="size-5" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
