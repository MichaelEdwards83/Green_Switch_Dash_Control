import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Server, AlertCircle, CheckCircle2, X, Zap, Sun, Moon, BarChart2 } from 'lucide-react';
import { SwitchFaceplate as Faceplate } from './Faceplate';

function SwitchControl() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSwitch, setSelectedSwitch] = useState(null); // Which switch faceplate to show
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPort, setSelectedPort] = useState(null);
  const [vlanId, setVlanId] = useState('');
  const [processingPorts, setProcessingPorts] = useState(new Set());
  const [trafficData, setTrafficData] = useState([]);
  const [mapperDevices, setMapperDevices] = useState([]);
  const [isLightMode, setIsLightMode] = useState(false);
  const processingPortsRef = React.useRef(new Set());

  // Apply Light Theme body class
  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-theme');
      document.documentElement.style.colorScheme = 'light';
    } else {
      document.body.classList.remove('light-theme');
      document.documentElement.style.colorScheme = 'dark';
    }
  }, [isLightMode]);

  // Derive the LIVE switch data from the active polling array
  const currentSwitch = selectedSwitch ? devices.find(d => d.ip_oob === selectedSwitch.ip_oob) || selectedSwitch : null;

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setDevices(data);
      setLastUpdated(new Date());
      setLoading(false);
      
      // Also fetch traffic and mapper devices
      try {
        const trafficRes = await fetch('/api/mapper/traffic/global');
        if (trafficRes.ok) setTrafficData(await trafficRes.json());
      } catch (e) {}
      
      try {
        const devRes = await fetch('/api/mapper/devices');
        if (devRes.ok) setMapperDevices(await devRes.json());
      } catch (e) {}
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const openSwitchModal = (device) => {
    if (device.type === 'switch') {
      setSelectedSwitch(device);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedSwitch(null), 200); // Give time for animation/close
  };

  const handlePortClick = (portId) => {
    console.log("Port clicked:", portId);
    setSelectedPort(portId);
    setVlanId(currentSwitch?.switchDetails?.ports?.[portId]?.vlan || '');
  };

  const applyVlan = async () => {
    if (!selectedPort || !vlanId || !currentSwitch) return;

    const portId = selectedPort;
    const targetIp = currentSwitch.ip_oob;
    const targetVlan = vlanId;
    const portKey = `${targetIp}-${portId}`;

    setSelectedPort(null);
    processingPortsRef.current.add(portKey);
    setProcessingPorts(new Set(processingPortsRef.current));

    try {
      const res = await fetch('/api/vlan/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, port: portId, vlanId: targetVlan })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchStatus(); // Trigger aggressive refresh to see changes immediately
    } catch (err) {
      alert(`VLAN Error: ${err.message}`);
    } finally {
      processingPortsRef.current.delete(portKey);
      setProcessingPorts(new Set(processingPortsRef.current));
    }
  };

  const cyclePoe = async () => {
    if (!selectedPort || !currentSwitch) return;

    const portId = selectedPort;
    const targetIp = currentSwitch.ip_oob;
    const portKey = `${targetIp}-${portId}`;

    setSelectedPort(null);
    processingPortsRef.current.add(portKey);
    setProcessingPorts(new Set(processingPortsRef.current));

    try {
      const res = await fetch('/api/poe/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, port: portId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (err) {
      alert(`PoE Error: ${err.message}`);
    } finally {
      processingPortsRef.current.delete(portKey);
      setProcessingPorts(new Set(processingPortsRef.current));
    }
  };

  return (
    <div className="dashboard-container">
      <div className="max-width-wrapper">
        <header className="dashboard-header">
          <div className="header-branding">
            <div className="icon-wrapper">
              <Activity className="header-icon" />
            </div>
            <div>
              <h1 className="header-title">
                Switch Control Dashboard
              </h1>
              <p className="header-subtitle">
                Green Network Infrastructure Overview
              </p>
            </div>
          </div>
          {lastUpdated && (
            <div className="header-status" style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', background: 'transparent', border: 'none', padding: 0 }}>
              <div style={{ textAlign: 'right', background: 'var(--card-bg, rgba(30, 41, 59, 0.5))', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))' }}>
                <div className="status-label">Last Updated</div>
                <div className="status-time">
                  {lastUpdated.toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => setIsLightMode(!isLightMode)}
                style={{
                  background: 'var(--card-bg, rgba(30, 41, 59, 0.5))',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                  color: 'var(--text-primary, #f8fafc)',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Toggle Theme"
              >
                {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
          )}
        </header>

        <div className="devices-grid">
          {devices.map((device) => {
            const displayName = device.name.replace('SW-GRN-', '');

            const oobUrl = device.ip_oob ? `http://${device.ip_oob}:${device.port}/` : device.url;
            const trunkUrl = device.ip_trunk ? `http://${device.ip_trunk}:${device.port}/` : null;

            // Calculate Status
            let status = 'OFFLINE';
            if (device.ip_trunk) {
              if (device.online_oob && device.online_trunk) status = 'ONLINE';
              else if (device.online_oob || device.online_trunk) status = 'PARTIAL';
            } else {
              if (device.online) status = 'ONLINE';
            }

            const statusClass = status.toLowerCase();
            const isClickable = device.type === 'switch';

            return (
              <div
                key={device.name}
                className={`device-card ${statusClass} ${isClickable ? 'clickable-card' : ''}`}
                onClick={() => isClickable && openSwitchModal(device)}
              >
                <div className="card-content">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="device-name" title={device.name} style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {device.type === 'switch' && <Server size={18} />} {displayName}
                    </h3>
                    <span className={`status-badge ${statusClass}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}>
                      {status}
                    </span>
                  </div>
                  <div className="device-info">
                    <div className="connections-wrapper">
                      {/* OOB Connection */}
                      <div className="connection-row">
                        <div
                          className="connection-status-dot"
                          style={{
                            backgroundColor: device.online_oob ? '#10b981' : '#ef4444',
                            boxShadow: device.online_oob ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                          }}
                        />
                        <div className="connection-info">
                          <span className="connection-label">Management (OOB)</span>
                          <a href={oobUrl} target="_blank" rel="noopener noreferrer" className="connection-link" onClick={e => e.stopPropagation()}>
                            {device.ip_oob || 'N/A'}
                          </a>
                        </div>
                      </div>

                      {/* Trunk Connection */}
                      {device.ip_trunk && (
                        <div className="connection-row">
                          <div
                            className="connection-status-dot"
                            style={{
                              backgroundColor: device.online_trunk ? '#10b981' : '#ef4444',
                              boxShadow: device.online_trunk ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                            }}
                          />
                          <div className="connection-info">
                            <span className="connection-label">Trunk (In-Band)</span>
                            <a href={trunkUrl} target="_blank" rel="noopener noreferrer" className="connection-link" onClick={e => e.stopPropagation()}>
                              {device.ip_trunk}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for Switch Faceplate */}
      {isModalOpen && currentSwitch && currentSwitch.switchDetails && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2>{currentSwitch.name} Management</h2>
                <Link to={`/switch/${currentSwitch.ip_oob}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '0.25rem', textDecoration: 'none', fontSize: '0.9rem' }}>
                  <BarChart2 size={16} /> Analytics
                </Link>
              </div>
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              {/* We re-use the Faceplate component, passing down the specific deep switch details */}
              <Faceplate
                portCount={currentSwitch.switchDetails?.derivedPortCount || 48}
                portData={currentSwitch.switchDetails?.ports || {}}
                systemName={currentSwitch.name}
                systemModel={currentSwitch.switchDetails?.systemModel}
                vlanMap={currentSwitch.switchDetails?.vlanMap || {}}
                connectivity={currentSwitch.switchDetails?.connectivity}
                ipOob={currentSwitch.ip_oob}
                ipTrunk={currentSwitch.ip_trunk}
                processingPorts={processingPorts}
                onPortClick={handlePortClick}
              />
              
              {selectedPort && (
                <div className="port-control-panel">
                  <h3>Port {selectedPort} Control</h3>
                  <div className="control-group">
                    <label>VLAN ID</label>
                    <select 
                      value={vlanId} 
                      onChange={e => setVlanId(e.target.value)} 
                    >
                      <option value="" disabled>Select a VLAN</option>
                      {Object.entries(currentSwitch?.switchDetails?.vlanMap || {}).map(([vid, vname]) => (
                        <option key={vid} value={vid}>
                          {vid} - {vname}
                        </option>
                      ))}
                    </select>
                    <button onClick={applyVlan} className="primary-btn">Apply VLAN</button>
                  </div>
                  <div className="control-group">
                    <label>Power over Ethernet (PoE)</label>
                    <button onClick={cyclePoe} className="danger-btn"><Zap size={16}/> Cycle PoE Power</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Show loading state if faceplate hasn't loaded data yet */}
      {isModalOpen && currentSwitch && !currentSwitch.switchDetails && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2>{currentSwitch.name} Management</h2>
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#94a3b8' }}>Waiting for switch agent polling data...</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SwitchControl;
