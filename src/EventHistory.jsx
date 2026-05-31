import React, { useEffect, useState } from 'react';

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  
  // Ensure the string is treated as UTC by appending 'Z' if it doesn't have timezone info
  let parseableString = timestamp;
  if (typeof timestamp === 'string' && timestamp.includes('T') && !timestamp.endsWith('Z')) {
    parseableString = timestamp + 'Z';
  }
  
  const date = new Date(parseableString);
  
  // Fallback to original string if invalid date
  if (isNaN(date.getTime())) {
    return timestamp;
  }
  
  return date.toLocaleString();
}

const EventHistory = () => {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/mapper/history');
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        console.error("Failed to load history", err);
      }
    };
    fetchHistory();
  }, []);

  const filteredHistory = history.filter(h => {
    if (!search) return true;
    const rowText = Object.values(h).join(' ').toLowerCase();
    return rowText.includes(search.toLowerCase());
  });

  return (
    <div className="history-container">
      <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="header-title">Event History</h1>
        <input 
          type="text" 
          placeholder="Search events..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #ccc', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
        />
      </header>

      <div className="table-wrapper" style={{ overflowX: 'auto', background: 'var(--card-bg)', borderRadius: '0.5rem', padding: '1rem' }}>
        <table className="devices-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>Time</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>Device</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>Event</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>Old Value</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>New Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((h, i) => {
              let displayType = h.event_type;
              if (h.event_type === 'OFFLINE') displayType = "Offline";
              else if (h.event_type === 'ONLINE') displayType = "Online";
              else if (h.event_type === 'PORT_MOVED') displayType = "Port Moved";
              else if (h.event_type === 'NEW_DEVICE') displayType = "Discovered";

              return (
                <tr key={i}>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{formatTime(h.timestamp)}</td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <strong>{h.ip_address || '-'}</strong><br />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{h.mac_address}</span>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{displayType}</span>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)', color: '#f87171' }}>{h.old_value || '-'}</td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)', color: '#4ade80' }}>{h.new_value || '-'}</td>
                </tr>
              );
            })}
            {filteredHistory.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>No events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EventHistory;
