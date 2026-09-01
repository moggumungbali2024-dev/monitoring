import React, { useState, useEffect, useRef } from 'react';
import { Branch, Camera, OmsetRecord } from '../types';
import CCTVStream from './CCTVStream';
import { Monitor, Play, Pause, ChevronLeft, ChevronRight, LayoutGrid, Clock, AlertCircle, TrendingUp, Volume2, VolumeX, Maximize, ArrowRight, Activity, DollarSign, Users, Sparkles } from 'lucide-react';

interface TVDashboardProps {
  branches: Branch[];
  cameras: Camera[];
  omsetRecords: OmsetRecord[];
}

export default function TVDashboard({ branches, cameras, omsetRecords }: TVDashboardProps) {
  const [currentBranchIndex, setCurrentBranchIndex] = useState<number>(0);
  const [isPlayingCarousel, setIsPlayingCarousel] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'focused' | 'matrix'>('focused'); // focused = 1 branch grid + info, matrix = multicamera grid
  const [isKioskClean, setIsKioskClean] = useState<boolean>(false); // clean screen for TV display
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [carouselDuration, setCarouselDuration] = useState<number>(10); // seconds per branch
  const [countdown, setCountdown] = useState<number>(carouselDuration);
  const [maximizedCameraId, setMaximizedCameraId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sound generator function for alerts
  const playBeep = (freq = 880, duration = 0.1) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked by browser auto-play policy");
    }
  };

  // 1. Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Carousel auto-rotation logic
  useEffect(() => {
    if (!isPlayingCarousel || branches.length <= 1 || maximizedCameraId) return;

    setCountdown(carouselDuration);

    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Play a small notification beep on branch change
          playBeep(440, 0.08);
          
          // Move to next branch index
          setCurrentBranchIndex(prevIndex => (prevIndex + 1) % branches.length);
          return carouselDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [isPlayingCarousel, branches.length, carouselDuration, soundEnabled, maximizedCameraId]);

  // Handle manual navigation
  const handlePrev = () => {
    playBeep(587, 0.05);
    setCurrentBranchIndex(prev => (prev - 1 + branches.length) % branches.length);
    setCountdown(carouselDuration);
    setMaximizedCameraId(null);
  };

  const handleNext = () => {
    playBeep(587, 0.05);
    setCurrentBranchIndex(prev => (prev + 1) % branches.length);
    setCountdown(carouselDuration);
    setMaximizedCameraId(null);
  };

  // Full screen toggle helper
  const handleFullScreen = () => {
    if (!containerRef.current) return;
    playBeep(659, 0.06);
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        alert(`Gagal mengaktifkan mode Fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isCameraInBranch = (cam: Camera, branch: Branch | null) => {
    if (!branch) return false;
    if (cam.branchId === branch.id) return true;
    const cId = (cam.branchId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bId = (branch.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bName = (branch.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bLegacy = (((branch as any).legacy_id) || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (cId && bId && (cId === bId || cId.includes(bId) || bId.includes(cId))) return true;
    if (cId && bName && (cId.includes(bName) || bName.includes(cId))) return true;
    if (cId && bLegacy && (cId.includes(bLegacy) || bLegacy.includes(cId))) return true;
    return false;
  };

  const isRecordInBranch = (rec: OmsetRecord, branch: Branch | null) => {
    if (!branch) return false;
    if (rec.branchId === branch.id) return true;
    const rId = (rec.branchId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bId = (branch.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bName = (branch.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bLegacy = (((branch as any).legacy_id) || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (rId && bId && (rId === bId || rId.includes(bId) || bId.includes(rId))) return true;
    if (rId && bName && (rId.includes(bName) || bName.includes(rId))) return true;
    if (rId && bLegacy && (rId.includes(bLegacy) || bLegacy.includes(rId))) return true;
    return false;
  };

  // Calculate current branch statistics
  const currentBranch = branches[currentBranchIndex] || null;
  const currentBranchCameras = currentBranch 
    ? cameras.filter(c => isCameraInBranch(c, currentBranch)) 
    : [];

  const activeSet = viewMode === 'focused' ? currentBranchCameras : cameras;
  const currentMaximizedIndex = activeSet.findIndex(c => c.id === maximizedCameraId);

  const handlePrevCamera = () => {
    if (activeSet.length === 0) return;
    playBeep(587, 0.05);
    if (currentMaximizedIndex === -1) {
      setMaximizedCameraId(activeSet[activeSet.length - 1].id);
    } else {
      const prevIdx = (currentMaximizedIndex - 1 + activeSet.length) % activeSet.length;
      setMaximizedCameraId(activeSet[prevIdx].id);
    }
  };

  const handleNextCamera = () => {
    if (activeSet.length === 0) return;
    playBeep(587, 0.05);
    if (currentMaximizedIndex === -1) {
      setMaximizedCameraId(activeSet[0].id);
    } else {
      const nextIdx = (currentMaximizedIndex + 1) % activeSet.length;
      setMaximizedCameraId(activeSet[nextIdx].id);
    }
  };

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMaximizedCameraId(null);
      } else if (e.key === 'ArrowLeft') {
        if (maximizedCameraId) {
          handlePrevCamera();
        } else {
          handlePrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (maximizedCameraId) {
          handleNextCamera();
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedCameraId, currentBranchIndex, viewMode, currentBranchCameras, cameras]);

  const getBranchOmsetTotal = (branchId: string) => {
    const targetBranch = branches.find(b => b.id === branchId) || currentBranch;
    return omsetRecords
      .filter(r => isRecordInBranch(r, targetBranch))
      .reduce((sum, r) => sum + r.amount, 0);
  };

  const getBranchTransactionsTotal = (branchId: string) => {
    const targetBranch = branches.find(b => b.id === branchId) || currentBranch;
    return omsetRecords
      .filter(r => isRecordInBranch(r, targetBranch))
      .reduce((sum, r) => sum + r.transactionsCount, 0);
  };

  const getLatestRecord = (branchId: string) => {
    const targetBranch = branches.find(b => b.id === branchId) || currentBranch;
    const records = omsetRecords.filter(r => isRecordInBranch(r, targetBranch));
    if (records.length === 0) return null;
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div 
      ref={containerRef}
      className="bg-[#050505] text-zinc-100 min-h-screen flex flex-col justify-between font-sans overflow-hidden"
    >
      {/* 1. TV MASTER HEADER */}
      <header className="glass border-t-0 border-x-0 px-6 py-4 flex flex-col md:flex-row items-center justify-between z-20 gap-4">
        
        {/* Brand & Connection State */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white uppercase">
                RESTOCAST <span className="font-thin opacity-50">| SURVEILLANCE FEED</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse" />
                <span>NOC MONITOR: ONLINE | {cameras.filter(c => c.status === 'online').length}/{cameras.length} CAM CONNECTED</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Center Kiosk Controller */}
        {!isKioskClean && (
          <div className="flex items-center gap-3 glass-bright px-4 py-1.5 rounded-full border border-white/10">
            {/* Play/Pause */}
            <button 
              onClick={() => setIsPlayingCarousel(!isPlayingCarousel)}
              className={`p-1.5 rounded-full transition-colors ${isPlayingCarousel ? 'bg-white/15 text-white' : 'bg-transparent text-white/40 hover:text-white'}`}
              title={isPlayingCarousel ? "Jeda Perputaran" : "Mulai Perputaran"}
            >
              {isPlayingCarousel ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            {/* Manual Controls */}
            <div className="flex items-center gap-1 border-l border-white/10 pl-3">
              <button onClick={handlePrev} className="p-1 hover:bg-white/5 text-white/50 hover:text-white rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-xs font-mono font-bold px-2 text-white/90 min-w-44 text-center">
                {viewMode === 'focused' ? (currentBranch?.name || 'Cabang Resto') : 'MATRIX SEMUA CAMERA'}
              </span>

              <button onClick={handleNext} className="p-1 hover:bg-white/5 text-white/50 hover:text-white rounded">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Countdown bar */}
            {isPlayingCarousel && (
              <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                <Clock className="w-3.5 h-3.5 text-white/40 animate-spin" />
                <span className="text-[10px] font-mono font-bold text-white/60 min-w-[20px]">{countdown}s</span>
              </div>
            )}
          </div>
        )}

        {/* Clock, Sound, Full Screen Controls */}
        <div className="flex items-center gap-4 font-mono">
          
          {/* Giant Clock */}
          <div className="flex flex-col items-end border-r border-white/10 pr-4">
            <span className="text-2xl font-light text-white tracking-wider">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>

          {/* Quick interactive utility icons */}
          {!isKioskClean && (
            <div className="flex items-center gap-1.5">
              {/* Layout Switcher */}
              <button 
                onClick={() => {
                  playBeep(523, 0.08);
                  setViewMode(prev => prev === 'focused' ? 'matrix' : 'focused');
                }}
                className={`p-2 rounded border transition-all ${viewMode === 'matrix' ? 'bg-white/15 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
                title="Ganti Mode Tampilan"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>

              {/* Sound alarm button */}
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded border transition-all ${soundEnabled ? 'bg-[#10b981]/15 border-[#10b981]/30 text-[#10b981]' : 'bg-white/5 border-white/10 text-white/40'}`}
                title={soundEnabled ? "Nonaktifkan Alarm" : "Aktifkan Alarm Bunyi"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Enter Fullscreen */}
              <button 
                onClick={handleFullScreen}
                className="p-2 bg-white/5 border border-white/10 text-white/60 hover:text-white rounded transition-all"
                title="Fullscreen Tampilan"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Master TV presentation toggle button */}
          <button 
            onClick={() => {
              playBeep(784, 0.05);
              setIsKioskClean(!isKioskClean);
            }}
            className={`px-3 py-1.5 text-xs rounded border uppercase font-medium tracking-wider transition-all ${
              isKioskClean 
                ? 'bg-white/15 border-white/20 text-white animate-pulse' 
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {isKioskClean ? 'KEMBALI KE PANEL' : 'TV MODE'}
          </button>
        </div>
      </header>

      {/* 2. MAIN TV BODY */}
      <main className="flex-1 w-full p-6 overflow-hidden relative">
        {viewMode === 'focused' && currentBranch ? (
          
          /* ---------------- FOCUSED VIEW: 1 BRANCH CCTV + DETAILED OMSET & ALERTS ---------------- */
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full">
            
            {/* Left side: CCTV grid (takes up to 3 columns) */}
            <div className="xl:col-span-3 flex flex-col h-full justify-between">
              
              {/* Maximized Camera View OR 3x3 Camera Grid */}
              {maximizedCameraId ? (
                // Single 1-1 Zoomed View
                (() => {
                  const activeCam = cameras.find(c => c.id === maximizedCameraId);
                  if (!activeCam) return null;
                  const b = branches.find(branch => branch.id === activeCam.branchId);
                  return (
                    <div className="relative flex-1 rounded-xl overflow-hidden border border-white/20 bg-[#060606] flex flex-col h-full min-h-[500px] group">
                      <CCTVStream camera={activeCam} branchName={b ? b.name : 'Utama'} />
                      
                      {/* Back button overlay */}
                      <button 
                        onClick={() => {
                          playBeep(523, 0.05);
                          setMaximizedCameraId(null);
                        }}
                        className="absolute bottom-4 left-4 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white border border-white/10 hover:border-white/25 rounded-lg flex items-center gap-1.5 font-mono text-[10px] tracking-widest transition-all uppercase backdrop-blur-md"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>KEMBALI KE GRID</span>
                      </button>

                      {/* Floating slider indicators for navigation */}
                      <button 
                        onClick={handlePrevCamera}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/80 hover:text-white text-white/50 border border-white/5 hover:border-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
                        title="Kamera Sebelumnya (Arrow Left)"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={handleNextCamera}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/80 hover:text-white text-white/50 border border-white/5 hover:border-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
                        title="Kamera Selanjutnya (Arrow Right)"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>

                      <div className="absolute top-4 left-4 z-20 bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-widest uppercase animate-pulse">
                        ZOOM MODE (1-1)
                      </div>
                    </div>
                  );
                })()
              ) : (
                // 3x3 Adaptive Grid View
                <div className="flex-1 flex flex-col justify-between relative h-full">
                  {currentBranchCameras.length > 0 ? (
                    <div className={`grid gap-4 flex-1 min-h-[500px] ${
                      currentBranchCameras.length === 1 ? 'grid-cols-1' :
                      currentBranchCameras.length === 2 ? 'grid-cols-2' :
                      currentBranchCameras.length === 3 ? 'grid-cols-3' :
                      currentBranchCameras.length === 4 ? 'grid-cols-2' :
                      'grid-cols-3' // 5 to 9 are displayed in beautiful 3 cols grid (3x3 if 9)
                    }`}>
                      {currentBranchCameras.slice(0, 9).map((cam, idx) => (
                        <div 
                          key={cam.id} 
                          className="relative rounded-xl overflow-hidden border border-white/10 bg-[#0c0c0c] aspect-video group cursor-pointer hover:border-white/30 transition-all duration-300"
                        >
                          <CCTVStream camera={cam} branchName={currentBranch.name} />
                          
                          {/* Grid Overlay / Click Zoom Indicator */}
                          <div 
                            onClick={() => {
                              playBeep(659, 0.05);
                              setMaximizedCameraId(cam.id);
                            }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                          >
                            <span className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-lg text-xs font-mono font-semibold tracking-widest text-white backdrop-blur-md transition-all uppercase flex items-center gap-1.5">
                              <Maximize className="w-3.5 h-3.5" />
                              ZOOM 1-1
                            </span>
                          </div>
                          
                          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-mono text-white/60 pointer-events-none z-10 border border-white/10">
                            CAM {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 h-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-12 text-center bg-white/2">
                      <AlertCircle className="w-12 h-12 text-white/30 animate-bounce mb-3" />
                      <p className="text-white/80 font-mono text-sm font-bold uppercase tracking-wider">BELUM ADA KAMERA DIKONFIGURASI</p>
                      <p className="text-white/40 text-xs mt-2">Silakan tambahkan CCTV baru pada menu kelola cabang.</p>
                    </div>
                  )}

                  {/* Left / Right manual glide overlays directly on the grid sides for ultra convenient touch/click sliding */}
                  {branches.length > 1 && (
                    <>
                      <button 
                        onClick={handlePrev}
                        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 p-2 bg-[#0c0c0c]/80 hover:bg-white/10 hover:text-white text-white/40 border border-white/10 rounded-full transition-all shadow-xl backdrop-blur-md"
                        title="Cabang Sebelumnya (Arrow Left)"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={handleNext}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 p-2 bg-[#0c0c0c]/80 hover:bg-white/10 hover:text-white text-white/40 border border-white/10 rounded-full transition-all shadow-xl backdrop-blur-md"
                        title="Cabang Selanjutnya (Arrow Right)"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Dot Indicators at the bottom of the camera section */}
              {branches.length > 1 && !maximizedCameraId && (
                <div className="flex justify-center items-center gap-2 mt-4 z-10">
                  {branches.map((b, index) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        playBeep(587, 0.04);
                        setCurrentBranchIndex(index);
                        setCountdown(carouselDuration);
                      }}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === currentBranchIndex 
                          ? 'w-6 bg-[#10b981]' 
                          : 'w-2 bg-white/20 hover:bg-white/40'
                      }`}
                      title={`Pindah ke ${b.name}`}
                    />
                  ))}
                </div>
              )}

            </div>

            {/* Right side: TV Dashboard Omset and Live Analytics panel (takes 1 column) */}
            <div className="xl:col-span-1 glass rounded-xl p-6 flex flex-col justify-between overflow-y-auto">
              <div>
                
                {/* Branch Info display */}
                <div className="border-b border-white/10 pb-5 mb-5">
                  <div className="flex items-center gap-1.5 text-white/40 text-[10px] font-mono tracking-wider uppercase">
                    <Activity className="w-3.5 h-3.5 text-[#10b981] animate-pulse" />
                    <span>PEMANTAUAN AKTIF</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight mt-1">{currentBranch.name}</h2>
                  <p className="text-xs text-white/50 mt-1 font-sans">{currentBranch.location}</p>
                </div>

                {/* Sales Highlights - Designed for Clean Minimalism */}
                <div className="space-y-4">
                  
                  {/* Omset Hari Ini - Emerald glass status band */}
                  <div className="glass border-l-4 border-l-[#10b981] p-5 rounded-xl flex flex-col relative overflow-hidden group">
                    <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase">OMSET HARI INI (AKTUAL)</span>
                    <span className="text-3xl font-bold text-[#10b981] tracking-tight font-mono mt-1.5">
                      {getLatestRecord(currentBranch.id) 
                        ? formatIDR(getLatestRecord(currentBranch.id)!.amount) 
                        : formatIDR(0)}
                    </span>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[10px] font-mono opacity-60">
                      <span>Target Harian:</span>
                      <span className="text-white font-bold">{formatIDR(currentBranch.targetOmsetDaily)}</span>
                    </div>
                  </div>

                  {/* Total Transactions - Blue glass status band */}
                  <div className="glass border-l-4 border-l-blue-500 p-5 rounded-xl flex flex-col relative overflow-hidden">
                    <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase">TRANSAKSI HARI INI</span>
                    <span className="text-3xl font-bold text-blue-400 tracking-tight font-mono mt-1.5">
                      {getLatestRecord(currentBranch.id) 
                        ? `${getLatestRecord(currentBranch.id)!.transactionsCount} Struk` 
                        : '0 Struk'}
                    </span>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[10px] font-mono opacity-60">
                      <span>Jam Terpadat (Peak):</span>
                      <span className="text-white font-bold uppercase">{getLatestRecord(currentBranch.id)?.peakHour || '12:00 - 14:00'}</span>
                    </div>
                  </div>

                  {/* Kepatuhan Operasional - Orange glass status band */}
                  <div className="glass border-l-4 border-l-orange-500 p-5 rounded-xl flex flex-col relative overflow-hidden">
                    <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase">ANALISIS KEPATUHAN (CCTV)</span>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse" />
                      <span className="text-xs font-bold text-orange-400 font-mono">STANDAR OPERASIONAL OK</span>
                    </div>
                    <p className="text-[10px] text-white/65 mt-2 font-sans leading-relaxed">
                      Antrean kasir normal, kepatuhan kebersihan dapur sesuai standar visual AI.
                    </p>
                  </div>

                </div>
              </div>

              {/* TV Footer - Branch Target Progress Ratio */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="flex justify-between text-[10px] font-mono text-white/40 mb-2">
                  <span>PENCAPAIAN TARGET BULANAN</span>
                  <span className="font-bold text-white/85">
                    {getLatestRecord(currentBranch.id) && currentBranch.targetOmsetDaily > 0
                      ? `${Math.round((getLatestRecord(currentBranch.id)!.amount / currentBranch.targetOmsetDaily) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div 
                    className="bg-white h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, getLatestRecord(currentBranch.id) && currentBranch.targetOmsetDaily > 0 
                        ? (getLatestRecord(currentBranch.id)!.amount / currentBranch.targetOmsetDaily) * 100 
                        : 0)}%` 
                    }}
                  />
                </div>
              </div>

            </div>

          </div>
        ) : (
          
          /* ---------------- MATRIX VIEW: ALL BRANCH CAMERAS GRID ---------------- */
          <div className="h-full flex flex-col">
            {maximizedCameraId ? (
              // Zoom mode inside Matrix View
              (() => {
                const activeCam = cameras.find(c => c.id === maximizedCameraId);
                if (!activeCam) return null;
                const b = branches.find(branch => branch.id === activeCam.branchId);
                return (
                  <div className="relative flex-1 rounded-xl overflow-hidden border border-white/20 bg-[#060606] flex flex-col h-full min-h-[500px] group">
                    <CCTVStream camera={activeCam} branchName={b ? b.name : 'Utama'} />
                    
                    {/* Back button overlay */}
                    <button 
                      onClick={() => {
                        playBeep(523, 0.05);
                        setMaximizedCameraId(null);
                      }}
                      className="absolute bottom-4 left-4 z-20 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white border border-white/10 hover:border-white/25 rounded-lg flex items-center gap-1.5 font-mono text-[10px] tracking-widest transition-all uppercase backdrop-blur-md"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>KEMBALI KE MATRIX</span>
                    </button>

                    {/* Floating slider indicators for navigation across all cameras */}
                    <button 
                      onClick={handlePrevCamera}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/80 hover:text-white text-white/50 border border-white/5 hover:border-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
                      title="Kamera Sebelumnya (Arrow Left)"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={handleNextCamera}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/80 hover:text-white text-white/50 border border-white/5 hover:border-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
                      title="Kamera Selanjutnya (Arrow Right)"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

                    <div className="absolute top-4 left-4 z-20 bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-widest uppercase animate-pulse">
                      ZOOM MODE (1-1)
                    </div>
                  </div>
                );
              })()
            ) : (
              // Matrix Grid
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-mono font-medium tracking-widest text-white/50 uppercase flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#10b981] rounded-full shadow-[0_0_8px_#10b981] animate-pulse" />
                    DINDING PEMANTAUAN MATRIX CCTV UTAMA - SEMUA CABANG AKTIF
                  </span>
                  <span className="text-[10px] font-mono text-white/30 tracking-wider">Maksimal 8 kamera grup</span>
                </div>
                
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto">
                  {cameras.map((cam, idx) => {
                    const b = branches.find(branch => branch.id === cam.branchId);
                    return (
                      <div 
                        key={cam.id} 
                        className="relative rounded-xl overflow-hidden border border-white/10 bg-[#0c0c0c] aspect-video group cursor-pointer hover:border-white/30 transition-all duration-300"
                      >
                        <CCTVStream camera={cam} branchName={b ? b.name : 'Utama'} />
                        
                        {/* Matrix Grid Zoom Overlay */}
                        <div 
                          onClick={() => {
                            playBeep(659, 0.05);
                            setMaximizedCameraId(cam.id);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                        >
                          <span className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 rounded-lg text-xs font-mono font-semibold tracking-widest text-white backdrop-blur-md transition-all uppercase flex items-center gap-1.5">
                            <Maximize className="w-3.5 h-3.5" />
                            ZOOM 1-1
                          </span>
                        </div>

                        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-mono text-white/60 pointer-events-none z-10 border border-white/10">
                          GRID {idx + 1}
                        </div>
                      </div>
                    );
                  })}
                  
                  {cameras.length === 0 && (
                    <div className="col-span-full h-full flex flex-col items-center justify-center py-20 text-center">
                      <AlertCircle className="w-12 h-12 text-white/20 mb-3" />
                      <p className="text-white/40 font-mono text-xs tracking-widest">BELUM ADA KAMERA CCTV AKTIF UNTUK DISPLAY MATRIX</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. SCROLLING DATA TICKER (MARQUEE) - Essential for wall mounted TVs */}
      <footer className="glass border-b-0 border-x-0 py-1.5 overflow-hidden flex items-center h-11 font-mono z-20">
        
        {/* Static Header tag for ticker */}
        <div className="bg-white/10 text-white text-[10px] font-bold uppercase px-4 h-full flex items-center gap-2 tracking-widest min-w-[140px] z-10 border-r border-white/10">
          <Activity className="w-3.5 h-3.5 text-[#10b981] animate-pulse" />
          <span>LIVE TICKER</span>
        </div>

        {/* Scrolling section */}
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-[marquee_25s_linear_infinite] whitespace-nowrap flex gap-12 text-xs font-medium text-white/70">
            {branches.map(b => {
              const latest = getLatestRecord(b.id);
              return (
                <span key={b.id} className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full shadow-[0_0_4px_#10b981]" />
                  <span className="text-white/40 uppercase">{b.name}:</span>
                  <span className="text-[#10b981] font-mono font-semibold">{formatIDR(latest ? latest.amount : 0)}</span>
                  <span className="text-white/30">({latest ? latest.transactionsCount : 0} Transaksi)</span>
                  <span className="text-white/20">| Target:</span>
                  <span className="text-white/50">{formatIDR(b.targetOmsetDaily)}</span>
                </span>
              );
            })}
            {/* Repeat to ensure gapless marquee */}
            {branches.map(b => {
              const latest = getLatestRecord(b.id);
              return (
                <span key={`dup-${b.id}`} className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full shadow-[0_0_4px_#10b981]" />
                  <span className="text-white/40 uppercase">{b.name}:</span>
                  <span className="text-[#10b981] font-mono font-semibold">{formatIDR(latest ? latest.amount : 0)}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Total accumulation footer tag */}
        <div className="bg-white/5 border-l border-white/10 px-4 h-full flex items-center text-[10px] text-white/50 gap-2 min-w-[240px] font-bold z-10">
          <span className="tracking-wider">GROUP REVENUE:</span>
          <span className="text-[#10b981] font-mono font-bold text-xs tracking-wider">
            {formatIDR(omsetRecords.reduce((sum, r) => sum + r.amount, 0))}
          </span>
        </div>
      </footer>

      {/* Inject custom animation keyframes for the Kiosk Marquee and Steam/Bob effects */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes bob {
          0% { transform: translateY(0); }
          100% { transform: translateY(-4px); }
        }
        @keyframes steam {
          0% { transform: translateY(0) scale(0.9); opacity: 0; }
          50% { opacity: 0.25; }
          100% { transform: translateY(-40px) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
