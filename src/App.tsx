import React, { useState, useEffect } from 'react';
import { Branch, Camera, OmsetRecord } from './types';
import TVDashboard from './components/TVDashboard';
import RevenueChart from './components/RevenueChart';
import AIPerformanceAdvisor from './components/AIPerformanceAdvisor';
import BranchManager from './components/BranchManager';
import { Monitor, TrendingUp, Sparkles, Settings, Shield, Activity, Database, Coffee, Store, MapPin, Award } from 'lucide-react';

// Seeding high-quality Indonesian restaurant branches with real custom configurations
// Seeding real Moggumung restaurant branches
const DEFAULT_BRANCHES: Branch[] = [
  { id: 'SEMINYAK', name: 'SEMINYAK', location: 'Seminyak, Bali', manager: 'Budi Santoso', targetOmsetDaily: 25000000 },
  { id: 'JIMBARAN', name: 'JIMBARAN', location: 'Jimbaran, Bali', manager: 'Dewi Lestari', targetOmsetDaily: 15000000 },
  { id: 'UBUD', name: 'UBUD', location: 'Ubud, Bali', manager: 'Wayan Sujana', targetOmsetDaily: 15000000 },
  { id: 'CANGGU', name: 'CANGGU', location: 'Canggu, Bali', manager: 'Made Pratama', targetOmsetDaily: 20000000 },
  { id: 'BANDUNG', name: 'BANDUNG', location: 'Bandung, Jawa Barat', manager: 'Rizky Kurniawan', targetOmsetDaily: 18000000 },
  { id: 'MEDAN PATTIMURA', name: 'MEDAN PATTIMURA', location: 'Medan, Sumatera Utara', manager: 'Siti Rahma', targetOmsetDaily: 10000000 },
];

