import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Server, Activity } from 'lucide-react';
import NetworkChart from './components/NetworkChart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PortChart = ({ portName, data }) => (
  <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', height: '220px', display: 'flex', flexDirection: 'column' }}>
    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Interface: {portName}</h3>
    <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis dataKey="timeLabel" hide={true} />
          <YAxis tickFormatter={(val) => val.toFixed(1)} stroke="var(--text-secondary)" fontSize={10} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--primary-color)', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Area type="monotone" dataKey="inbound" name="In (Mbps)" stroke="var(--primary-color)" fill="var(--primary-color)" fillOpacity={0.15} strokeWidth={2} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="outbound" name="Out (Mbps)" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const SwitchOverview = () => {
  const { ip } = useParams();
  const [portData, setPortData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPorts = async () => {
      try {
        const res = await fetch(`/api/metrics/${ip}?range=2h&perPort=true`);
        if (!res.ok) throw new Error('Failed to fetch port metrics');
        const json = await res.json();
        
        const portMap = new Map();

        const processSeries = (seriesArray, key) => {
          (seriesArray || []).forEach(series => {
            const ifName = series.metric.ifName;
            if (!ifName) return;
            if (!portMap.has(ifName)) portMap.set(ifName, new Map());
            
            series.values.forEach(([timestamp, value]) => {
              const t = timestamp;
              const mapForPort = portMap.get(ifName);
              const obj = mapForPort.get(t) || { 
                timestamp: t, 
                timeLabel: new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                inbound: 0, 
                outbound: 0 
              };
              obj[key] = parseFloat(value) / 1000000;
              mapForPort.set(t, obj);
            });
          });
        };

        processSeries(json.inbound, 'inbound');
        processSeries(json.outbound, 'outbound');

        const finalPorts = Array.from(portMap.entries()).map(([ifName, dataMap]) => {
          const sortedData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
          return { name: ifName, data: sortedData };
        }).filter(p => p.data.some(d => d.inbound > 0.05 || d.outbound > 0.05)); // Only show active ports

        // Sort ports numerically if possible
        finalPorts.sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
          return numA - numB;
        });

        setPortData(finalPorts);
      } catch (e) {
        console.error("Failed to load per-port metrics:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPorts();
    const interval = setInterval(fetchPorts, 60000);
    return () => clearInterval(interval);
  }, [ip]);

  return (
    <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <header className="dashboard-header" style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
        <Link to="/noc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem', fontWeight: '500' }} className="hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Back to NOC Dashboard
        </Link>
        <h1 className="header-title" style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <Server size={32} color="var(--primary-color)" />
          Switch Overview: {ip}
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Live Telemetry & Traffic Analysis</p>
      </header>

      <div style={{ background: 'var(--card-bg)', borderRadius: '1rem', border: '1px solid var(--border-color)', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="var(--primary-color)" />
          Aggregate Switch Traffic
        </h2>
        <div style={{ width: '100%', height: '300px' }}>
          <NetworkChart ip={ip} />
        </div>
      </div>

      <div style={{ background: 'var(--bg-color)', borderRadius: '1rem', padding: '0' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Active Ports Bandwidth</h2>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading port metrics...</div>
        ) : portData.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--card-bg)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
            No active port traffic detected in the last 2 hours.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {portData.map(port => (
              <PortChart key={port.name} portName={port.name} data={port.data} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SwitchOverview;
