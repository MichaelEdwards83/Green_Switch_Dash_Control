import React, { useState, useEffect } from 'react';
import { Server, Activity, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import NetworkChart from './NetworkChart';

const SwitchCard = ({ switchData, uplinkPort }) => {
  const ip = switchData.ip_trunk || switchData.ip_oob;
  const isCore = switchData.name && switchData.name.toLowerCase().includes('core');
  
  // Update status color based on switchDetails connectivity if available
  const isActuallyOnline = switchData.switchDetails?.connectivity?.active !== 'none' && switchData.online;
  const statusLabel = isActuallyOnline ? 'Online' : 'Offline';
  const statusColor = isActuallyOnline ? '#10b981' : '#ef4444';

  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    let interval;
    if (isActuallyOnline) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      setSessionTime(0);
    }
    return () => clearInterval(interval);
  }, [isActuallyOnline]);

  const formatSession = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <Link 
      to={`/switch/${ip}`} 
      style={{
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '1rem',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        minHeight: '320px', // Allow dynamic scaling, stop cramped overlapping
        height: '100%'
      }}
      className="hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
    >
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid var(--border-color)', 
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ 
            padding: '0.5rem', 
            background: isCore ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
            borderRadius: '0.5rem', 
            color: isCore ? '#a855f7' : '#3b82f6' 
          }}>
            <Server size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={switchData.name}>
              {switchData.name}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontFamily: 'monospace' }}>
              {ip} {uplinkPort ? `• Trunk: ${uplinkPort}` : ''}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}></div>
        </div>
      </div>
      
      <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
          <Activity size={14} /> Status: <span style={{ color: statusColor, fontWeight: '500' }}>{statusLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
          <Clock size={14} /> Session: <span style={{ color: 'var(--text-primary)' }}>{isActuallyOnline ? formatSession(sessionTime) : 'Offline'}</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '1rem 1rem 0.5rem 1rem', position: 'relative' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', top: '0.5rem', left: '1rem', zIndex: 10 }}>
          Trunk Bandwidth
        </div>
        {/* Render a tiny chart for the trunk port */}
        <NetworkChart ip={ip} port={uplinkPort} hideControls={true} />
      </div>
    </Link>
  );
};

export default SwitchCard;
