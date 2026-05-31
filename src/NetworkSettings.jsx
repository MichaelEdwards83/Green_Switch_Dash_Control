import React, { useEffect, useState } from 'react';
import { Settings, Save, Server, Shield, Plus, Trash2, Activity } from 'lucide-react';

const NetworkSettings = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [config, setConfig] = useState(null);
  const [devices, setDevices] = useState([]);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password === 'FuseFuse123!') {
      setIsAuthenticated(true);
      fetchData();
    } else {
      setAuthError('Invalid password');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, devicesRes, credRes] = await Promise.all([
        fetch('/api/mapper/config'),
        fetch('/api/admin/devices'),
        fetch('/api/admin/credentials')
      ]);
      const configData = await configRes.json();
      const devicesData = await devicesRes.json();
      const credData = await credRes.json();
      
      setConfig(configData);
      setDevices(devicesData);
      setCredentials(credData);
    } catch (err) {
      console.error("Failed to load settings data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveMessage('');
    try {
      const configRes = await fetch('/api/mapper/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, config })
      });
      
      const devicesRes = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, newDevices: devices })
      });
      
      const credRes = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, credentials })
      });
      
      let errMsg = [];
      if (!configRes.ok) errMsg.push(`Mapper: ${configRes.status} ${await configRes.text()}`);
      if (!devicesRes.ok) errMsg.push(`Devices: ${devicesRes.status} ${await devicesRes.text()}`);
      if (!credRes.ok) errMsg.push(`Creds: ${credRes.status} ${await credRes.text()}`);
      
      if (configRes.ok && devicesRes.ok && credRes.ok) {
        setSaveMessage('Configuration saved successfully.');
      } else {
        setSaveMessage(`Error saving: ${errMsg.join(' | ')}`);
      }
    } catch (err) {
      console.error(err);
      setSaveMessage(`Failed to save configuration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPoll = async () => {
    setLoading(true);
    setSaveMessage('Triggering network discovery and polling...');
    try {
      await fetch('/api/mapper/config/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, config })
      });
      await fetch('/api/mapper/poll/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      setSaveMessage('Discovery & polling initiated! Give it a minute to gather data.');
    } catch (err) {
      console.error(err);
      setSaveMessage('Error triggering poll.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceChange = (index, field, value) => {
    const newDevices = [...devices];
    newDevices[index][field] = value;
    setDevices(newDevices);
  };

  const addDevice = () => {
    setDevices([...devices, { name: 'New Switch', type: 'switch', ip_oob: '', ip_trunk: '' }]);
  };

  const removeDevice = (index) => {
    const newDevices = [...devices];
    newDevices.splice(index, 1);
    setDevices(newDevices);
  };

  if (!isAuthenticated) {
    return (
      <div className="settings-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            <Shield size={24} /> Admin Access Required
          </h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Master Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>
            {authError && <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{authError}</p>}
            <button type="submit" className="action-btn" style={{ width: '100%', justifyContent: 'center', background: '#3b82f6', color: 'white' }}>
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !config) {
    return <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>Loading configuration...</div>;
  }

  return (
    <div className="settings-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <header className="dashboard-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="header-title" style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={32} /> Master Control Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Unified configuration for Mapper and Switch Controller</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {saveMessage && <span style={{ color: saveMessage.includes('Error') || saveMessage.includes('Failed') ? '#ef4444' : '#10b981' }}>{saveMessage}</span>}
          <button onClick={handleTriggerPoll} className="action-btn" disabled={loading} style={{ background: '#3b82f6', color: 'white' }}>
            <Activity size={18} /> Trigger Poll
          </button>
          <button onClick={handleSave} className="action-btn" disabled={loading} style={{ background: '#10b981', color: 'white' }}>
            <Save size={18} /> {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        
        {/* SNMP config */}
        <section style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>SNMP Configuration</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Community String</label>
              <input 
                type="text" 
                value={config?.snmp?.community || ''} 
                onChange={(e) => setConfig({...config, snmp: {...config.snmp, community: e.target.value}})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Version</label>
              <select 
                value={config?.snmp?.version || '2c'} 
                onChange={(e) => setConfig({...config, snmp: {...config.snmp, version: e.target.value}})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                <option value="1">v1</option>
                <option value="2c">v2c</option>
              </select>
            </div>
          </div>
        </section>

        {/* Switch Credentials */}
        <section style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Switch Credentials</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>These credentials are used by the switch controller to communicate with Netgear APIs.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
              <input 
                type="text" 
                value={credentials.username} 
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
              <input 
                type="password" 
                value={credentials.password} 
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                placeholder="Leave blank to keep unchanged"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </section>

        {/* Discovery settings */}
        <section style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Discovery Subnets</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Core Switch IPs (Comma separated)</label>
            <input 
              type="text" 
              value={(config?.switches?.core || []).map(s => typeof s === 'string' ? s : s.ip).join(', ')} 
              onChange={(e) => setConfig({...config, switches: {...config.switches, core: e.target.value.split(',').map(s => ({ ip: s.trim() })).filter(s => s.ip)}})}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Ignore LLDP Subnets (Comma separated)</label>
            <input 
              type="text" 
              value={(config?.ignore_lldp_subnets || []).join(', ')} 
              onChange={(e) => setConfig({...config, ignore_lldp_subnets: e.target.value.split(',').map(s => s.trim()).filter(s => s)}) }
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
        </section>

        {/* Managed Wireless APs */}
        <section style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)' }}>Managed Wireless APs</h2>
            <button 
              onClick={() => {
                const currentAps = config?.wireless_aps || [];
                setConfig({...config, wireless_aps: [...currentAps, { ip: '', name: '' }]});
              }} 
              className="action-btn" 
              style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-primary)' }}
            >
              <Plus size={16} /> Add AP
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(config?.wireless_aps || []).map((ap, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>IP Address</label>
                  <input type="text" value={ap.ip || ''} onChange={(e) => {
                    const newAps = [...(config?.wireless_aps || [])];
                    newAps[idx] = { ...newAps[idx], ip: e.target.value };
                    setConfig({...config, wireless_aps: newAps});
                  }} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name / Location</label>
                  <input type="text" value={ap.name || ''} onChange={(e) => {
                    const newAps = [...(config?.wireless_aps || [])];
                    newAps[idx] = { ...newAps[idx], name: e.target.value };
                    setConfig({...config, wireless_aps: newAps});
                  }} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={() => {
                  const newAps = [...(config?.wireless_aps || [])];
                  newAps.splice(idx, 1);
                  setConfig({...config, wireless_aps: newAps});
                }} style={{ padding: '0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {(!config?.wireless_aps || config.wireless_aps.length === 0) && <p style={{ color: 'var(--text-secondary)' }}>No wireless APs configured.</p>}
          </div>
        </section>

        {/* Devices list */}
        <section style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={20} /> Managed Switches
            </h2>
            <button onClick={addDevice} className="action-btn" style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-primary)' }}>
              <Plus size={16} /> Add Device
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {devices.map((device, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr auto', gap: '1rem', alignItems: 'end', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name</label>
                  <input type="text" value={device.name || ''} onChange={(e) => handleDeviceChange(idx, 'name', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Type</label>
                  <select value={device.type || 'switch'} onChange={(e) => handleDeviceChange(idx, 'type', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                    <option value="switch">Switch</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>OOB IP</label>
                  <input type="text" value={device.ip_oob || ''} onChange={(e) => handleDeviceChange(idx, 'ip_oob', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Trunk IP</label>
                  <input type="text" value={device.ip_trunk || ''} onChange={(e) => handleDeviceChange(idx, 'ip_trunk', e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={() => removeDevice(idx)} style={{ padding: '0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {devices.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No devices configured.</p>}
          </div>
        </section>

      </div>
    </div>
  );
};

export default NetworkSettings;
