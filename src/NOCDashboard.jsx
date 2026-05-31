import React, { useEffect, useState, useRef } from 'react';
import { Activity as ActivityIcon, ArrowUpRight, ArrowDownRight, Server, Box, Cpu, AlertTriangle, Zap, Network as NetworkIcon, Share2, X, Expand } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Network } from 'vis-network';
import SwitchCard from './components/SwitchCard';

function ipInSubnet(ip, subnet) {
  if (!ip || !subnet) return false;
  const cleanSub = subnet.trim();
  if (cleanSub.includes('/')) {
    try {
      const parts = cleanSub.split('/');
      const subIp = parts[0];
      const mask = parseInt(parts[1], 10);
      const ipNum = ipToLong(ip);
      const subNum = ipToLong(subIp);
      const maskBits = (0xFFFFFFFF << (32 - mask)) >>> 0;
      return (ipNum & maskBits) === (subNum & maskBits);
    } catch (e) {
      return false;
    }
  }
  return ip.startsWith(cleanSub) || ip.includes(cleanSub);
}

function ipToLong(ip) {
  const parts = ip.split('.');
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + (parts[3] << 0)) >>> 0;
}

const TopologyView = ({ networkConfig, navigate }) => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    if (!networkConfig || !containerRef.current) return;

    let active = true;
    const nodes = [];
    const edges = [];
    
    let idCounter = 1;
    const ipToId = {};
    const ipToType = {};
    
    const ignoredSubnets = networkConfig.ignore_lldp_subnets || [];
    
    // Cores
    const cores = (networkConfig.switches?.core) || [];
    cores.forEach(c => {
      const ip = typeof c === 'string' ? c : c.ip;
      const name = typeof c === 'string' ? 'Core' : c.name;
      if (ignoredSubnets.some(sub => ipInSubnet(ip, sub))) return;
      ipToId[ip] = idCounter;
      ipToType[ip] = 'managed';
      nodes.push({ id: idCounter++, label: name, group: 'core', title: `IP: ${ip}`, level: 0, ip });
    });
    
    // Edges
    const edgesArr = (networkConfig.switches?.edge) || [];
    edgesArr.forEach(e => {
      const ip = typeof e === 'string' ? e : e.ip;
      const name = typeof e === 'string' ? 'Edge' : e.name;
      if (ignoredSubnets.some(sub => ipInSubnet(ip, sub))) return;
      ipToId[ip] = idCounter;
      ipToType[ip] = 'managed';
      nodes.push({ id: idCounter++, label: name, group: 'edge', title: `IP: ${ip}`, level: 1, ip });
    });

    // APs
    const apsArr = networkConfig.wireless_aps || [];
    apsArr.forEach(ap => {
      if (ignoredSubnets.some(sub => ipInSubnet(ap.ip, sub))) return;
      ipToId[ap.ip] = idCounter;
      ipToType[ap.ip] = 'ap';
      nodes.push({ id: idCounter++, label: ap.name, group: 'ap', title: `Wireless AP: ${ap.ip}`, level: 2, ip: ap.ip });
    });

    if (networkConfig.topology_links?.length > 0) {
      networkConfig.topology_links.forEach(link => {
        [link.source, link.target].forEach(ip => {
          if (ignoredSubnets.some(sub => ipInSubnet(ip, sub))) return;
          if (!ipToId[ip]) {
            ipToId[ip] = idCounter;
            nodes.push({ id: idCounter++, label: ip, group: 'unmanaged', title: `IP: ${ip} (Unmanaged)`, level: 2, ip });
          }
        });
      });

      networkConfig.topology_links.forEach(link => {
        if (ignoredSubnets.some(sub => ipInSubnet(link.source, sub)) || ignoredSubnets.some(sub => ipInSubnet(link.target, sub))) return;
        if (ipToId[link.source] && ipToId[link.target]) {
          edges.push({
            from: ipToId[link.source],
            to: ipToId[link.target],
            color: { color: 'rgba(255,255,255,0.2)' }
          });
        }
      });
    }

    // Fallback links if no topology_links exist
    if (edges.length === 0 && cores.length > 0) {
      const coreNode = cores[0];
      const coreIp = typeof coreNode === 'string' ? coreNode : coreNode.ip;
      const coreId = ipToId[coreIp];

      if (coreId) {
        edgesArr.forEach((e, index) => {
          const edgeIp = typeof e === 'string' ? e : e.ip;
          if (ipToId[edgeIp]) {
            edges.push({
              from: coreId,
              to: ipToId[edgeIp],
              color: { color: 'rgba(255,255,255,0.2)' }
            });
          }
        });

        if (edgesArr.length > 0) {
          apsArr.forEach((ap, index) => {
            if (ipToId[ap.ip]) {
              const targetEdge = edgesArr[index % edgesArr.length];
              const edgeIp = typeof targetEdge === 'string' ? targetEdge : targetEdge.ip;
              if (ipToId[edgeIp]) {
                edges.push({
                  from: ipToId[edgeIp],
                  to: ipToId[ap.ip],
                  color: { color: 'rgba(255,255,255,0.1)' },
                  dashes: true
                });
              }
            }
          });
        }
      }
    }

    const data = { nodes, edges };
    const options = {
      nodes: { shape: 'dot', size: 15, font: { color: '#e2e8f0', face: 'Inter', size: 12 } },
      groups: {
        core: { color: { background: 'var(--primary-color)', border: 'var(--primary-hover)' }, size: 25 },
        edge: { color: { background: '#3b82f6', border: '#2563eb' }, size: 18 },
        ap: { color: { background: '#a855f7', border: '#7e22ce' }, size: 12, shape: 'diamond' },
        unmanaged: { color: { background: '#94a3b8', border: '#64748b' }, size: 10 }
      },
      edges: { width: 1.5, smooth: { type: 'continuous' } },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -100,
          centralGravity: 0.01,
          springLength: 150,
          springConstant: 0.08
        },
        stabilization: { iterations: 150 }
      },
      interaction: { hover: true, zoomView: true, dragView: true }
    };

    if (networkRef.current) networkRef.current.destroy();
    networkRef.current = new Network(containerRef.current, data, options);
    
    networkRef.current.on('click', function (params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.find(n => n.id === nodeId);
        if (node && ipToType[node.ip] === 'managed') {
          navigate(`/switch/${node.ip}`);
        }
      }
    });

    networkRef.current.once("stabilizationIterationsDone", () => {
      networkRef.current.fit();
      networkRef.current.setOptions({ physics: { enabled: false } });
    });

    return () => { active = false; };
  }, [networkConfig, navigate]);

  return (
    <div style={{ height: '400px', width: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
    </div>
  );
};

const NOCDashboard = () => {
  const [globalTraffic, setGlobalTraffic] = useState([]);
  const [devices, setDevices] = useState([]);
  const [endDevices, setEndDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalNetworkDevices, setTotalNetworkDevices] = useState(0);
  const [networkConfig, setNetworkConfig] = useState(null);
  const [showTopology, setShowTopology] = useState(false);
  
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [trafficRes, devicesRes, configRes, endDevicesRes] = await Promise.all([
        fetch('/api/mapper/traffic/global'),
        fetch('/api/admin/devices'),
        fetch('/api/mapper/config'),
        fetch('/api/mapper/devices')
      ]);
      const trafficData = trafficRes.ok ? await trafficRes.json() : [];
      const devicesData = devicesRes.ok ? await devicesRes.json() : [];
      const configData = configRes.ok ? await configRes.json() : {};
      const endDevicesData = endDevicesRes.ok ? await endDevicesRes.json() : [];
      
      setGlobalTraffic(trafficData);
      setDevices(devicesData.filter(d => d.type === 'switch')); // only show switches
      setEndDevices(endDevicesData);
      setNetworkConfig(configData);
      
      const uniqueIps = new Set();
      (configData.switches?.core || []).forEach(s => uniqueIps.add(s.ip || s));
      (configData.switches?.edge || []).forEach(s => uniqueIps.add(s.ip || s));
      (configData.wireless_aps || []).forEach(s => uniqueIps.add(s.ip || s));
      (configData.topology_links || []).forEach(l => {
        uniqueIps.add(l.source);
        uniqueIps.add(l.target);
      });
      setTotalNetworkDevices(uniqueIps.size);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load NOC data", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-primary)', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="flex flex-col items-center gap-4">
          <ActivityIcon className="animate-spin text-primary" size={48} color="var(--primary-color)" />
          <p className="text-xl">Initializing NOC Subsystems...</p>
        </div>
      </div>
    );
  }

  const alerts = devices.filter(d => d.status === 'Offline');

  const StatCard = ({ title, value, subtitle, icon, highlightColor }) => (
    <div style={{ 
      background: 'rgba(15, 23, 42, 0.6)', 
      backdropFilter: 'blur(10px)',
      padding: '1.5rem', 
      borderRadius: '1rem', 
      border: `1px solid rgba(${highlightColor}, 0.3)`,
      borderTop: `4px solid rgb(${highlightColor})`,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h3>
        <div style={{ padding: '0.5rem', background: `rgba(${highlightColor}, 0.1)`, borderRadius: '0.5rem', color: `rgb(${highlightColor})` }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.75rem', fontWeight: '500' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="noc-dashboard" style={{ padding: '1.5rem', height: '100%', overflowY: 'auto', background: 'radial-gradient(circle at top, rgba(16, 185, 129, 0.05) 0%, transparent 50%)' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ActivityIcon color="var(--primary-color)" />
            Network Operations Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Real-time telemetry and infrastructure visualization</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {alerts.length > 0 ? (
             <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem 1rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: '600', fontSize: '0.9rem' }}>
               <AlertTriangle size={16} />
               {alerts.length} Alerts Active
             </div>
          ) : null}
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 1rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: '600', fontSize: '0.9rem' }}>
            <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></div>
            System Online
          </div>
        </div>
      </header>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <StatCard 
          title="Active Infrastructure" 
          value={totalNetworkDevices > 0 ? totalNetworkDevices : devices.length} 
          subtitle={`${devices.length} Switches • ${networkConfig?.wireless_aps?.length || 0} APs`}
          icon={<NetworkIcon size={20} />}
          highlightColor="16, 185, 129"
        />
        <StatCard 
          title="Connected Clients" 
          value={endDevices.filter(d => d.status === 'Online').length} 
          subtitle={`Out of ${endDevices.length} total recorded devices`}
          icon={<Cpu size={20} />}
          highlightColor="59, 130, 246"
        />
      </div>

      {/* Embedded Topology */}
      {networkConfig && (
        <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)' }}>
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Share2 size={16} color="var(--primary-color)" />
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Live Topology Map</span>
          </div>
          <TopologyView 
            networkConfig={networkConfig} 
            navigate={navigate} 
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {devices.map(device => {
          const ip = device.ip_trunk || device.ip_oob;
          const isCore = networkConfig?.switches?.core?.some(c => (typeof c === 'string' ? c : c.ip) === ip);
          const uplinkPorts = networkConfig?.uplinks?.[ip];
          // Don't pass a specific port for the Core switch, so it aggregates all interfaces!
          const primaryUplink = isCore ? null : (uplinkPorts && uplinkPorts.length > 0 ? uplinkPorts.join('|') : null);

          return (
            <SwitchCard 
              key={device.name} 
              switchData={device} 
              uplinkPort={primaryUplink} 
            />
          );
        })}
      </div>
    </div>
  );
};

export default NOCDashboard;
