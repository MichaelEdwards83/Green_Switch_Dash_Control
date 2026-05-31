import express from 'express';
import cors from 'cors';
import tcpPing from 'tcp-ping';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Priority: Portable Executable > Environmental Override > PKG standalone > Local folder
const basePath = process.env.PORTABLE_EXECUTABLE_DIR || 
    process.env.APP_BASE_PATH ||
    (process.pkg ? path.dirname(process.execPath) : process.cwd());

import dotenv from 'dotenv';
const possibleEnvPaths = [
    process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, '.env') : null,
    path.join(basePath, '.env'),
    process.env.TEMP_EXTRACT_PATH ? path.join(process.env.TEMP_EXTRACT_PATH, '.env') : null
].filter(Boolean);

let loadedEnv = false;
for (const envFile of possibleEnvPaths) {
    if (fs.existsSync(envFile)) {
        dotenv.config({ path: envFile });
        console.log(`[Server] Loaded .env from ${envFile}`);
        loadedEnv = true;
        break;
    }
}
if (!loadedEnv) {
    console.warn('[Server] No .env file found. Searching paths:', possibleEnvPaths);
}

console.log(`[Server] Credentials Status: User=${process.env.SWITCH_USER ? 'SET' : 'MISSING'}, Pass=${process.env.SWITCH_PASS ? 'SET' : 'MISSING'}`);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Proxy /api/mapper requests to Python backend
app.use('/api/mapper', createProxyMiddleware({
    target: process.env.MAPPER_URL || 'http://127.0.0.1:8080',
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/'
    },
    onError: (err, req, res) => {
        console.error('[Proxy Error]', err.message);
        res.status(502).json({ error: 'Mapper Backend is down' });
    }
}));

app.use(express.json());

// Serve React build from the embedded 'dist' folder relative to this script
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Read configuration from devices.json on the host OS
let devices = [];
let loadedDevices = false;

const possibleDevicePaths = [
    process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, 'devices.json') : null,
    path.join(basePath, 'devices.json'),
    process.env.TEMP_EXTRACT_PATH ? path.join(process.env.TEMP_EXTRACT_PATH, 'devices.json') : null
].filter(Boolean);

for (const devFile of possibleDevicePaths) {
    try {
        if (fs.existsSync(devFile)) {
            devices = JSON.parse(fs.readFileSync(devFile, 'utf8'));
            console.log(`[Server] Loaded ${devices.length} devices from ${devFile}`);
            loadedDevices = true;
            break;
        }
    } catch (e) {
        console.error(`[Server] Failed to parse ${devFile}:`, e.message);
    }
}

if (!loadedDevices) {
    console.warn(`[Server] devices.json not found. Starting with empty device list. Searched paths:`, possibleDevicePaths);
}

// Agent Configuration for Switches
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    minVersion: 'TLSv1'
});