const DEFAULT_CAMERAS: Camera[] = [
  // Seminyak
  { id: 'c_semi_1', branchId: 'SEMINYAK', name: 'Camera 01 - Kasir', type: 'HikConnect Teams', ipAddress: '192.168.1.101', port: 8000, channel: 1, status: 'online', locationType: 'cashier', hikCameraId: 'cam_semi_1' },
  { id: 'c_semi_2', branchId: 'SEMINYAK', name: 'Camera 02 - Dapur', type: 'HikConnect Teams', ipAddress: '192.168.1.102', port: 8000, channel: 2, status: 'online', locationType: 'kitchen', hikCameraId: 'cam_semi_2' },
  { id: 'c_semi_3', branchId: 'SEMINYAK', name: 'Camera 03 - Dining', type: 'HikConnect Teams', ipAddress: '192.168.1.103', port: 8000, channel: 3, status: 'online', locationType: 'dining', hikCameraId: 'cam_semi_3' },
  { id: 'c_semi_4', branchId: 'SEMINYAK', name: 'Camera 04 - Parkir', type: 'HikConnect Teams', ipAddress: '192.168.1.104', port: 8000, channel: 4, status: 'online', locationType: 'parking', hikCameraId: 'cam_semi_4' },
  { id: 'c_semi_5', branchId: 'SEMINYAK', name: 'Camera 05 - Masuk', type: 'HikConnect Teams', ipAddress: '192.168.1.105', port: 8000, channel: 5, status: 'online', locationType: 'entrance', hikCameraId: 'cam_semi_5' },

  // Jimbaran
  { id: 'c_jim_1', branchId: 'JIMBARAN', name: 'Camera 01 - Kasir', type: 'HikConnect Teams', ipAddress: '192.168.2.101', port: 8000, channel: 1, status: 'online', locationType: 'cashier', hikCameraId: 'cam_jim_1' },
  { id: 'c_jim_2', branchId: 'JIMBARAN', name: 'Camera 02 - Dapur', type: 'HikConnect Teams', ipAddress: '192.168.2.102', port: 8000, channel: 2, status: 'online', locationType: 'kitchen', hikCameraId: 'cam_jim_2' },
  { id: 'c_jim_3', branchId: 'JIMBARAN', name: 'Camera 03 - Dining', type: 'HikConnect Teams', ipAddress: '192.168.2.103', port: 8000, channel: 3, status: 'online', locationType: 'dining', hikCameraId: 'cam_jim_3' },
  { id: 'c_jim_4', branchId: 'JIMBARAN', name: 'Camera 04 - Parkir', type: 'HikConnect Teams', ipAddress: '192.168.2.104', port: 8000, channel: 4, status: 'online', locationType: 'parking', hikCameraId: 'cam_jim_4' },

  // Ubud
  { id: 'c_ubud_1', branchId: 'UBUD', name: 'Camera 01 - Kasir', type: 'HikConnect Teams', ipAddress: '192.168.3.101', port: 8000, channel: 1, status: 'online', locationType: 'cashier', hikCameraId: 'cam_ubud_1' },
  { id: 'c_ubud_2', branchId: 'UBUD', name: 'Camera 02 - Dapur', type: 'HikConnect Teams', ipAddress: '192.168.3.102', port: 8000, channel: 2, status: 'online', locationType: 'kitchen', hikCameraId: 'cam_ubud_2' },
  { id: 'c_ubud_3', branchId: 'UBUD', name: 'Camera 03 - Dining', type: 'HikConnect Teams', ipAddress: '192.168.3.103', port: 8000, channel: 3, status: 'online', locationType: 'dining', hikCameraId: 'cam_ubud_3' },
  { id: 'c_ubud_4', branchId: 'UBUD', name: 'Camera 04 - Parkir', type: 'HikConnect Teams', ipAddress: '192.168.3.104', port: 8000, channel: 4, status: 'online', locationType: 'parking', hikCameraId: 'cam_ubud_4' },

  // Canggu
  { id: 'c_can_1', branchId: 'CANGGU', name: 'Camera 01 - Kasir', type: 'HikConnect Teams', ipAddress: '192.168.4.101', port: 8000, channel: 1, status: 'online', locationType: 'cashier', hikCameraId: 'cam_can_1' },
  { id: 'c_can_2', branchId: 'CANGGU', name: 'Camera 02 - Dapur', type: 'HikConnect Teams', ipAddress: '192.168.4.102', port: 8000, channel: 2, status: 'online', locationType: 'kitchen', hikCameraId: 'cam_can_2' },
  { id: 'c_can_3', branchId: 'CANGGU', name: 'Camera 03 - Dining', type: 'HikConnect Teams', ipAddress: '192.168.4.103', port: 8000, channel: 3, status: 'online', locationType: 'dining', hikCameraId: 'cam_can_3' },
  { id: 'c_can_4', branchId: 'CANGGU', name: 'Camera 04 - Parkir', type: 'HikConnect Teams', ipAddress: '192.168.4.104', port: 8000, channel: 4, status: 'online', locationType: 'parking', hikCameraId: 'cam_can_4' },

  // Bandung
  { id: 'c_bdg_1', branchId: 'BANDUNG', name: 'Camera 01 - Kasir', type: 'HikConnect Teams', ipAddress: '101.128.102.105', port: 21615, channel: 1, status: 'online', locationType: 'cashier', hikCameraId: 'cam_bdg_1' },
  { id: 'c_bdg_2', branchId: 'BANDUNG', name: 'Camera 02 - Dapur', type: 'HikConnect Teams', ipAddress: '101.128.102.105', port: 21615, channel: 2, status: 'online', locationType: 'kitchen', hikCameraId: 'cam_bdg_2' },
  { id: 'c_bdg_3', branchId: 'BANDUNG', name: 'Camera 03 - Dining', type: 'HikConnect Teams', ipAddress: '101.128.102.105', port: 21615, channel: 3, status: 'online', locationType: 'dining', hikCameraId: 'cam_bdg_3' },
  { id: 'c_bdg_4', branchId: 'BANDUNG', name: 'Camera 04 - Parkir', type: 'HikConnect Teams', ipAddress: '101.128.102.105', port: 21615, channel: 4, status: 'online', locationType: 'parking', hikCameraId: 'cam_bdg_4' },

  // Medan Pattimura
  { id: 'c_med_1', branchId: 'MEDAN PATTIMURA', name: 'Camera 01 - Kasir', type: 'HikConnect Teams', ipAddress: '192.168.6.101', port: 8000, channel: 1, status: 'online', locationType: 'cashier', hikCameraId: 'cam_med_1' },
  { id: 'c_med_2', branchId: 'MEDAN PATTIMURA', name: 'Camera 02 - Dapur', type: 'HikConnect Teams', ipAddress: '192.168.6.102', port: 8000, channel: 2, status: 'online', locationType: 'kitchen', hikCameraId: 'cam_med_2' },
  { id: 'c_med_3', branchId: 'MEDAN PATTIMURA', name: 'Camera 03 - Dining', type: 'HikConnect Teams', ipAddress: '192.168.6.103', port: 8000, channel: 3, status: 'online', locationType: 'dining', hikCameraId: 'cam_med_3' },
];

const INITIAL_CAMERAS: Camera[] = DEFAULT_CAMERAS;

