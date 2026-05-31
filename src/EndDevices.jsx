import React, { useState, useEffect } from 'react';

const EndDevices = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vlanFilter, setVlanFilter] = useState('');
  const [switchFilter, setSwitchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'ip_address', direction: 'ascending' });

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/mapper/devices');
        if (res.ok) {
          const data = await res.json();
          setDevices(data);
        }
      } catch (e) {
        console.error('Error fetching devices:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedDevices = [...devices].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });

  const filteredDevices = sortedDevices.filter(d => {
    const matchSearch = search === '' || 
      (d.mac_address && d.mac_address.toLowerCase().includes(search.toLowerCase())) ||
      (d.ip_address && d.ip_address.toLowerCase().includes(search.toLowerCase())) ||
      (d.hostname && d.hostname.toLowerCase().includes(search.toLowerCase()));
    
    const matchVlan = vlanFilter === '' || d.vlan_id?.toString() === vlanFilter;
    const matchSwitch = switchFilter === '' || d.switch_ip === switchFilter;
    
    return matchSearch && matchVlan && matchSwitch;
  });

  const uniqueVlans = [...new Set(devices.map(d => d.vlan_id).filter(Boolean))].sort((a, b) => a - b);
  const uniqueSwitches = [...new Set(devices.map(d => d.switch_ip).filter(Boolean))].sort();

  return (
    <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>End Devices</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Search MAC, IP, Hostname..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ 
            flex: '1', minWidth: '200px', padding: '0.5rem', 
            background: 'var(--bg-primary)', color: 'var(--text-primary)', 
            border: '1px solid var(--border-color)', borderRadius: '4px' 
          }}
        />
        <select 
          value={vlanFilter} 
          onChange={(e) => setVlanFilter(e.target.value)}
          style={{ 
            padding: '0.5rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', 
            border: '1px solid var(--border-color)', borderRadius: '4px' 
          }}
        >
          <option value="">All VLANs</option>
          {uniqueVlans.map(v => <option key={v} value={v}>VLAN {v}</option>)}
        </select>
        <select 
          value={switchFilter} 
          onChange={(e) => setSwitchFilter(e.target.value)}
          style={{ 
            padding: '0.5rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', 
            border: '1px solid var(--border-color)', borderRadius: '4px' 
          }}
        >
          <option value="">All Switches</option>
          {uniqueSwitches.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('ip_address')}>IP Address ↕</th>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('mac_address')}>MAC Address ↕</th>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('hostname')}>Hostname ↕</th>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('vlan_id')}>VLAN ↕</th>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('switch_ip')}>Switch IP ↕</th>
              <th style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => handleSort('switch_port')}>Port ↕</th>
              <th style={{ padding: '1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && devices.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '1rem', textAlign: 'center' }}>Loading devices...</td></tr>
            ) : filteredDevices.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '1rem', textAlign: 'center' }}>No devices found.</td></tr>
            ) : (
              filteredDevices.map(d => (
                <tr key={d.mac_address} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>{d.ip_address || 'N/A'}</td>
                  <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{d.mac_address}</td>
                  <td style={{ padding: '1rem' }}>{d.hostname || 'Unknown'}</td>
                  <td style={{ padding: '1rem' }}>{d.vlan_id || '-'}</td>
                  <td style={{ padding: '1rem' }}>{d.switch_ip || '-'}</td>
                  <td style={{ padding: '1rem' }}>{d.switch_port || '-'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '1rem',
                      fontSize: '0.8rem',
                      background: d.status === 'Online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: d.status === 'Online' ? '#10b981' : '#ef4444'
                    }}>
                      {d.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EndDevices;