class NetgearConfigAgent {
    constructor(ip, username, password) {
        this.ip = ip;
        this.username = username;
        this.password = password;
        this.baseUrl = `https://${ip}:8443/api/v1`;
        this.token = null;
        this.loginPromise = null;
        this.client = axios.create({
            baseURL: this.baseUrl,
            httpsAgent,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        // Handle token expiration globally for this agent
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response && error.response.status === 401 && !originalRequest._retry && originalRequest.url !== '/login') {
                    originalRequest._retry = true;
                    this.token = null;
                    if (await this.login()) {
                        originalRequest.headers['Authorization'] = `Bearer ${this.token}`;
                        return this.client(originalRequest);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    async login() {
        if (!this.username || !this.password) {
            console.error(`[${this.ip}] Login failed: Missing credentials (check your .env file)`);
            return false;
        }
        
        if (this.loginPromise) return this.loginPromise;

        this.loginPromise = (async () => {
            try {
                const res = await this.client.post('/login', {
                    login: {
                        username: String(this.username),
                        password: String(this.password)
                    }
                });
                const token = res.data.login?.token;
                if (token) {
                    this.token = token;
                    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    return true;
                }
            } catch (err) {
                console.error(`[${this.ip}] Login failed: ${err.message}`);
            } finally {
                this.loginPromise = null;
            }
            return false;
        })();

        return this.loginPromise;
    }

    async getDeviceInfo() {
        try {
            const res = await this.client.get('/device_info');
            return res.data.deviceInfo; // { serialNumber, model, swVer, ... }
        } catch (err) {
            console.error(`[${this.ip}] Device Info failed: ${err.message}`);
            return null;
        }
    }

    async getPortStats(count = 48) {
        if (!this.token && !(await this.login())) return null;

        const startId = 1;
        const endId = startId + count + 12; // Buffer for potential backplane ports

        const chunks = [];
        for (let i = startId; i <= endId; i += 8) {
            chunks.push(i);
        }

        const allStats = [];

        for (const chunkStart of chunks) {
            try {
                const batchPromises = [];
                const batchEnd = Math.min(chunkStart + 7, endId);

                for (let pid = chunkStart; pid <= batchEnd; pid++) {
                    batchPromises.push(
                        this.client.get(`/sw_portstats?portid=${pid}`).catch(e => {
                            if (chunkStart === startId && pid === startId) {
                                console.error(`[${this.ip}] Port ${pid} stats fetch failed:`, e.message);
                            }
                            return null;
                        })
                    );
                }

                const results = await Promise.all(batchPromises);
                
                // Debug log for the first port response to see its structure
                if (chunkStart === startId && results[0] && results[0].data) {
                    console.log(`[${this.ip}] Raw portstats keys:`, Object.keys(results[0].data));
                }
                
                results.forEach(r => {
                    if (r && r.data) {
                        if (r.data.switchStatsPort) {
                            if (Array.isArray(r.data.switchStatsPort)) {
                                allStats.push(...r.data.switchStatsPort);
                            } else {
                                allStats.push(r.data.switchStatsPort);
                            }
                        } else {
                            // If switchStatsPort is missing but data is present, log it once
                            if (chunkStart === startId) console.log(`[${this.ip}] Unexpected stats format:`, Object.keys(r.data));
                        }
                    }
                });

            } catch (err) {
                console.error(`[${this.ip}] Chunk fetch failed: ${err.message}`);
            }
        }
        return allStats;
    }

    async getVlanInfo(vlanId) {
        try {
            const res = await this.client.get(`/swcfg_vlan?vlanid=${vlanId}`);
            return res.data.switchConfigVlan;
        } catch (err) {
            return null;
        }
    }

    // Helper to find API ID from App ID (Physical ID)
    async getApiIdForPhysical(physId) {
        const stats = await this.getPortStats(60);
        if (!stats) return physId;

        const match = stats.find(p => {
            const nameStr = p.intfName || p.name || p.interface || p.description || "";
            return nameStr.includes(`1/0/${physId}`);
        });

        if (match) return match.portId;
        return physId;
    }

    // New Retry Logic Helper
    async updateVlanMembership(vlanId, transformFn) {
        let attempts = 0;
        const maxAttempts = 10;
        let excludedPorts = new Set();

        while (attempts < maxAttempts) {
            attempts++;
            const res = await this.client.get(`/swcfg_vlan_membership?vlanid=${vlanId}`);
            let membership = res.data.vlanMembership;
            if (!membership) return false;

            // Apply modification
            membership = transformFn(membership);

            // Filter excluded ports
            if (excludedPorts.size > 0 && membership.portMembers) {
                const filteredPortMembers = [];
                const filteredPvidMembers = [];

                membership.portMembers.forEach((m, idx) => {
                    if (!excludedPorts.has(m.port)) {
                        filteredPortMembers.push(m);
                        if (membership.pvidMembers && membership.pvidMembers.length > idx) {
                            filteredPvidMembers.push(membership.pvidMembers[idx]);
                        } else {
                            filteredPvidMembers.push({});
                        }
                    }
                });

                membership.portMembers = filteredPortMembers;
                membership.pvidMembers = filteredPvidMembers;
            }
            if (!membership.pvidMembers) membership.pvidMembers = [];

            // Scrub problematic fields
            membership.trafficPrio = [];
            membership.trafficPrioLagMem = [];
            membership.trafficPrioPortMem = [];

            const postRes = await this.client.post('/swcfg_vlan_membership', { vlanMembership: membership });
            const resp = postRes.data.resp;

            if (resp && resp.status === 'failure') {
                const msg = resp.respMsg || "";

                const addMatch = msg.match(/Failed to add.*port\(([0-9]+)\)/i);
                if (addMatch) {
                    const badPort = parseInt(addMatch[1]);
                    console.log(`[${this.ip}] Protected port ${badPort} detected (Add). Excluding...`);
                    excludedPorts.add(badPort);
                    continue;
                }

                const removeMatch = msg.match(/Failed to remove.*port\(([0-9]+)\)/i);
                if (removeMatch) {
                    console.log(`[${this.ip}] Switch refused to remove ${removeMatch[1]} (Trunk?). Assuming Success.`);
                    return true;
                }

                console.error(`[${this.ip}] VLAN Update Error: ${msg}`);
                return false;
            }
            return true;
        }
        return false;
    }

    async setVlan(appPortId, vlanId) {
        if (!this.token && !(await this.login())) throw new Error('Auth failed');
        let portId;
        try {
            portId = parseInt(await this.getApiIdForPhysical(appPortId), 10);
            const vId = parseInt(vlanId, 10);

            const getRes = await this.client.get(`/swcfg_port?portid=${portId}`);
            if (getRes.data.resp?.status !== 'success') throw new Error('Failed to fetch port config');
            const config = getRes.data.switchPortConfig;
            const oldPvid = config.portVlanId;

            const membershipSuccess = await this.updateVlanMembership(vId, (membership) => {
                let members = membership.portMembers || [];
                if (!members.find(m => m.port === portId)) {
                    members.push({ port: portId, tagged: false });
                    if (membership.pvidMembers) membership.pvidMembers.push({ portid: portId });
                }
                membership.portMembers = members;
                return membership;
            });

            if (!membershipSuccess) throw new Error('Failed to update VLAN membership after retries.');

            await new Promise(r => setTimeout(r, 500));

            config.portVlanId = vId;
            config.ID = parseInt(config.ID);
            await this.client.post(`/swcfg_port?portid=${portId}`, { switchPortConfig: config });
            console.log(`[${this.ip}] Port ${portId} successfully assigned PVID ${vId}`);
            await new Promise(r => setTimeout(r, 500));

            if (oldPvid !== vId && oldPvid !== 0) {
                await this.removeVlanMember(oldPvid, portId);
                console.log(`[${this.ip}] Removed Port ${portId} from VLAN ${oldPvid}`);
            }

            if (typeof this.saveConfig === 'function') {
                await this.saveConfig();
            } else {
                console.log(`[${this.ip}] saveConfig method skipped (not implemented)`);
            }

            return true;
        } catch (err) {
            console.error(`[${this.ip}] Error setting VLAN for Port ${portId}:`, err.message);
            throw err;
        }
    }

    async removeVlanMember(vlanId, portId) {
        await this.updateVlanMembership(vlanId, (membership) => {
            if (!membership.portMembers) return membership;

            const idx = membership.portMembers.findIndex(m => m.port === parseInt(portId));
            if (idx !== -1) {
                membership.portMembers.splice(idx, 1);
                if (membership.pvidMembers && membership.pvidMembers.length > idx) {
                    membership.pvidMembers.splice(idx, 1);
                }
            }
            return membership;
        });
    }

    async cyclePoe(appPortId) {
        if (!this.token && !(await this.login())) throw new Error('Auth failed');
        try {
            const portId = await this.getApiIdForPhysical(appPortId);
            await this.client.post(`/swcfg_port?portid=${portId}`, {
                switchPortConfig: { isPoE: false }
            });
            await new Promise(r => setTimeout(r, 1000));
            await this.client.post(`/swcfg_port?portid=${portId}`, {
                switchPortConfig: { isPoE: true }
            });
            return true;
        } catch (err) {
            console.error(`[${this.ip}] PoE Cycle failed: ${err.message}`);
            throw err;
        }
    }
}

// In-Memory Caches
const switchCache = {};
const activeAgents = {}; // ip -> NetgearConfigAgent

function getAgent(ip) {
    if (!ip) return null;
    if (!activeAgents[ip]) {
        activeAgents[ip] = new NetgearConfigAgent(ip, process.env.SWITCH_USER, process.env.SWITCH_PASS);
    }
    return activeAgents[ip];
}

function getPortCountFromModel(model) {
    if (!model) return 48; // Default
    const m = model.toUpperCase();
    if (m.includes('96X')) return 96;
    if (m.includes('52G')) return 52;
    if (m.includes('48X')) return 48;
    if (m.includes('28G')) return 28;
    if (m.includes('24X')) return 24;
    if (m.includes('12X12F')) return 24;
    if (m.includes('8X8F')) return 16;
    if (m.includes('16X')) return 16;
    return 48; // Fallback
}

async function pollSwitch(sw) {
    let activeIp = sw.ip_oob;
    let usedChannel = 'oob';
    let oobStatus = false;
    let trunkStatus = false;

    // Check OOB
    const agentOob = getAgent(sw.ip_oob);
    if (agentOob && (agentOob.token || await agentOob.login())) {
        try {
            if (await agentOob.getDeviceInfo()) oobStatus = true;
        } catch (e) {}
    }

    // Check Trunk if configured
    let agentTrunk = null;
    if (sw.ip_trunk) {
        agentTrunk = getAgent(sw.ip_trunk);
        if (agentTrunk && (agentTrunk.token || await agentTrunk.login())) {
            try {
                if (await agentTrunk.getDeviceInfo()) trunkStatus = true;
            } catch (e) {}
        }
    }

    let resultAgent = null;
    if (oobStatus) {
        resultAgent = agentOob;
        activeIp = sw.ip_oob;
        usedChannel = 'oob';
    } else if (trunkStatus) {
        resultAgent = agentTrunk;
        activeIp = sw.ip_trunk;
        usedChannel = 'trunk';
    }

    if (!resultAgent) {
        const currentCache = switchCache[sw.ip_oob] || {};
        switchCache[sw.ip_oob] = {
            ...currentCache,
            connectivity: { oob: false, trunk: false, active: 'none' }
        };
        return;
    }

    try {
        const deviceInfo = await resultAgent.getDeviceInfo();
        const derivedPortCount = getPortCountFromModel(deviceInfo?.model);
        const portStats = await resultAgent.getPortStats(derivedPortCount);

        if (deviceInfo && portStats) {
            const portMap = {};
            const foundVlans = new Set();

            portStats.forEach(p => {
                let appId = null;
                const nameStr = p.intfName || p.name || p.interface || "";
                const match = nameStr.match(/1\/0\/(\d+)/);
                if (match) {
                    appId = parseInt(match[1]);
                } else {
                    appId = p.portId;
                }

                if (!appId || appId < 1) return;

                const isUp = p.status === 0 || p.oprState === 0;
                const pvid = (p.vlans && p.vlans.length > 0) ? p.vlans[0] : 1;
                if (p.vlans) p.vlans.forEach(v => foundVlans.add(v));

                portMap[appId] = {
                    id: appId,
                    apiId: p.portId,
                    name: `1/0/${appId}`,
                    description: p.myDesc || p.description || '',
                    up: isUp,
                    poe: p.poeStatus === 2,
                    vlan: pvid,
                    speed: p.speed === 130 ? '1G' : 'Unknown'
                };
            });

            const currentCache = switchCache[sw.ip_oob] || {};
            const vlanMap = currentCache.vlanMap || { 1: 'Default' };
            for (const vid of foundVlans) {
                if (!vlanMap[vid]) {
                    const vInfo = await resultAgent.getVlanInfo(vid);
                    if (vInfo) vlanMap[vid] = vInfo.vlanName || vInfo.name;
                    if (!vlanMap[vid]) vlanMap[vid] = `VLAN ${vid}`;
                }
            }

            switchCache[sw.ip_oob] = {
                ports: portMap,
                systemName: sw.name,
                systemModel: deviceInfo.model,
                deviceType: sw.type,
                connectivity: {
                    oob: oobStatus,
                    trunk: trunkStatus,
                    active: usedChannel
                },
                vlanMap: vlanMap,
                activeIp: activeIp,
                derivedPortCount: derivedPortCount
            };
        }
    } catch (err) {
        console.error(`[${sw.ip_oob}] Poll Data Error: ${err.message}`);
    }
}

const pollSwitches = async () => {
    const switchList = devices.filter(d => d.type === 'switch');
    const BATCH_SIZE = 5;
    for (let i = 0; i < switchList.length; i += BATCH_SIZE) {
        const batch = switchList.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(sw => pollSwitch(sw)));
    }
    setTimeout(pollSwitches, 15000);
};

// Start background loop
pollSwitches();

// --- API ROUTES ---

// 1. Unified Status Endpoint (TCP Pings + Switch Cache)
app.get('/api/status', async (req, res) => {
    const statusPromises = devices.map(async (device) => {
        const checkOob = new Promise((resolve) => {
            if (!device.ip_oob) resolve(false);
            else tcpPing.probe(device.ip_oob, device.port || 80, (err, available) => resolve(available));
        });

        const checkTrunk = new Promise((resolve) => {
            if (!device.ip_trunk) resolve(false);
            else tcpPing.probe(device.ip_trunk, device.port || 80, (err, available) => resolve(available));
        });

        const [oob, trunk] = await Promise.all([checkOob, checkTrunk]);

        const cachedData = device.type === 'switch' ? switchCache[device.ip_oob] : null;
        const isSwitchOnline = cachedData ? cachedData.connectivity.active !== 'none' : false;

        return {
            ...device,
            online_oob: oob,
            online_trunk: trunk,
            online: device.type === 'switch' ? isSwitchOnline : (oob || trunk),
            lastChecked: new Date().toISOString(),
            switchDetails: cachedData ? {
                connectivity: cachedData.connectivity,
                ports: cachedData.ports,
                systemModel: cachedData.systemModel,
                vlanMap: cachedData.vlanMap,
                derivedPortCount: cachedData.derivedPortCount
            } : null
        };
    });

    try {
        const results = await Promise.all(statusPromises);
        res.json(results);
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: 'Failed to check device status' });
    }
});

app.get('/api/debug', (req, res) => {
    res.json({
        basePath: basePath,
        tempPath: process.env.TEMP_EXTRACT_PATH || 'N/A',
        hasUser: !!process.env.SWITCH_USER,
        hasPass: !!process.env.SWITCH_PASS,
        envPath: envPath,
        devicesFile: devicesPath
    });
});

// 2. Control APIs (VLAN / PoE)
app.post('/api/vlan/set', express.json(), async (req, res) => {
    const { ip, port, vlanId } = req.body;
    if (!ip || !port || !vlanId) return res.status(400).json({ error: 'Missing ip, port, or vlanId' });

    const cached = switchCache[ip];
    const targetIp = cached?.activeIp || ip;

    const agent = getAgent(targetIp);
    if (!agent) return res.status(500).json({ error: 'Failed to initialize agent' });
    try {
        await agent.setVlan(port, vlanId);

        if (switchCache[ip] && switchCache[ip].ports && switchCache[ip].ports[port]) {
            switchCache[ip].ports[port].vlan = parseInt(vlanId);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/poe/cycle', express.json(), async (req, res) => {
    const { ip, port } = req.body;
    if (!ip || !port) return res.status(400).json({ error: 'Missing ip or port' });

    const cached = switchCache[ip];
    const targetIp = cached?.activeIp || ip;

    const agent = getAgent(targetIp);
    if (!agent) return res.status(500).json({ error: 'Failed to initialize agent' });
    try {
        await agent.cyclePoe(port);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin APIs
app.get('/api/admin/devices', (req, res) => {
    res.json(devices);
});

app.post('/api/admin/devices', express.json(), (req, res) => {
    const { password, newDevices } = req.body;
    if (password !== 'FuseFuse123!') {
        return res.status(401).json({ error: 'Invalid password' });
    }
    if (!Array.isArray(newDevices)) {
        return res.status(400).json({ error: 'newDevices must be an array' });
    }
    
    // Save to the highest priority file that was found, or default
    const targetFile = process.env.USER_DATA_PATH 
        ? path.join(process.env.USER_DATA_PATH, 'devices.json') 
        : (possibleDevicePaths.find(p => p && fs.existsSync(p)) || path.join(basePath, 'devices.json'));
    try {
        fs.writeFileSync(targetFile, JSON.stringify(newDevices, null, 2));
        devices = newDevices;
        res.json({ success: true, message: 'Devices updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/credentials', (req, res) => {
    res.json({
        username: process.env.SWITCH_USER || '',
        password: process.env.SWITCH_PASS ? '********' : ''
    });
});

app.post('/api/admin/credentials', express.json(), (req, res) => {
    const { password, credentials } = req.body;
    if (password !== 'FuseFuse123!') {
        return res.status(401).json({ error: 'Invalid password' });
    }
    
    if (credentials.username) process.env.SWITCH_USER = credentials.username;
    if (credentials.password && credentials.password !== '********') {
        process.env.SWITCH_PASS = credentials.password;
    }
    
    // Save to .env
    const envPath = process.env.USER_DATA_PATH 
        ? path.join(process.env.USER_DATA_PATH, '.env')
        : (possibleEnvPaths.find(p => p && fs.existsSync(p)) || path.join(basePath, '.env'));
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (envContent.includes('SWITCH_USER=')) {
        envContent = envContent.replace(/SWITCH_USER=.*/, `SWITCH_USER=${process.env.SWITCH_USER}`);
    } else {
        envContent += `\nSWITCH_USER=${process.env.SWITCH_USER}`;
    }
    
    if (envContent.includes('SWITCH_PASS=')) {
        envContent = envContent.replace(/SWITCH_PASS=.*/, `SWITCH_PASS=${process.env.SWITCH_PASS}`);
    } else {
        envContent += `\nSWITCH_PASS=${process.env.SWITCH_PASS}`;
    }
    
    try {
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        
        // Update any active agents with new credentials
        for (const ip in activeAgents) {
            activeAgents[ip].username = process.env.SWITCH_USER;
            activeAgents[ip].password = process.env.SWITCH_PASS;
            activeAgents[ip].token = null; // force re-login
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Metrics API
app.get('/api/metrics/:ip', async (req, res) => {
    const { ip } = req.params;
    const { range, port } = req.query; // e.g. '24h', '2h'
    
    try {
        const promUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
        
        // Find device to match both oob and trunk
        const device = devices.find(d => d.ip_oob === ip || d.ip_trunk === ip);
        let ipsToMatch = [ip];
        if (device) {
            ipsToMatch = [device.ip_oob, device.ip_trunk].filter(Boolean);
        }
        const instanceRegex = `^(${ipsToMatch.join('|')})$`;

        // Calculate time range
        const end = Math.floor(Date.now() / 1000);
        let start = end - 3600; // Default 1 hour
        let step = '1m';

        if (range === '24h') {
            start = end - 86400;
            step = '30m';
        } else if (range === '2h') {
            start = end - 7200;
            step = '2m';
        }
        
        const portFilter = port ? `,ifName=~".*(${port}).*"` : '';
        const groupBy = req.query.perPort === 'true' ? ' by (ifName)' : '';
        const queryIn = encodeURIComponent(`sum${groupBy}(rate(ifHCInOctets{instance=~"${instanceRegex}"${portFilter}}[5m])) * 8`);
        const queryOut = encodeURIComponent(`sum${groupBy}(rate(ifHCOutOctets{instance=~"${instanceRegex}"${portFilter}}[5m])) * 8`);

        const [inRes, outRes] = await Promise.all([
            axios.get(`${promUrl}/api/v1/query_range?query=${queryIn}&start=${start}&end=${end}&step=${step}`),
            axios.get(`${promUrl}/api/v1/query_range?query=${queryOut}&start=${start}&end=${end}&step=${step}`)
        ]);

        res.json({
            inbound: inRes.data?.data?.result || [],
            outbound: outRes.data?.data?.result || []
        });
    } catch (e) {
        console.error(`[${ip}] Error fetching metrics from Prometheus:`, e.message);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// SPA Fallback
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Dashboard not found. Please ensure "dist" folder is present.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Merged API Server running on http://0.0.0.0:${PORT}`);
});
