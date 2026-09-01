import React, { useState } from 'react';
import { Branch, Camera, OmsetRecord, CameraLocationType } from '../types';
import { Plus, Edit2, Trash2, Shield, Calendar, DollarSign, Store, Tag, PlusCircle, Check, Database, Link2, RefreshCw, Download, Copy } from 'lucide-react';

interface BranchManagerProps {
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  cameras: Camera[];
  setCameras: React.Dispatch<React.SetStateAction<Camera[]>>;
  omsetRecords: OmsetRecord[];
  setOmsetRecords: React.Dispatch<React.SetStateAction<OmsetRecord[]>>;
}

export default function BranchManager({
  branches,
  setBranches,
  cameras,
  setCameras,
  omsetRecords,
  setOmsetRecords,
}: BranchManagerProps) {
  const [activeTab, setActiveTab] = useState<'branches' | 'cameras' | 'omset' | 'hik-integration'>('branches');
  const [integrationSubTab, setIntegrationSubTab] = useState<'rtsp' | 'openapi'>('rtsp');

  // Hik-Connect Multi-Account Integration States
  const [hikAccounts, setHikAccounts] = useState<any[]>(() => {
    const saved = localStorage.getItem('hik_accounts');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    const defaultAddr = localStorage.getItem('hik_server_address') || 'isgp-team.hikcentralconnect.com';
    const defaultAppKey = localStorage.getItem('hik_app_key') || '';
    const defaultSecret = localStorage.getItem('hik_secret_key') || '';
    return [{
      id: 'acc_1',
      name: 'Akun Utama Hikvision/EZVIZ',
      serverAddress: defaultAddr,
      appKey: defaultAppKey,
      secretKey: defaultSecret
    }];
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => hikAccounts[0]?.id || 'acc_1');

  // Currently active account object
  const activeHikAccount = hikAccounts.find(a => a.id === selectedAccountId) || hikAccounts[0] || {
    id: 'acc_1',
    name: 'Akun Utama Hik-Connect',
    serverAddress: 'isgp-team.hikcentralconnect.com',
    appKey: '',
    secretKey: ''
  };

  const [hikConfig, setHikConfig] = useState({
    serverAddress: activeHikAccount.serverAddress,
    appKey: activeHikAccount.appKey,
    secretKey: activeHikAccount.secretKey,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [importedCams, setImportedCams] = useState<any[]>([]);
  const [assignBranches, setAssignBranches] = useState<Record<string, string>>({});
  const [selectedCamIds, setSelectedCamIds] = useState<Record<string, boolean>>({});

  // Account Management Modals / Handlers
  const [showAddAccModal, setShowAddAccModal] = useState(false);
  const [newAccForm, setNewAccForm] = useState({
    name: '',
    serverAddress: 'isgp-team.hikcentralconnect.com',
    appKey: '',
    secretKey: ''
  });

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccForm.name || !newAccForm.appKey || !newAccForm.secretKey) return;

    const newAcc = {
      id: 'acc_' + Date.now(),
      name: newAccForm.name,
      serverAddress: newAccForm.serverAddress || 'isgp-team.hikcentralconnect.com',
      appKey: newAccForm.appKey,
      secretKey: newAccForm.secretKey,
    };

    const updated = [...hikAccounts, newAcc];
    setHikAccounts(updated);
    localStorage.setItem('hik_accounts', JSON.stringify(updated));
    setSelectedAccountId(newAcc.id);
    setHikConfig({ serverAddress: newAcc.serverAddress, appKey: newAcc.appKey, secretKey: newAcc.secretKey });
    setNewAccForm({ name: '', serverAddress: 'isgp-team.hikcentralconnect.com', appKey: '', secretKey: '' });
    setShowAddAccModal(false);
  };

  const handleDeleteAccount = (accId: string) => {
    if (hikAccounts.length <= 1) {
      alert("Anda harus menyisakan setidaknya 1 akun Hik-Connect.");
      return;
    }
    if (confirm("Apakah Anda yakin ingin menghapus akun Hik-Connect ini?")) {
      const updated = hikAccounts.filter(a => a.id !== accId);
      setHikAccounts(updated);
      localStorage.setItem('hik_accounts', JSON.stringify(updated));
      if (selectedAccountId === accId) {
        setSelectedAccountId(updated[0].id);
        setHikConfig({ serverAddress: updated[0].serverAddress, appKey: updated[0].appKey, secretKey: updated[0].secretKey });
      }
    }
  };

  // Moggumung POS Integration States
  const [moggumungConfig, setMoggumungConfig] = useState({
    apiUrl: 'https://on.moggumung.id',
    token: 'WPMX-F4J7-AUBT,8MAA-E8UW-RH59,2MFA-0GKS-HY3A',
    username: '',
    password: '',
  });
  const [moggumungStatus, setMoggumungStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [moggumungMsg, setMoggumungMsg] = useState('');

  const handleMoggumungSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setMoggumungStatus('syncing');
    setMoggumungMsg('Connecting to Moggumung POS (on.moggumung.id)...');

    try {
      const res = await fetch('/api/moggumung/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moggumungConfig)
      });
      
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        console.error("Moggumung POS Sync non-JSON response:", rawText.substring(0, 500));
        throw new Error(`Respons server (${res.status}) tidak valid.`);
      }
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal sinkronisasi data dari Moggumung POS');
      }

      // Convert Moggumung branches to RestoCast format
      if (data.branches && data.branches.length > 0) {
        const newBranches = data.branches.map((mb: any) => ({
          id: mb.id || mb.legacy_id || mb.name,
          name: mb.name,
          location: 'Real Branch',
          manager: 'Head Manager',
          targetOmsetDaily: 50000000
        }));
        
        setBranches(prev => {
          const map = new Map(prev.map(b => [b.id, b]));
          newBranches.forEach((nb: any) => map.set(nb.id, nb));
          return Array.from(map.values());
        });
      }

      // Convert Omset daily records matching on.moggumung.id exact numbers
      const todayStr = new Date().toISOString().split('T')[0];
      const syncedOmsets: OmsetRecord[] = [];

      if (data.branches && data.branches.length > 0) {
        data.branches.forEach((b: any, idx: number) => {
          const dailyAmount = Number(b.revenue ?? 0);

          syncedOmsets.push({
            id: 'omset_' + Date.now() + '_' + idx,
            branchId: b.id || b.name,
            date: todayStr,
            amount: dailyAmount,
            transactionsCount: Math.floor(dailyAmount / 65000) || (dailyAmount > 0 ? 120 : 0),
            peakHour: '12:00 - 14:00',
            notes: 'Synced live from on.moggumung.id'
          });
        });

        setOmsetRecords(syncedOmsets);
      }
      
      setMoggumungStatus('success');
      setMoggumungMsg(`Berhasil sinkronisasi ${data.branches?.length || 0} Cabang Riil & Rekam Omset dari on.moggumung.id.`);
    } catch (err: any) {
      setMoggumungStatus('error');
      setMoggumungMsg(err.message);
    }
  };

  // Clear all dummy data action
  const handleClearAllDummyData = () => {
    if (confirm("PERINGATAN HAPUS DATA:\n\nApakah Anda yakin ingin MENGHAPUS SEMUA DATA DUMMY?\nSemua cabang, kamera, dan data omset sample akan dibersihkan dari sistem agar Anda dapat menginput data riil.")) {
      setBranches([]);
      setCameras([]);
      setOmsetRecords([]);
      localStorage.removeItem('resto_branches');
      localStorage.removeItem('resto_cameras');
      localStorage.removeItem('resto_omset');
      alert("Semua data dummy telah berhasil dibersihkan! Silakan klik 'AMBIL DATA RESTORAN' untuk mengimpor Cabang & Omset riil dari on.moggumung.id.");
    }
  };

  // Form states
  const [branchForm, setBranchForm] = useState<Partial<Branch>>({ name: '', location: '', manager: '', targetOmsetDaily: 10000000 });
  const [cameraForm, setCameraForm] = useState<Partial<Camera>>({
    name: '',
    branchId: '',
    type: 'Hikvision IP',
    ipAddress: '192.168.1.100',
    port: 8000,
    channel: 1,
    locationType: 'cashier',
    status: 'online',
  });
  const [omsetForm, setOmsetForm] = useState<Partial<OmsetRecord>>({
    branchId: '',
    date: new Date().toISOString().split('T')[0],
    amount: 5000000,
    transactionsCount: 50,
    peakHour: '12:00 - 14:00',
    notes: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Branch CRUD handlers
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name || !branchForm.location) return;

    if (editingId) {
      setBranches(prev => prev.map(b => b.id === editingId ? { ...b, ...branchForm as Branch } : b));
      setEditingId(null);
    } else {
      const newBranch: Branch = {
        id: 'branch_' + Date.now(),
        name: branchForm.name,
        location: branchForm.location,
        manager: branchForm.manager || 'Kepala Cabang',
        targetOmsetDaily: Number(branchForm.targetOmsetDaily) || 10000000,
      };
      setBranches(prev => [...prev, newBranch]);
    }
    setBranchForm({ name: '', location: '', manager: '', targetOmsetDaily: 10000000 });
  };

  const handleEditBranch = (b: Branch) => {
    setBranchForm(b);
    setEditingId(b.id);
  };

  const handleDeleteBranch = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus cabang ini? Semua data kamera & omset terkait akan ikut terhapus.')) {
      setBranches(prev => prev.filter(b => b.id !== id));
      setCameras(prev => prev.filter(c => c.branchId !== id));
      setOmsetRecords(prev => prev.filter(o => o.branchId !== id));
    }
  };

  // Camera CRUD handlers
  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cameraForm.name || !cameraForm.branchId) return;

    if (editingId) {
      setCameras(prev => prev.map(c => c.id === editingId ? { ...c, ...cameraForm as Camera } : c));
      setEditingId(null);
    } else {
      const newCamera: Camera = {
        id: 'cam_' + Date.now(),
        branchId: cameraForm.branchId,
        name: cameraForm.name,
        type: cameraForm.type || 'Hikvision IP',
        ipAddress: cameraForm.ipAddress,
        port: Number(cameraForm.port) || 8000,
        channel: Number(cameraForm.channel) || 1,
        streamUrl: cameraForm.streamUrl,
        locationType: (cameraForm.locationType as CameraLocationType) || 'cashier',
        status: 'online',
      };
      setCameras(prev => [...prev, newCamera]);
    }
    setCameraForm({
      name: '',
      branchId: branches[0]?.id || '',
      type: 'Hikvision IP',
      ipAddress: '192.168.1.100',
      port: 8000,
      channel: 1,
      locationType: 'cashier',
      status: 'online',
    });
  };

  const handleEditCamera = (c: Camera) => {
    setCameraForm(c);
    setEditingId(c.id);
  };

  const handleDeleteCamera = (id: string) => {
    if (confirm('Hapus kamera CCTV ini?')) {
      setCameras(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleDuplicateCamera = (c: Camera) => {
    const nextChannel = (c.channel || 1) + 1;
    let newName = c.name;
    
    // Replace "CH X" or "Channel X" or append channel info nicely
    if (newName.match(/CH\s*\d+/i)) {
      newName = newName.replace(/CH\s*\d+/i, `CH ${nextChannel}`);
    } else if (newName.match(/Channel\s*\d+/i)) {
      newName = newName.replace(/Channel\s*\d+/i, `Channel ${nextChannel}`);
    } else {
      newName = `${newName} (CH ${nextChannel})`;
    }

    // Auto update stream URL ending number if it matches standard patterns like /101 to /102
    let newStreamUrl = c.streamUrl;
    if (newStreamUrl && newStreamUrl.match(/\d+$/)) {
      const match = newStreamUrl.match(/(\d+)$/);
      if (match) {
        const lastNum = parseInt(match[1]);
        if (lastNum >= 100 && lastNum < 200) {
          // RTSP stream channels pattern e.g., 101, 102, 103...
          newStreamUrl = newStreamUrl.replace(/\d+$/, String(lastNum + 1));
        } else {
          newStreamUrl = newStreamUrl.replace(/\d+$/, String(nextChannel));
        }
      }
    }

    const duplicated: Camera = {
      ...c,
      id: 'cam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: newName,
      channel: nextChannel,
      streamUrl: newStreamUrl,
      status: 'online',
    };
    setCameras(prev => [...prev, duplicated]);
  };

  // Fetch cameras from Hik-Connect OpenAPI
  const handleFetchHikCameras = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    setImportedCams([]);

    const appKey = hikConfig.appKey;
    const secretKey = hikConfig.secretKey;

    try {
      if (!hikConfig.serverAddress || !appKey || !secretKey) {
        throw new Error("Mohon lengkapi Server Address, AppKey, dan SecretKey terlebih dahulu.");
      }

      // 1. Save config inputs
      localStorage.setItem('hik_server_address', hikConfig.serverAddress);
      localStorage.setItem('hik_app_key', appKey);
      localStorage.setItem('hik_secret_key', secretKey);

      // 2. Get Access Token
      const tokenRes = await fetch('/api/hik/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverAddress: hikConfig.serverAddress,
          appKey,
          secretKey,
        }),
      });

      const tokenText = await tokenRes.text();
      let tokenData: any = null;
      try { tokenData = JSON.parse(tokenText); } catch { tokenData = null; }

      if (!tokenRes.ok || !tokenData) {
        throw new Error(tokenData?.error || `Gagal autentikasi ke server Hik-Connect: ${tokenRes.status} ${tokenText.substring(0, 50)}`);
      }

      const isSuccess = tokenData.errorCode === '0' || tokenData.code === '200' || tokenData.code === 200;
      if (!isSuccess || !tokenData.data?.accessToken) {
        throw new Error(tokenData.errorMsg || tokenData.message || tokenData.msg || `Error Code: ${tokenData.errorCode || tokenData.code} - Gagal mendapatkan Access Token.`);
      }

      const token = tokenData.data.accessToken;
      localStorage.setItem('hik_access_token', token);
      localStorage.setItem('hik_token_expiry', String(Date.now() + 24 * 3600 * 1000)); // Token valid for 24h

      // 3. Get Cameras
      const camsRes = await fetch('/api/hik/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverAddress: hikConfig.serverAddress,
          token: token,
          pageIndex: 1,
          pageSize: 100,
        }),
      });

      const camsText = await camsRes.text();
      let camsData: any = null;
      try { camsData = JSON.parse(camsText); } catch { camsData = null; }

      if (!camsRes.ok || !camsData) {
        throw new Error(camsData?.error || 'Gagal mengambil daftar kamera dari server');
      }

      if (camsData.errorCode !== '0') {
        throw new Error(camsData.errorMsg || 'Gagal mengambil daftar kamera');
      }

      const rawCameras = camsData.data?.list || camsData.data?.camera || (Array.isArray(camsData.data) ? camsData.data : []) || [];
      if (rawCameras.length === 0) {
        setSyncSuccess('Koneksi berhasil, namun tidak ada kamera yang ditemukan di akun Anda.');
        return;
      }
      
      console.log("Raw cameras from HikConnect Teams API:", JSON.stringify(rawCameras, null, 2));

      const fetchedCameras = rawCameras.map((cam: any) => ({
        id: cam.id || cam.cameraID || cam.cameraId || (cam.deviceSerial ? `${cam.deviceSerial}_${cam.channelNo || 1}` : Math.random().toString()),
        name: cam.name || cam.cameraName || `Camera ${cam.cameraID || cam.deviceSerial || ''}`,
        online: String(cam.online ?? cam.status ?? '1'),
        device: cam.device || { deviceSerial: cam.deviceSerial, channelInfo: { no: cam.channelNo || 1 } },
        debug_raw: cam
      }));

      setImportedCams(fetchedCameras);
      
      // Initialize branch assignments and selection state
      const initialAssignments: Record<string, string> = {};
      const initialSelection: Record<string, boolean> = {};
      fetchedCameras.forEach((cam: any, idx: number) => {
        // Assign to available branches cyclically or first branch
        const targetBranch = branches[idx % branches.length] || branches[0];
        initialAssignments[cam.id] = targetBranch?.id || '';
        initialSelection[cam.id] = true; // Select all by default
      });
      setAssignBranches(initialAssignments);
      setSelectedCamIds(initialSelection);

      setSyncSuccess(`Sukses! Berhasil terhubung ke ${hikConfig.serverAddress} dan menemukan ${fetchedCameras.length} kamera.`);
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Terjadi kesalahan saat menghubungkan API.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Perform camera import to global state
  const handleImportSelectedCameras = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    
    try {
      const token = localStorage.getItem('hik_access_token') || '';
      const serverAddress = localStorage.getItem('hik_server_address') || '';

      const camsToImport = importedCams.filter(cam => selectedCamIds[cam.id]);
      if (camsToImport.length === 0) {
        throw new Error('Pilih setidaknya 1 kamera untuk di-import.');
      }

      const newCamerasList: Camera[] = [];

      for (const cam of camsToImport) {
        const branchId = assignBranches[cam.id] || branches[0]?.id || '';
        
        // Fetch thumbnail url for this camera
        let thumbUrl = '';
        try {
          const thumbRes = await fetch('/api/hik/thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverAddress,
              token,
              cameraId: cam.id,
            }),
          });
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            const isThumbSuccess = thumbData.errorCode === '0' || thumbData.code === '200' || thumbData.code === 200;
            if ((isThumbSuccess || thumbData.data?.pictureURL) && thumbData.data?.pictureURL) {
              thumbUrl = thumbData.data.pictureURL;
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch thumbnail for camera ${cam.name}`, e);
        }

        // Map location type based on name keywords
        let locType: CameraLocationType = 'entrance';
        const nameLower = cam.name.toLowerCase();
        if (nameLower.includes('cashier') || nameLower.includes('kasir')) {
          locType = 'cashier';
        } else if (nameLower.includes('kitchen') || nameLower.includes('dapur')) {
          locType = 'kitchen';
        } else if (nameLower.includes('dining') || nameLower.includes('table') || nameLower.includes('meja') || nameLower.includes('dine')) {
          locType = 'dining';
        } else if (nameLower.includes('park') || nameLower.includes('garage') || nameLower.includes('depan')) {
          locType = 'parking';
        }

        newCamerasList.push({
          id: 'cam_hik_' + cam.id,
          branchId,
          name: cam.name,
          type: 'HikConnect Teams',
          status: cam.online === '1' ? 'online' : 'offline',
          locationType: locType,
          hikCameraId: cam.id,
          hikDeviceSerial: cam.device?.devInfo?.serialNo || cam.device?.deviceSerial || cam.deviceSerial || undefined,
          hikThumbnailUrl: thumbUrl,
          channel: cam.device?.channelInfo?.no ? Number(cam.device.channelInfo.no) : 1,
        });
      }

      // Add to cameras state, avoiding duplicates by hikCameraId
      setCameras(prev => {
        const filteredPrev = prev.filter(c => !newCamerasList.some(nc => nc.hikCameraId === c.hikCameraId));
        return [...filteredPrev, ...newCamerasList];
      });

      setSyncSuccess(`Berhasil mengimpor ${newCamerasList.length} kamera CCTV ke dalam dashboard RestoCast!`);
      setImportedCams([]);
    } catch (err: any) {
      setSyncError(err.message || 'Gagal mengimpor kamera.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Omset CRUD handlers
  const handleAddOmset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!omsetForm.branchId || !omsetForm.date || !omsetForm.amount) return;

    const existingIndex = omsetRecords.findIndex(r => r.branchId === omsetForm.branchId && r.date === omsetForm.date);

    if (existingIndex > -1) {
      // Overwrite/update existing record for that date
      setOmsetRecords(prev => prev.map((r, idx) => idx === existingIndex ? {
        ...r,
        amount: Number(omsetForm.amount),
        transactionsCount: Number(omsetForm.transactionsCount),
        peakHour: omsetForm.peakHour || '12:00 - 14:00',
        notes: omsetForm.notes,
      } : r));
    } else {
      const newRecord: OmsetRecord = {
        id: 'omset_' + Date.now(),
        branchId: omsetForm.branchId,
        date: omsetForm.date,
        amount: Number(omsetForm.amount),
        transactionsCount: Number(omsetForm.transactionsCount) || 30,
        peakHour: omsetForm.peakHour || '12:00 - 14:00',
        notes: omsetForm.notes,
      };
      setOmsetRecords(prev => [...prev, newRecord]);
    }

    setOmsetForm({
      branchId: branches[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      amount: 5000000,
      transactionsCount: 50,
      peakHour: '12:00 - 14:00',
      notes: '',
    });
  };

  const handleDeleteOmset = (id: string) => {
    if (confirm('Hapus laporan omset harian ini?')) {
      setOmsetRecords(prev => prev.filter(o => o.id !== id));
    }
  };

  return (
    <div className="glass rounded-xl p-6 shadow-xl font-sans">
      
      {/* Selector Subtabs */}
      <div className="flex border-b border-white/10 pb-4 mb-6 gap-2">
        <button
          onClick={() => { setActiveTab('branches'); setEditingId(null); }}
          className={`px-4 py-2.5 text-xs font-semibold font-mono tracking-widest rounded-lg transition-all ${
            activeTab === 'branches' 
              ? 'bg-white/15 text-white border border-white/15 shadow-sm' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Store className="w-4 h-4 opacity-70" /> CABANG RESTORAN
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('cameras'); setEditingId(null); }}
          className={`px-4 py-2.5 text-xs font-semibold font-mono tracking-widest rounded-lg transition-all ${
            activeTab === 'cameras' 
              ? 'bg-white/15 text-white border border-white/15 shadow-sm' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 opacity-70" /> CCTV HIKVISION
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('omset'); setEditingId(null); }}
          className={`px-4 py-2.5 text-xs font-semibold font-mono tracking-widest rounded-lg transition-all ${
            activeTab === 'omset' 
              ? 'bg-white/15 text-white border border-white/15 shadow-sm' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Database className="w-4 h-4 opacity-70" /> REKAM OMSET HARIAN
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('hik-integration'); setEditingId(null); }}
          className={`px-4 py-2.5 text-xs font-semibold font-mono tracking-widest rounded-lg transition-all ${
            activeTab === 'hik-integration' 
              ? 'bg-white/15 text-white border border-white/15 shadow-sm' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Link2 className="w-4 h-4 opacity-70" /> HUBUNGKAN CCTV & API
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('moggumung'); setEditingId(null); }}
          className={`px-4 py-2.5 text-xs font-semibold font-mono tracking-widest rounded-lg transition-all ${
            activeTab === 'moggumung' 
              ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/15 shadow-sm' 
              : 'text-[#10b981]/60 hover:text-[#10b981] hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 opacity-70" /> SINKRONISASI MOGGUMUNG POS
          </span>
        </button>

        <button
          onClick={handleClearAllDummyData}
          className="ml-auto px-3.5 py-2.5 text-[10px] font-semibold font-mono tracking-widest text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all flex items-center gap-1.5"
          title="Hapus semua cabang, kamera, dan data omset sample agar siap untuk data riil"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>HAPUS DATA DUMMY</span>
        </button>
      </div>

      {/* TABS CONTAINER */}
      <div>
        
        {/* ======================= TAB 1: BRANCH MANAGEMENT ======================= */}
        {activeTab === 'branches' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Form Column */}
            <div className="lg:col-span-1 bg-white/2 p-6 rounded-xl border border-white/5">
              <h3 className="text-xs font-bold text-white font-mono tracking-widest uppercase mb-5">
                {editingId ? 'EDIT CABANG RESTO' : 'TAMBAH CABANG RESTO'}
              </h3>
              <form onSubmit={handleAddBranch} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Nama Cabang</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Cabang Sudirman, Cabang Dago"
                    value={branchForm.name || ''}
                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Alamat / Lokasi</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Jl. Jenderal Sudirman No. 45, Bandung"
                    value={branchForm.location || ''}
                    onChange={e => setBranchForm({ ...branchForm, location: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Nama Manager</label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={branchForm.manager || ''}
                    onChange={e => setBranchForm({ ...branchForm, manager: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Target Omset Harian (IDR)</label>
                  <input
                    type="number"
                    required
                    placeholder="10000000"
                    value={branchForm.targetOmsetDaily || ''}
                    onChange={e => setBranchForm({ ...branchForm, targetOmsetDaily: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>
                
                <button type="submit" className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-semibold py-3 rounded-lg transition-all font-mono uppercase tracking-widest flex items-center justify-center gap-1.5">
                  {editingId ? <Check className="w-4 h-4 text-[#10b981]" /> : <PlusCircle className="w-4 h-4 opacity-80" />}
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambahkan Cabang'}</span>
                </button>
              </form>
            </div>

            {/* Branches List Column */}
            <div className="lg:col-span-2">
              <h3 className="text-xs font-bold text-white/70 font-mono tracking-widest uppercase mb-5">DAFTAR CABANG AKTIF</h3>
              <div className="space-y-4">
                {branches.map(b => (
                  <div key={b.id} className="bg-white/2 border border-white/5 p-5 rounded-xl flex items-center justify-between hover:border-white/10 transition-all">
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">{b.name}</h4>
                      <p className="text-xs text-white/50 mt-1 font-sans">{b.location}</p>
                      <div className="flex gap-4 mt-2.5 text-[10px] text-white/40 font-mono">
                        <span>Manager: <strong className="text-white/70">{b.manager}</strong></span>
                        <span>Target: <strong className="text-[#10b981]">{formatIDR(b.targetOmsetDaily)} / hari</strong></span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button onClick={() => handleEditBranch(b)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteBranch(b.id)} className="p-2 text-white/60 hover:text-[#ef4444] hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: CCTV CONFIGURATION ======================= */}
        {activeTab === 'cameras' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Form Column */}
            <div className="lg:col-span-1 bg-white/2 p-6 rounded-xl border border-white/5">
              <h3 className="text-xs font-bold text-white font-mono tracking-widest uppercase mb-5">
                {editingId ? 'EDIT KONFIGURASI CAMERA' : 'TAMBAH CAMERA HIKVISION'}
              </h3>
              <form onSubmit={handleAddCamera} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Cabang Penempatan</label>
                  <select
                    value={cameraForm.branchId || ''}
                    onChange={e => setCameraForm({ ...cameraForm, branchId: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                    required
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id} className="bg-zinc-950">{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Nama / Label Kamera</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: CCTV Kasir 1, Area Dapur Belakang"
                    value={cameraForm.name || ''}
                    onChange={e => setCameraForm({ ...cameraForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Tipe Koneksi CCTV</label>
                  <select
                    value={cameraForm.type || 'Hikvision IP'}
                    onChange={e => setCameraForm({ ...cameraForm, type: e.target.value as any })}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                  >
                    <option value="Hikvision IP" className="bg-zinc-950">Hikvision IP Camera (Simulasi)</option>
                    <option value="RTSP Stream" className="bg-zinc-950">RTSP Network Address</option>
                    <option value="HLS Web Stream" className="bg-zinc-950">HLS m3u8 Web Stream</option>
                    <option value="EZVIZ WebRTC" className="bg-zinc-950">EZVIZ / ISUP Protocol</option>
                  </select>
                </div>

                {/* Show IP/Port fields for Hikvision */}
                {cameraForm.type === 'Hikvision IP' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">IP Address</label>
                      <input
                        type="text"
                        placeholder="192.168.1.64"
                        value={cameraForm.ipAddress || ''}
                        onChange={e => setCameraForm({ ...cameraForm, ipAddress: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Port</label>
                      <input
                        type="number"
                        placeholder="8000"
                        value={cameraForm.port || ''}
                        onChange={e => setCameraForm({ ...cameraForm, port: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Channel NVR</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={cameraForm.channel || ''}
                      onChange={e => setCameraForm({ ...cameraForm, channel: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Fokus Pengawasan</label>
                    <select
                      value={cameraForm.locationType || 'cashier'}
                      onChange={e => setCameraForm({ ...cameraForm, locationType: e.target.value as any })}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                    >
                      <option value="cashier" className="bg-zinc-950">Meja Kasir (Cashier)</option>
                      <option value="kitchen" className="bg-zinc-950">Area Dapur (Kitchen)</option>
                      <option value="dining" className="bg-zinc-950">Ruang Makan (Dining)</option>
                      <option value="parking" className="bg-zinc-950">Area Parkir (Parking)</option>
                      <option value="entrance" className="bg-zinc-950">Pintu Masuk (Entrance)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Stream URL (Opsional)</label>
                  <input
                    type="text"
                    placeholder="rtsp://admin:pass@192.168.1.64:554/Streaming/Channels/101"
                    value={cameraForm.streamUrl || ''}
                    onChange={e => setCameraForm({ ...cameraForm, streamUrl: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>

                <button type="submit" className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-semibold py-3 rounded-lg transition-all font-mono uppercase tracking-widest flex items-center justify-center gap-1.5">
                  {editingId ? <Check className="w-4 h-4 text-[#10b981]" /> : <PlusCircle className="w-4 h-4 opacity-80" />}
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambahkan Kamera'}</span>
                </button>
              </form>
            </div>

            {/* Cameras List Column */}
            <div className="lg:col-span-2">
              <h3 className="text-xs font-bold text-white/70 font-mono tracking-widest uppercase mb-5">CCTV TERDAFTAR</h3>
              <div className="space-y-4">
                {cameras.map(c => {
                  const b = branches.find(branch => branch.id === c.branchId);
                  return (
                    <div key={c.id} className="bg-white/2 border border-white/5 p-5 rounded-xl flex items-center justify-between hover:border-white/10 transition-all">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm font-bold text-white font-mono">{c.name}</h4>
                          <span className="text-[8px] bg-white/10 text-white/80 font-mono border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
                            {c.locationType}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-1.5">Cabang: <strong className="text-white/70">{b ? b.name : 'Unknown Branch'}</strong></p>
                        <div className="flex gap-4 mt-2.5 text-[10px] text-white/40 font-mono">
                          <span>Protokol: <strong className="text-white/60">{c.type}</strong></span>
                          {c.ipAddress && <span>IP: <strong className="text-white/60">{c.ipAddress}:{c.port} (CH {c.channel})</strong></span>}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDuplicateCamera(c)} 
                          title="Tambah Channel Baru untuk NVR ini"
                          className="px-2.5 py-2 text-xs font-mono font-bold bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/25 rounded-lg border border-[#10b981]/20 transition-all flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>+ CH</span>
                        </button>
                        <button onClick={() => handleEditCamera(c)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCamera(c.id)} className="p-2 text-white/60 hover:text-[#ef4444] hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: REVENUE DATA RECORDS ======================= */}
        {activeTab === 'omset' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Form Column */}
            <div className="lg:col-span-1 bg-white/2 p-6 rounded-xl border border-white/5">
              <h3 className="text-xs font-bold text-white font-mono tracking-widest uppercase mb-5">INPUT OMSET HARIAN CABANG</h3>
              <form onSubmit={handleAddOmset} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Pilih Cabang</label>
                  <select
                    value={omsetForm.branchId || ''}
                    onChange={e => setOmsetForm({ ...omsetForm, branchId: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30"
                    required
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id} className="bg-zinc-950">{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Tanggal Penjualan</label>
                  <input
                    type="date"
                    required
                    value={omsetForm.date || ''}
                    onChange={e => setOmsetForm({ ...omsetForm, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Jumlah Omset Aktual (IDR)</label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 12500000"
                    value={omsetForm.amount || ''}
                    onChange={e => setOmsetForm({ ...omsetForm, amount: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Jumlah Transaksi</label>
                    <input
                      type="number"
                      required
                      placeholder="85"
                      value={omsetForm.transactionsCount || ''}
                      onChange={e => setOmsetForm({ ...omsetForm, transactionsCount: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Jam Terpadat (Peak)</label>
                    <input
                      type="text"
                      placeholder="18:00 - 20:00"
                      value={omsetForm.peakHour || ''}
                      onChange={e => setOmsetForm({ ...omsetForm, peakHour: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Catatan Operasional (Opsional)</label>
                  <textarea
                    placeholder="Contoh: Ramai karena promo gajian, atau kendala mati lampu singkat"
                    value={omsetForm.notes || ''}
                    onChange={e => setOmsetForm({ ...omsetForm, notes: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 focus:outline-none focus:border-white/30 h-20"
                  />
                </div>

                <button type="submit" className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-semibold py-3 rounded-lg transition-all font-mono uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <Database className="w-4 h-4 text-[#10b981]" />
                  <span>Simpan Rekam Omset</span>
                </button>
              </form>
            </div>

            {/* Omset History Table Column */}
            <div className="lg:col-span-2 overflow-x-auto">
              <h3 className="text-xs font-bold text-white/70 font-mono tracking-widest uppercase mb-5">RIWAYAT LAPORAN OMSET</h3>
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] tracking-widest">
                    <th className="py-3 px-3 font-medium">Tanggal</th>
                    <th className="py-3 px-3 font-medium">Cabang</th>
                    <th className="py-3 px-3 font-medium">Omset Aktual</th>
                    <th className="py-3 px-3 font-medium">Struk</th>
                    <th className="py-3 px-3 font-medium">Jam Sibuk</th>
                    <th className="py-3 px-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {omsetRecords.map(o => {
                    const b = branches.find(branch => branch.id === o.branchId);
                    return (
                      <tr key={o.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-3 px-3 text-white/50">{o.date}</td>
                        <td className="py-3 px-3 font-bold text-white">{b ? b.name : 'Unknown'}</td>
                        <td className="py-3 px-3 text-[#10b981] font-bold">{formatIDR(o.amount)}</td>
                        <td className="py-3 px-3 text-white/60">{o.transactionsCount}</td>
                        <td className="py-3 px-3 text-white/60">{o.peakHour}</td>
                        <td className="py-3 px-3 text-right">
                          <button onClick={() => handleDeleteOmset(o.id)} className="p-1.5 text-white/40 hover:text-[#ef4444] hover:bg-white/5 rounded transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB 4: HIK-CONNECT OPENAPI & DIRECT RTSP INTEGRATION ======================= */}
        {activeTab === 'hik-integration' && (
          <div className="space-y-6">
            
            {/* Sub-Tab Selection Header */}
            <div className="flex border-b border-white/5 pb-4 gap-4">
              <button
                onClick={() => setIntegrationSubTab('rtsp')}
                className={`px-4 py-2 text-xs font-semibold font-mono tracking-wider rounded-lg transition-all ${
                  integrationSubTab === 'rtsp'
                    ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                METODE A: RTSP PROXY / HLS STREAM (Sangat Mudah & Direkomendasikan)
              </button>
              <button
                onClick={() => setIntegrationSubTab('openapi')}
                className={`px-4 py-2 text-xs font-semibold font-mono tracking-wider rounded-lg transition-all ${
                  integrationSubTab === 'openapi'
                    ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                METODE B: HIK-CONNECT TEAMS CLOUD API (Butuh Developer Akun)
              </button>
            </div>

            {integrationSubTab === 'rtsp' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Method A: Left Tutorial/Instruction panel */}
                <div className="lg:col-span-2 bg-white/2 p-6 rounded-xl border border-white/5 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-[#10b981]" />
                    <h3 className="text-sm font-bold text-white font-mono tracking-wider uppercase">
                      PANDUAN HUBUNGKAN NVR / CCTV MULTI-CHANNEL (RTSP DIRECT)
                    </h3>
                  </div>

                  <p className="text-xs text-white/75 leading-relaxed">
                    NVR Hikvision Anda di cabang dapat diakses langsung oleh browser tanpa perlu pusing mendaftar OpenAPI Hik-Connect. Anda hanya perlu menerjemahkan protokol RTSP lokal menjadi format web <strong className="text-[#10b981]">HLS (.m3u8)</strong> yang aman menggunakan software converter gratis.
                  </p>

                  {/* Step by Step list */}
                  <div className="space-y-4">
                    <div className="bg-white/3 p-4 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center text-[10px] font-mono font-bold">1</span>
                        <h4 className="text-xs font-bold text-white font-mono">Format RTSP Asli Hikvision (NVR)</h4>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed mb-2">
                        Format link streaming langsung untuk masing-masing channel NVR Anda adalah sebagai berikut:
                      </p>
                      <div className="bg-black/40 p-3 rounded font-mono text-[11px] text-white/80 border border-white/5 select-all leading-relaxed">
                        rtsp://<span className="text-[#10b981] font-bold">username</span>:<span className="text-[#10b981] font-bold">password</span>@<span className="text-[#10b981] font-bold">IP_NVR_Cabang</span>:<span className="text-[#10b981] font-bold">RTSP_Port</span>/Streaming/Channels/<span className="text-[#10b981] font-bold">ChannelID</span>
                      </div>
                      <div className="mt-2 text-[10px] text-white/40 leading-relaxed">
                        * <strong className="text-white/70">Contoh Port RTSP:</strong> Biasanya port <span className="text-white/75 font-mono">554</span> atau port custom sesuai router Anda (misal <span className="text-white/75 font-mono">21615</span>).<br/>
                        * <strong className="text-white/70">Pola Channel ID:</strong> <br/>
                        &nbsp;&nbsp;- Channel 1 (Kasir 1) Utama: <span className="text-[#10b981] font-mono font-bold">101</span> | Sub-stream (Lebih Ringan): <span className="text-[#10b981] font-mono font-bold">102</span><br/>
                        &nbsp;&nbsp;- Channel 2 (Dapur) Utama: <span className="text-[#10b981] font-mono font-bold">201</span> | Sub-stream: <span className="text-[#10b981] font-mono font-bold">202</span><br/>
                        &nbsp;&nbsp;- Channel 16 Utama: <span className="text-[#10b981] font-mono font-bold">1601</span> | Sub-stream: <span className="text-[#10b981] font-mono font-bold">1602</span>
                      </div>
                    </div>

                    <div className="bg-white/3 p-4 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center text-[10px] font-mono font-bold">2</span>
                        <h4 className="text-xs font-bold text-white font-mono">Gunakan Gateway RTSP ke Web (Free & Aman)</h4>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed mb-3">
                        Karena browser modern tidak mendukung pemutaran link <code className="text-zinc-100 font-mono">rtsp://</code> secara langsung, Anda cukup mengunduh software gateway gratis seperti <strong className="text-[#10b981] hover:underline">MediaMTX</strong> atau <strong className="text-[#10b981] hover:underline">go2rtc</strong> di PC/Server mana saja yang terhubung internet:
                      </p>
                      
                      <ol className="list-decimal pl-4 space-y-2 text-[10px] text-white/50 leading-relaxed">
                        <li>Unduh <strong className="text-white/70">MediaMTX</strong> (Gratis, open-source, ringan).</li>
                        <li>Buka file konfigurasi <code className="text-zinc-100 font-mono">mediamtx.yml</code> dan masukkan daftar channel NVR Anda:
                          <pre className="bg-black/50 p-2.5 rounded mt-1 text-[9px] font-mono text-[#10b981] border border-white/5">
{`paths:
  bandung_kasir: rtsp://admin:moggumung123@101.128.102.105:21615/Streaming/Channels/102
  bandung_dapur: rtsp://admin:moggumung123@101.128.102.105:21615/Streaming/Channels/202`}
                          </pre>
                        </li>
                        <li>MediaMTX otomatis menghasilkan link stream m3u8 yang sangat stabil untuk dimasukkan ke dashboard:
                          <div className="mt-1.5 text-[#10b981] font-mono text-[9px]">
                            http://[IP_Server_Anda]:8888/bandung_kasir/index.m3u8
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div className="bg-white/3 p-4 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center text-[10px] font-mono font-bold">3</span>
                        <h4 className="text-xs font-bold text-white font-mono">Cara Cepat Tambah Banyak Channel</h4>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Pergi ke tab <strong className="text-white/70 font-mono">"CCTV HIKVISION"</strong> di atas. Kami telah menambahkan tombol <strong className="text-[#10b981] font-mono">+ CH (Duplikat Channel)</strong>. Anda cukup klik tombol tersebut untuk menduplikat konfigurasi NVR Bandung Anda secara otomatis dan melaju ke Channel 2, 3, dst secara instan!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Quick Action Panel */}
                <div className="lg:col-span-1 bg-white/2 p-6 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono tracking-widest uppercase mb-4">
                      TIPS STREAMING SUB-STREAM
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed mb-4">
                      Selalu gunakan resolusi <strong className="text-white">Sub-Stream (Channel 102, 202, dll)</strong> saat menghubungkan CCTV ke dashboard. 
                    </p>
                    <p className="text-xs text-white/60 leading-relaxed mb-4">
                      Mengapa? Sub-stream memiliki bandwidth yang sangat kecil (hemat kuota) namun tetap lancar diputar secara bersamaan di banyak layar TV sekaligus dibandingkan Main-stream.
                    </p>
                    <div className="p-3 bg-white/3 border border-white/5 rounded-lg text-[10px] font-mono text-[#10b981] leading-relaxed">
                      <strong>Rekomendasi Software:</strong><br/>
                      • MediaMTX (Terpopuler)<br/>
                      • go2rtc (Sangat Cepat)<br/>
                      • Scrypted (Dukungan Apple)<br/>
                      • Shinobi (CCTV NVR Software)
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={() => setActiveTab('cameras')}
                      className="w-full bg-[#10b981] hover:bg-[#10b981]/90 text-zinc-950 text-xs font-bold py-3.5 rounded-lg transition-all font-mono uppercase tracking-widest flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 text-zinc-950" />
                      <span>Atur Kamera Sekarang</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {integrationSubTab === 'openapi' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Credentials Form Column */}
                <div className="lg:col-span-1 bg-white/2 p-6 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-[#10b981]" />
                        <h3 className="text-xs font-bold text-white font-mono tracking-widest uppercase">
                          MANAJEMEN AKUN HIK-CONNECT
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowAddAccModal(true)}
                        className="px-2.5 py-1 text-[9px] font-mono font-bold bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/30 rounded uppercase tracking-wider transition"
                      >
                        + TAMBAH AKUN
                      </button>
                    </div>

                    <p className="text-xs text-white/50 mb-5 leading-relaxed">
                      Simpan dan kelola beberapa pasang AppKey & SecretKey dari berbagai akun Hik-Connect / NVR cabang Anda.
                    </p>

                    {/* Account Switcher */}
                    <div className="mb-5 p-3 bg-white/3 border border-white/10 rounded-xl space-y-2">
                      <label className="block text-[9px] font-mono text-white/40 uppercase tracking-wider">Pilih Akun Hik-Connect:</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedAccountId}
                          onChange={(e) => {
                            const accId = e.target.value;
                            setSelectedAccountId(accId);
                            const acc = hikAccounts.find(a => a.id === accId);
                            if (acc) {
                              setHikConfig({
                                serverAddress: acc.serverAddress,
                                appKey: acc.appKey,
                                secretKey: acc.secretKey
                              });
                            }
                          }}
                          className="flex-1 bg-[#0a0a0a] border border-white/15 rounded-lg py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-white/40"
                        >
                          {hikAccounts.map(acc => (
                            <option key={acc.id} value={acc.id} className="bg-zinc-950 text-white">
                              {acc.name} ({acc.serverAddress})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDeleteAccount(selectedAccountId)}
                          title="Hapus Akun Ini"
                          className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleFetchHikCameras} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Server Address</label>
                        <input
                          type="text"
                          required
                          placeholder="isgp-team.hikcentralconnect.com"
                          value={hikConfig.serverAddress}
                          onChange={e => {
                            setHikConfig({ ...hikConfig, serverAddress: e.target.value });
                            setHikAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, serverAddress: e.target.value } : a));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">App Key</label>
                        <input
                          type="text"
                          required
                          placeholder="Masukkan AppKey dari Hik Connect"
                          value={hikConfig.appKey}
                          onChange={e => {
                            setHikConfig({ ...hikConfig, appKey: e.target.value });
                            setHikAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, appKey: e.target.value } : a));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Secret Key</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••••••••••••••"
                          value={hikConfig.secretKey}
                          onChange={e => {
                            setHikConfig({ ...hikConfig, secretKey: e.target.value });
                            setHikAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, secretKey: e.target.value } : a));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={isSyncing}
                        className="w-full bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 text-xs font-semibold py-3 rounded-lg transition-all font-mono uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSyncing ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-[#10b981]" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-[#10b981]" />
                        )}
                        <span>{isSyncing ? 'MENGHUBUNGKAN...' : 'HUBUNGKAN AKUN INI'}</span>
                      </button>
                    </form>

                    {/* Status Messages */}
                    {syncError && (
                      <div className="mt-4 p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg text-xs text-[#ef4444] font-mono leading-relaxed space-y-2">
                        <div><strong>Gagal:</strong> {syncError}</div>
                      </div>
                    )}

                    {syncSuccess && (
                      <div className="mt-4 p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg text-xs text-[#10b981] font-mono leading-relaxed">
                        {syncSuccess}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-5 border-t border-white/5 text-[10px] font-mono text-white/30 leading-relaxed">
                    Hik-Connect Teams OpenAPI menggunakan verifikasi Signature aman di sisi Server untuk menjaga integritas kredensial Anda.
                  </div>
                </div>

                {/* Imported/Synchronized Cameras Grid Column */}
                <div className="lg:col-span-2 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="text-xs font-bold text-white/70 font-mono tracking-widest uppercase">
                        DAFTAR CHANNEL KAMERA TERDETEKSI ({importedCams.length})
                      </h3>
                      {importedCams.length > 0 && (
                        <button
                          onClick={() => {
                            const allSelected = Object.values(selectedCamIds).every(v => v);
                            const newSelection: Record<string, boolean> = {};
                            importedCams.forEach(cam => {
                              newSelection[cam.id] = !allSelected;
                            });
                            setSelectedCamIds(newSelection);
                          }}
                          className="text-[10px] font-mono text-[#10b981] hover:underline"
                        >
                          {Object.values(selectedCamIds).every(v => v) ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    {importedCams.length > 0 ? (
                      <div className="max-h-[500px] overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5">
                        {importedCams.map(cam => (
                          <div key={cam.id} className="p-4 bg-white/2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            
                            {/* Left Side: Cam Info & Status */}
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={!!selectedCamIds[cam.id]}
                                onChange={() => setSelectedCamIds(prev => ({ ...prev, [cam.id]: !prev[cam.id] }))}
                                className="mt-1 rounded bg-white/5 border-white/10 text-[#10b981] focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <span className="text-sm font-semibold text-white tracking-tight block">
                                  {cam.name}
                                </span>
                                <span className="text-[10px] font-mono text-white/40 mt-1 block">
                                  ID: {cam.id.slice(0, 10)}... | Channel: {cam.device?.channelInfo?.no || 1}
                                </span>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <span className={`w-2 h-2 rounded-full ${cam.online === '1' ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-zinc-500'}`} />
                                  <span className="text-[9px] font-mono text-white/50 uppercase">
                                    {cam.online === '1' ? 'ONLINE' : 'OFFLINE'}
                                  </span>
                                </div>
                            
                              </div>
                            
                            </div>
                            

                            {/* Right Side: Assign Target Branch dropdown */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono text-white/40 uppercase">Cabang:</span>
                              <select
                                value={assignBranches[cam.id] || ''}
                                onChange={e => setAssignBranches(prev => ({ ...prev, [cam.id]: e.target.value }))}
                                className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white/80 focus:outline-none focus:border-white/30"
                              >
                                {branches.map(b => (
                                  <option key={b.id} value={b.id} className="bg-zinc-950 text-white">
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            

                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 h-[320px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-12 text-center bg-white/2">
                        <Link2 className="w-12 h-12 text-white/15 mb-3 animate-pulse" />
                        <p className="text-white/60 font-mono text-xs tracking-wider uppercase font-bold">KONEKSI BELUM DIBANGUN</p>
                        <p className="text-white/30 text-[10px] mt-2 leading-relaxed max-w-sm mx-auto">
                          Silakan isi form kredensial di sebelah kiri dan klik "Hubungkan" untuk mengambil 26+ kamera CCTV dari sistem Anda.
                        </p>
                      </div>
                    )}
                  </div>

                  {importedCams.length > 0 && (
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleImportSelectedCameras}
                        disabled={isSyncing}
                        className="bg-[#10b981] hover:bg-[#10b981]/90 text-zinc-950 font-bold px-6 py-3 rounded-lg text-xs tracking-widest uppercase font-mono flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all disabled:opacity-50"
                      >
                        <Download className="w-4 h-4 text-zinc-950" />
                        <span>IMPORT {importedCams.filter(cam => selectedCamIds[cam.id]).length} KAMERA CCTV</span>
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* ======================= TAB 5: MOGGUMUNG POS ======================= */}
        {activeTab === 'moggumung' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/2 p-6 rounded-xl border border-white/5 flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <RefreshCw className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-xs font-bold text-white font-mono tracking-widest uppercase">
                  MOGGUMUNG POS INTEGRATION
                </h3>
              </div>
              
              <p className="text-xs text-white/60 mb-6 leading-relaxed">
                Gunakan kredensial (user id & password) Anda untuk mensinkronisasikan data cabang dan omset secara otomatis dari sistem Moggumung POS (on.moggumung.id).
              </p>

              <form onSubmit={handleMoggumungSync} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">API Base URL</label>
                  <input
                    type="url"
                    required
                    value={moggumungConfig.apiUrl}
                    onChange={e => setMoggumungConfig({ ...moggumungConfig, apiUrl: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">User ID</label>
                  <input
                    type="text"
                    required
                    value={moggumungConfig.username}
                    onChange={e => setMoggumungConfig({ ...moggumungConfig, username: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-white/45 mb-1.5 uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    required
                    value={moggumungConfig.password}
                    onChange={e => setMoggumungConfig({ ...moggumungConfig, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={moggumungStatus === 'syncing'}
                  className="w-full bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/25 text-xs font-semibold py-3 rounded-lg transition-all font-mono uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 mt-4"
                >
                  <RefreshCw className={`w-4 h-4 ${moggumungStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>{moggumungStatus === 'syncing' ? 'MENSINKRONISASIKAN...' : 'AMBIL DATA RESTORAN'}</span>
                </button>
              </form>

              {moggumungStatus === 'error' && (
                <div className="mt-4 p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg text-xs text-[#ef4444] font-mono leading-relaxed">
                  <strong>Gagal:</strong> {moggumungMsg}
                </div>
              )}

              {moggumungStatus === 'success' && (
                <div className="mt-4 p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg text-xs text-[#10b981] font-mono leading-relaxed">
                  {moggumungMsg}
                </div>
              )}
            </div>

            <div className="bg-white/2 p-6 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
              <Database className="w-12 h-12 text-white/10 mb-4" />
              <h4 className="text-sm font-bold text-white mb-2">Automasi Omset</h4>
              <p className="text-xs text-white/50 max-w-sm leading-relaxed">
                Sinkronisasi ini akan secara otomatis menarik data daftar cabang beserta omset harian terakhir dari masing-masing cabang Moggumung Anda, sehingga laporan AI akan lebih akurat dan ter-update.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Modal: Tambah Akun Hik-Connect Baru */}
      {showAddAccModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono tracking-wider uppercase mb-4 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#10b981]" />
              <span>TAMBAH AKUN HIK-CONNECT BARU</span>
            </h3>
            
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-white/40 mb-1 uppercase tracking-wider">Nama Akun (Misal: Akun Seminyak / Akun Bandung)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Akun Seminyak NVR"
                  value={newAccForm.name}
                  onChange={e => setNewAccForm({ ...newAccForm, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 mb-1 uppercase tracking-wider">Server Address</label>
                <input
                  type="text"
                  required
                  placeholder="isgp-team.hikcentralconnect.com"
                  value={newAccForm.serverAddress}
                  onChange={e => setNewAccForm({ ...newAccForm, serverAddress: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 mb-1 uppercase tracking-wider">App Key</label>
                <input
                  type="text"
                  required
                  placeholder="AppKey dari Hikvision OpenAPI"
                  value={newAccForm.appKey}
                  onChange={e => setNewAccForm({ ...newAccForm, appKey: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 mb-1 uppercase tracking-wider">Secret Key</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••••••••••••••"
                  value={newAccForm.secretKey}
                  onChange={e => setNewAccForm({ ...newAccForm, secretKey: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccModal(false)}
                  className="px-4 py-2 text-xs font-mono text-white/50 hover:text-white"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-mono font-bold bg-[#10b981] hover:bg-[#10b981]/90 text-zinc-950 rounded-lg uppercase tracking-wider"
                >
                  SIMPAN AKUN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
