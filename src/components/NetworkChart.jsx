import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const NetworkChart = ({ ip, port, hideControls = false }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('2h'); // Default to 2h

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Use relative path to hit the proxy/backend
        const url = `/api/metrics/${ip}?range=${range}${port ? "&port=" + encodeURIComponent(port) : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch metrics');
        const json = await res.json();
        
        const inboundData = json.inbound?.[0]?.values || [];
        const outboundData = json.outbound?.[0]?.values || [];
        
        // Merge data by timestamp
        const dataMap = new Map();
        
        inboundData.forEach(([timestamp, value]) => {
          dataMap.set(timestamp, {
            timestamp,
            timeLabel: new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            inbound: parseFloat(value) / 1000000 // Convert to Mbps
          });
        });
        
        outboundData.forEach(([timestamp, value]) => {
          if (dataMap.has(timestamp)) {
            dataMap.get(timestamp).outbound = parseFloat(value) / 1000000;
          } else {
            dataMap.set(timestamp, {
              timestamp,
              timeLabel: new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              inbound: 0,
              outbound: parseFloat(value) / 1000000
            });
          }
        });
        
        const mergedData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        setData(mergedData);
        setError(null);
      } catch (err) {
        console.error("NetworkChart Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [ip, port, range]);

  if (loading && data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        Loading telemetry data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--danger-color, #ef4444)' }}>
        Error loading data: {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        No traffic data available.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!hideControls && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <select 
            value={range} 
            onChange={(e) => setRange(e.target.value)}
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <option value="2h">Last 2 Hours</option>
            <option value="24h">Last 24 Hours</option>
          </select>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`colorIn-${ip.replace(/\./g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={`colorOut-${ip.replace(/\./g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis 
            dataKey="timeLabel" 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)' }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis 
            stroke="var(--text-secondary)" 
            tick={{ fill: 'var(--text-secondary)' }}
            tickFormatter={(val) => `${val.toFixed(1)}`}
            label={{ value: 'Mbps', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-color)', 
              borderColor: 'var(--primary-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="inbound" 
            name="Inbound Traffic (Mbps)"
            stroke="var(--primary-color)" 
            fillOpacity={1} 
            fill={`url(#colorIn-${ip.replace(/\./g, '-')})`}
            strokeWidth={2}
            activeDot={{ r: 6, fill: 'var(--primary-color)', stroke: '#000' }}
          />
          <Area 
            type="monotone" 
            dataKey="outbound" 
            name="Outbound Traffic (Mbps)"
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill={`url(#colorOut-${ip.replace(/\./g, '-')})`}
            strokeWidth={2}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#000' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetworkChart;
