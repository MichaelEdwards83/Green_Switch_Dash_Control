import React, { useState } from 'react';
import { Server, Activity, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import NetworkChart from './NetworkChart';

const SwitchCard = ({ switchData, uplinkPort }) => {
  const ip = switchData.ip_trunk || switchData.ip_oob;
  const isCore = switchData.name && switchData.name.toLowerCase().includes('core');
  
  // Status relies on the accurate "online" boolean from the unified API
  const isActuallyOnline = switchData.online;
  const statusLabel = isActuallyOnline ? 'Online' : 'Offline';
  const statusColor = isActuallyOnline ? '#10b981' : '#ef4444';

  const [latestTraffic, setLatestTraffic] = useState({ in: 0, out: 0 });

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
        height: '380px', // Fixed height prevents infinite flexing
        maxHeight: '380px'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--primary-color)' }}>
            <ArrowDownToLine size={12} /> {latestTraffic.in.toFixed(1)} Mbps
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#3b82f6' }}>
            <ArrowUpFromLine size={12} /> {latestTraffic.out.toFixed(1)} Mbps
          </span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '1rem 1rem 0.5rem 1rem', position: 'relative' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', position: 'absolute', top: '0.5rem', left: '1rem', zIndex: 10 }}>
          Trunk Bandwidth
        </div>
        {/* Render a tiny chart for the trunk port */}
        <NetworkChart 
          ip={ip} 
          port={uplinkPort} 
          hideControls={true} 
          onLatestData={(inbound, outbound) => setLatestTraffic({ in: inbound, out: outbound })}
        />
      </div>
    </Link>
  );
};

export default SwitchCard;
