import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Shield, Radio, ChevronLeft, ChevronRight,
  Brain, Cpu, FlaskConical, CalendarDays,
  MessageSquarePlus, Menu, X,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Brain, label: 'ML Predict', description: 'CREST AI engine' },
  { path: '/simulator', icon: FlaskConical, label: 'What-If', description: 'Scenario simulator' },
  { path: '/events', icon: CalendarDays, label: 'Event Calendar', description: 'Conflict detection' },
  { path: '/feedback', icon: MessageSquarePlus, label: 'Feedback Loop', description: 'Post-event learning' },
  { path: '/ml-analytics', icon: Cpu, label: 'ML Analytics', description: 'Model insights' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 1024 && window.innerWidth >= 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const mobile = w < 768;
      const tablet = w >= 768 && w <= 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      if (!mobile) setMobileOpen(false);
      // Auto-collapse sidebar on tablet
      if (tablet) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showLabels = isMobile || !collapsed;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black">

      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <div className={`flex flex-col items-center h-full border-r border-glass-border bg-slate-900/80 backdrop-blur-xl transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[220px]'}`}>
          <Sidebar
            showLabels={showLabels}
            collapsed={collapsed}
            isMobile={false}
            onClose={() => {}}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </div>
      )}

      {/* ── Mobile Backdrop ── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ── */}
      {isMobile && (
        <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[85vw] max-w-[320px] bg-slate-900 transition-transform duration-300 shadow-2xl shadow-black/50 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar
            showLabels={true}
            collapsed={false}
            isMobile={true}
            onClose={() => setMobileOpen(false)}
            onToggleCollapse={() => {}}
          />
        </aside>
      )}

      {/* ── Main Content ── */}
      <main className="flex flex-col flex-1 h-full overflow-hidden min-w-0">

        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex items-center gap-3 px-4 h-14 border-b border-glass-border bg-slate-900/80 shrink-0">
            <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-text-muted hover:bg-slate-800">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md gradient-accent flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gradient tracking-wider">CREST</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar({ showLabels, collapsed, isMobile, onClose, onToggleCollapse }) {
  return (
    <>
      {/* Logo row */}
      <div className="flex items-center justify-center gap-3 px-4 h-16 w-full border-b border-glass-border shrink-0">
        <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6 text-white" />
        </div>
        {showLabels && (
          <div>
            <h1 className="text-base font-bold text-gradient tracking-wider">CREST</h1>
            <p className="text-xs text-text-muted mt-0.5">Traffic Intelligence</p>
          </div>
        )}
        {isMobile && (
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-text-muted hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <div className='h-screen flex flex-col w-full'>
        <nav className="flex flex-col gap-4 px-6 py-5 h-full  overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => isMobile && onClose()}
              className={({ isActive }) =>
                `flex w-full items-center gap-4 px-6 py-3.5 rounded-lg transition-colors duration-150 ${
                  collapsed && !isMobile ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 '
                    : 'text-text-secondary hover:text-text-primary hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {showLabels && (
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-text-muted mt-0.5 truncate">{item.description}</div>
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Status */}
      <div className="px-4 py-4 border-t border-glass-border">
        <div className={`flex items-center gap-2 ${!showLabels ? 'justify-center' : ''}`}>
          <Radio className="w-3.5 h-3.5 text-risk-low animate-pulse shrink-0" />
          {showLabels && (
            <span className="text-[11px] text-text-muted font-medium">System Operational</span>
          )}
        </div>
      </div>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center h-12 border-t border-glass-border text-text-muted hover:text-text-primary hover:bg-slate-800/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      )}
    </>
  );
}