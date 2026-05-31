import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Activity, Server, Share2, Clock, Settings, Menu, X, Cpu } from 'lucide-react';
import SwitchControl from './SwitchControl';
import EndDevices from './EndDevices';
import EventHistory from './EventHistory';
import NetworkSettings from './NetworkSettings';
import NOCDashboard from './NOCDashboard';
import SwitchOverview from './SwitchOverview';
import './index.css';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <Router>
      <div className="app-container">
        {/* Mobile Header */}
        <div className="mobile-header">
          <div className="header-branding">
            <Activity className="header-icon" />
            <h2>Green Network</h2>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Sidebar */}
        <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="sidebar-header hidden-mobile">
            <Activity className="header-icon" />
            <h2>Green Network</h2>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              <Server size={20} /> Switch Control
            </NavLink>
            <NavLink to="/devices" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              <Cpu size={20} /> End Devices
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              <Clock size={20} /> Event History
            </NavLink>
            <NavLink to="/noc" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              <Activity size={20} /> NOC Dashboard
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              <Settings size={20} /> Settings
            </NavLink>
          </nav>
        </aside>

        {/* Overlay for mobile */}
        {mobileMenuOpen && <div className="sidebar-overlay" onClick={closeMenu}></div>}

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SwitchControl />} />
            <Route path="/devices" element={<EndDevices />} />
            <Route path="/history" element={<EventHistory />} />
            <Route path="/noc" element={<NOCDashboard />} />
            <Route path="/settings" element={<NetworkSettings />} />
            <Route path="/switch/:ip" element={<SwitchOverview />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