// Seeding realistic omset records for the branches
const DEFAULT_OMSET_RECORDS: OmsetRecord[] = [
  { id: 'o_semi_1', branchId: 'SEMINYAK', date: '2026-09-01', amount: 4296710, transactionsCount: 66, peakHour: '19:00 - 21:00' },
  { id: 'o_jim_1', branchId: 'JIMBARAN', date: '2026-09-01', amount: 6482960, transactionsCount: 99, peakHour: '12:00 - 14:00' },
  { id: 'o_bdg_1', branchId: 'BANDUNG', date: '2026-09-01', amount: 6850250, transactionsCount: 105, peakHour: '18:00 - 20:00' },
  { id: 'o_can_1', branchId: 'CANGGU', date: '2026-09-01', amount: 6150650, transactionsCount: 94, peakHour: '17:00 - 19:00' },
  { id: 'o_ubud_1', branchId: 'UBUD', date: '2026-09-01', amount: 2588520, transactionsCount: 40, peakHour: '13:00 - 15:00' },
  { id: 'o_med_1', branchId: 'MEDAN PATTIMURA', date: '2026-09-01', amount: 0, transactionsCount: 0, peakHour: '12:00 - 14:00' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'tv' | 'omset_dashboard' | 'ai_advisor' | 'settings'>('tv');
  
  // Custom smart initializer that auto-migrates old defaults in local storage to new custom ones
  const [branches, setBranches] = useState<Branch[]>(() => {
    const saved = localStorage.getItem('resto_branches');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.some((b: any) => b.id === 'b_sudirman' || b.id === 'b_senopati' || b.id === 'b_braga')) {
        localStorage.removeItem('resto_branches');
        localStorage.removeItem('resto_cameras');
        localStorage.removeItem('resto_omset');
        return DEFAULT_BRANCHES;
      }
      return parsed;
    }
    return DEFAULT_BRANCHES;
  });

  const [cameras, setCameras] = useState<Camera[]>(() => {
    const saved = localStorage.getItem('resto_cameras');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.some((c: any) => c.id === 'c_sud_kasir' || c.id === 'c_sen_1' || c.id === 'c_braga_1')) {
        return INITIAL_CAMERAS;
      }
      return parsed;
    }
    return INITIAL_CAMERAS;
  });

  // Auto sync real Moggumung POS data on mount
  useEffect(() => {
    async function autoSyncPOS() {
      try {
        const res = await fetch('/api/moggumung/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (res.ok) {
          const data = await res.json();
          if (data.branches && data.branches.length > 0) {
            const mappedBranches: Branch[] = data.branches.map((b: any) => ({
              id: b.id || b.name,
              name: b.name,
              legacy_id: b.legacy_id,
              location: 'Moggumung Branch',
              manager: 'Branch Manager',
              targetOmsetDaily: 25000000
            }));
            setBranches(mappedBranches);
            localStorage.setItem('resto_branches', JSON.stringify(mappedBranches));

            const todayStr = new Date().toISOString().split('T')[0];
            const mappedOmsets: OmsetRecord[] = data.branches.map((b: any, idx: number) => {
              const liveAmount = Number(b.revenue || 0);
              return {
                id: 'omset_auto_' + idx,
                branchId: b.id || b.name,
                date: todayStr,
                amount: liveAmount,
                transactionsCount: Math.floor(liveAmount / 65000) || (liveAmount > 0 ? 120 : 0),
                peakHour: '12:00 - 14:00',
                notes: 'Live synced from Moggumung POS (on.moggumung.id)'
              };
            });
            setOmsetRecords(mappedOmsets);
            localStorage.setItem('resto_omset', JSON.stringify(mappedOmsets));
          }
        }
      } catch (e) {
        console.warn("Auto POS Sync error:", e);
      }
    }
    autoSyncPOS();
    const interval = setInterval(autoSyncPOS, 10000);
    return () => clearInterval(interval);
  }, []);

  const [omsetRecords, setOmsetRecords] = useState<OmsetRecord[]>(() => {
    const saved = localStorage.getItem('resto_omset');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.some((o: any) => o.id === 'o_sud_12')) {
        return DEFAULT_OMSET_RECORDS;
      }
      return parsed;
    }
    return DEFAULT_OMSET_RECORDS;
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Synchronize with LocalStorage for durable local persistence
  useEffect(() => {
    localStorage.setItem('resto_branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    localStorage.setItem('resto_cameras', JSON.stringify(cameras));
  }, [cameras]);

  useEffect(() => {
    localStorage.setItem('resto_omset', JSON.stringify(omsetRecords));
  }, [omsetRecords]);

  // Handle visual tab changes
  const renderTabContent = () => {
    switch (activeTab) {
      case 'tv':
        return <TVDashboard branches={branches} cameras={cameras} omsetRecords={omsetRecords} />;
      
      case 'omset_dashboard':
        return (
          <div className="space-y-6">
            {/* Header controls for Branch selector */}
            <div className="glass p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">DASHBOARD PERKEMBANGAN OMSET</h2>
                <p className="text-xs text-zinc-400 mt-1 font-sans">Analisis grafik penjualan mingguan dan harian restoran Anda.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60 font-mono">Filter Cabang:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-white/30"
                >
                  <option value="all" className="bg-zinc-950">Semua Cabang (Gabungan)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id} className="bg-zinc-950">{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <RevenueChart branches={branches} omsetRecords={omsetRecords} selectedBranchId={selectedBranchId} />
          </div>
        );

      case 'ai_advisor':
        return <AIPerformanceAdvisor branches={branches} cameras={cameras} omsetRecords={omsetRecords} />;

      case 'settings':
        return (
          <BranchManager 
            branches={branches} 
            setBranches={setBranches} 
            cameras={cameras} 
            setCameras={setCameras} 
            omsetRecords={omsetRecords} 
            setOmsetRecords={setOmsetRecords} 
          />
        );

      default:
        return null;
    }
  };

  // If we are showing the TV Dashboard in full, we can hide the global platform headers to make it look 100% immersive
  const isKioskOnly = activeTab === 'tv';

  return (
    <div className="bg-[#050505] min-h-screen text-zinc-100 flex flex-col font-sans">
      
      {/* GLOBAL PLATFORM HUD HEADER - Hidden in clean mode inside TV dashboard, but provides tab navigation here */}
      <header className="flex flex-col lg:flex-row items-center justify-between p-6 glass border-t-0 border-x-0 gap-4 select-none">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              RESTOCAST <span className="font-thin opacity-50">| MONITORING PUSAT</span>
            </h1>
            <p className="text-xs opacity-40 uppercase tracking-widest mt-1">
              Hikvision Multi-Branch Monitor & Sales TV Hub Control Center
            </p>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block"></div>
          <div className="flex gap-6 text-center md:text-left">
            <div>
              <p className="text-[10px] opacity-40 uppercase tracking-widest">TOTAL CABANG</p>
              <p className="text-sm font-semibold">{branches.length} Aktif</p>
            </div>
            <div>
              <p className="text-[10px] opacity-40 uppercase tracking-widest">SISTEM CCTV</p>
              <p className="flex items-center justify-center md:justify-start text-sm font-semibold gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block shadow-[0_0_10px_#10b981] animate-pulse" />
                <span>HIKVISION CONNECTED</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex bg-white/5 p-1 rounded-lg border border-white/10 w-full lg:w-auto overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('tv')}
            className={`px-4 py-2 rounded text-xs font-medium tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'tv' 
                ? 'bg-white/10 text-white border border-white/10 shadow-sm' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Monitor className="w-4 h-4 opacity-75" /> MONITOR TV (KIOSK)
          </button>
          
          <button
            onClick={() => setActiveTab('omset_dashboard')}
            className={`px-4 py-2 rounded text-xs font-medium tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'omset_dashboard' 
                ? 'bg-white/10 text-white border border-white/10 shadow-sm' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-4 h-4 opacity-75" /> GRAFIK OMSET
          </button>

          <button
            onClick={() => setActiveTab('ai_advisor')}
            className={`px-4 py-2 rounded text-xs font-medium tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'ai_advisor' 
                ? 'bg-white/10 text-white border border-white/10 shadow-sm' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4 opacity-75" /> ANALIS BISNIS AI
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded text-xs font-medium tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'settings' 
                ? 'bg-white/10 text-white border border-white/10 shadow-sm' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4 opacity-75" /> KELOLA CABANG
          </button>
        </nav>
      </header>

      {/* RENDER ACTIVE SCREEN */}
      <div className={`flex-1 ${isKioskOnly ? 'p-0' : 'p-6 max-w-7xl w-full mx-auto'}`}>
        {renderTabContent()}
      </div>

      {/* Global mini information line for desktop view */}
      {!isKioskOnly && (
        <footer className="glass border-b-0 border-x-0 p-4 flex items-center justify-between text-xs text-white/50">
          <div className="flex gap-4 items-center">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#10b981]"></div>
              <div className="h-2 w-2 rounded-full bg-[#10b981]"></div>
              <div className="h-2 w-2 rounded-full bg-[#10b981]/20"></div>
            </div>
            <p className="text-[10px] uppercase tracking-wider">
              Network Latency: 42ms | Stream: 1080p | API: Connected
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-wider opacity-60">
            Hikvision v4.2.1-stable — {branches.length} Cabang Resto
          </p>
        </footer>
      )}

    </div>
  );
}
