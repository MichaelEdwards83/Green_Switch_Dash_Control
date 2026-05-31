import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

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

const TopologyMap = () => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const renderMap = async () => {
      try {
        const response = await fetch('/api/mapper/config');
        const networkConfig = await response.json();
        
        if (!active) return;

        const nodes = [];
        const edges = [];
        
        let idCounter = 1;
        const ipToId = {};
        
        const ignoredSubnets = networkConfig.ignore_lldp_subnets || [];
        
        // Cores
        const cores = (networkConfig.switches?.core) || [];
        cores.forEach(c => {
          if (ignoredSubnets.some(sub => ipInSubnet(c.ip, sub))) return;
          ipToId[c.ip] = idCounter;
          nodes.push({ id: idCounter++, label: c.name, group: 'core', title: `IP: ${c.ip}`, level: 0 });
        });
        
        // Edges
        const edgesArr = (networkConfig.switches?.edge) || [];
        edgesArr.forEach(e => {
          if (ignoredSubnets.some(sub => ipInSubnet(e.ip, sub))) return;
          ipToId[e.ip] = idCounter;
          nodes.push({ id: idCounter++, label: e.name, group: 'edge', title: `IP: ${e.ip}`, level: 1 });
        });

        // APs
        const apsArr = networkConfig.wireless_aps || [];
        apsArr.forEach(ap => {
          if (ignoredSubnets.some(sub => ipInSubnet(ap.ip, sub))) return;
          ipToId[ap.ip] = idCounter;
          nodes.push({ id: idCounter++, label: ap.name, group: 'ap', title: `Wireless AP: ${ap.ip}`, level: 2 });
        });

        // Links
        if (networkConfig.topology_links?.length > 0) {
          networkConfig.topology_links.forEach(link => {
            [link.source, link.target].forEach(ip => {
              if (ignoredSubnets.some(sub => ipInSubnet(ip, sub))) return;
              if (!ipToId[ip]) {
                ipToId[ip] = idCounter;
                nodes.push({ id: idCounter++, label: ip, group: 'unmanaged', title: `IP: ${ip} (Unmanaged)`, level: 2 });
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

        const data = { nodes, edges };
        const options = {
          layout: { 
            hierarchical: {
              enabled: true,
              direction: 'UD',
              sortMethod: 'directed',
              nodeSpacing: 150,
              levelSeparation: 150
            }
          },
          nodes: { shape: 'dot', size: 20, font: { color: '#e2e8f0', face: 'Inter' } },
          groups: {
            core: { color: { background: '#ef4444', border: '#b91c1c' }, size: 30 },
            edge: { color: { background: '#3b82f6', border: '#2563eb' } },
            ap: { color: { background: '#a855f7', border: '#7e22ce' }, size: 25, shape: 'diamond' },
            unmanaged: { color: { background: '#94a3b8', border: '#64748b' }, size: 15 }
          },
          edges: { width: 2 },
          physics: {
            hierarchicalRepulsion: {
              nodeDistance: 150
            }
          }
        };

        if (networkRef.current) {
          networkRef.current.destroy();
        }

        if (containerRef.current) {
          networkRef.current = new Network(containerRef.current, data, options);
          networkRef.current.once("stabilizationIterationsDone", () => {
            networkRef.current.fit();
            networkRef.current.setOptions({ physics: { enabled: false } });
          });
        }
        
        setLoading(false);
      } catch (e) {
        console.error("Failed to render map", e);
        setLoading(false);
      }
    };

    renderMap();
    return () => {
      active = false;
      if (networkRef.current) {
        networkRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="topology-container" style={{ width: '100%', height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      <header className="dashboard-header" style={{ flexShrink: 0 }}>
        <h1 className="header-title">Topology Map</h1>
      </header>
      <div style={{ flex: 1, position: 'relative', background: 'var(--bg-secondary, #0f172a)' }}>
        {loading && <div style={{ position: 'absolute', top: 20, left: 20, color: 'white' }}>Loading map...</div>}
        <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default TopologyMap;
