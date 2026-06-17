import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Shield,
  Radio,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Live Operations', description: 'Real-time monitoring' },
  { path: '/planner', icon: Calendar, label: 'Event Planner', description: 'Calendar & forecast' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics', description: 'Trends & insights' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-navy-950">
      {/* Sidebar */}
      <aside
        className={`flex flex-col h-full transition-all duration-300 ease-in-out border-r border-glass-border bg-navy-900/80 backdrop-blur-xl ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-glass-border shrink-0">
          <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-base font-bold text-gradient tracking-wide">ASTRAM</h1>
              <p className="text-[10px] text-text-muted leading-none">Traffic Intelligence</p>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-accent-500/15 text-accent-400 border border-accent-500/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-navy-800/60'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <div className="animate-fade-in">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[10px] text-text-muted">{item.description}</div>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status indicator */}
        <div className="px-3 py-3 border-t border-glass-border">
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <Radio className="w-3.5 h-3.5 text-risk-low animate-pulse" />
            {!collapsed && (
              <span className="text-[11px] text-text-muted">System Operational</span>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-glass-border text-text-muted hover:text-text-primary transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
