import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraLocationType } from '../types';
import { Play, Square, Shield, Radio, ZoomIn, ZoomOut, Maximize2, MoveUp, MoveDown, MoveLeft, MoveRight } from 'lucide-react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { detectStreamKind, resolveStreamUrlForPlayback } from './streamUtils';

interface CCTVStreamProps {
  camera: Camera;
  branchName: string;
  isFocused?: boolean;
}

export default function CCTVStream({ camera, branchName, isFocused = false }: CCTVStreamProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [bitrate, setBitrate] = useState<number>(1800);
  const [fps, setFps] = useState<number>(25);
  const [ptzX, setPtzX] = useState<number>(0);
  const [ptzY, setPtzY] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [hasStreamError, setStreamError] = useState<boolean>(false);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'active'>('connecting');
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [isVideoActive, setIsVideoActive] = useState<boolean>(false);
  
  const [liveStreamUrl, setLiveStreamUrl] = useState<string | null>(null);
  const [fallbackStreamUrl, setFallbackStreamUrl] = useState<string | null>(null);
  const [activeUrlOverride, setActiveUrlOverride] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const fetchAttemptedRef = useRef<boolean>(false);

  // Robust stream initialization lifecycle simulation
  useEffect(() => {
    if (!isPlaying) return;
    setStreamStatus('connecting');
    const timer = setTimeout(() => {
      setStreamStatus('active');
    }, 600);
    return () => clearTimeout(timer);
  }, [isPlaying, camera.id]);

  const handleReconnect = () => {
    setStreamStatus('connecting');
    setActiveUrlOverride(null);
    fetchAttemptedRef.current = false;
    setFetchError(null);
    setStreamError(false);
    setIsVideoActive(false);
    setTimeout(() => {
      setStreamStatus('active');
    }, 600);
  };
  const getDefaultThumb = () => {
    if (camera.hikThumbnailUrl) return camera.hikThumbnailUrl;
    switch (camera.locationType) {
      case 'cashier':
        return 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80';
      case 'kitchen':
        return 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80';
      case 'dining':
        return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';
      default:
        return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';
    }
  };

  const [currentThumbUrl, setCurrentThumbUrl] = useState<string | null>(getDefaultThumb());

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const flvPlayerRef = useRef<any>(null);
  const ezPlayerRef = useRef<any>(null);

  const isVideoActiveRef = useRef(isVideoActive);
  useEffect(() => {
    isVideoActiveRef.current = isVideoActive;
  }, [isVideoActive]);

  // Poll fresh thumbnail snapshots for HikConnect Teams cameras only when video stream is offline
  useEffect(() => {
    if (camera.type !== 'HikConnect Teams' || !isPlaying) return;

    const fetchFreshThumb = async () => {
      // If live video is already streaming smoothly, skip thumbnail polling to prevent network congestion
      if (isVideoActiveRef.current) return;

      try {
        const token = localStorage.getItem('hik_access_token');
        const serverAddress = localStorage.getItem('hik_server_address');
        if (!token || !serverAddress) {
          setFetchError('HIKVISION API Token or Server URL is not configured. Please go to Settings to connect.');
          setIsLoadingStream(false);
          return;
        }
        if (!camera.hikCameraId) {
          setFetchError('Camera ID missing');
          setIsLoadingStream(false);
          return;
        }

        const res = await fetch('/api/hik/thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverAddress,
            token,
            cameraId: camera.hikCameraId,
            deviceSerial: camera.hikDeviceSerial,
            channelNo: camera.channel,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data?.pictureURL) {
            const freshUrl = data.data.pictureURL + (data.data.pictureURL.includes('?') ? '&' : '?') + 't=' + Date.now();
            setCurrentThumbUrl(freshUrl);
          }
        }
      } catch (e) {
        // Ignore background poll errors
      }
    };

    const interval = setInterval(fetchFreshThumb, 6000);
    return () => clearInterval(interval);
  }, [camera.type, camera.hikCameraId, isPlaying]);

  useEffect(() => {
    fetchAttemptedRef.current = false;
  }, [camera.id, camera.hikCameraId]);

  // Fetch real-time video stream for HikConnect Teams cameras
  useEffect(() => {
    if (camera.type !== 'HikConnect Teams' || !isPlaying) return;
    if (fetchAttemptedRef.current) return;

    const token = localStorage.getItem('hik_access_token');
    const serverAddress = localStorage.getItem('hik_server_address');
    if (!token || !serverAddress) {
      // Hikvision credentials not configured in settings, use simulated live feed without throwing error
      setFetchError(null);
      setIsLoadingStream(false);
      return;
    }
    if (!camera.hikCameraId) {
      setIsLoadingStream(false);
      return;
    }

    fetchAttemptedRef.current = true;
    const fetchLiveStream = async () => {
      setIsLoadingStream(true);
      try {
        const res = await fetch('/api/hik/live-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverAddress,
            token,
            cameraId: camera.hikCameraId,
            deviceSerial: camera.hikDeviceSerial,
            channelNo: camera.channel,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          console.log("HikConnect Stream Response:", data);
          const isSuccess = data.errorCode === '0' || data.code === '200' || data.code === 200 || data.code === '0' || data.code === 0;
          if ((isSuccess || data.data?.url) && data.data?.url) {
            const streamUrl = data.data.url;
            const hlsUrl = data.data.hlsUrl;
            const flvUrl = data.data.flvUrl;
            const authToken = localStorage.getItem('hik_access_token') || '';
            const origin = typeof window !== 'undefined' ? window.location.origin : '';

            const proxiedUrl = streamUrl.startsWith('ezopen://')
              ? streamUrl
              : `${origin}/api/hik/proxy-stream?url=${encodeURIComponent(streamUrl)}&token=${encodeURIComponent(authToken)}`;
            
            setLiveStreamUrl(proxiedUrl);

            if (hlsUrl && hlsUrl !== streamUrl) {
              const proxiedHls = hlsUrl.startsWith('ezopen://') ? hlsUrl : `${origin}/api/hik/proxy-stream?url=${encodeURIComponent(hlsUrl)}&token=${encodeURIComponent(authToken)}`;
              setFallbackStreamUrl(proxiedHls);
            } else if (flvUrl && flvUrl !== streamUrl) {
              const proxiedFlv = flvUrl.startsWith('ezopen://') ? flvUrl : `${origin}/api/hik/proxy-stream?url=${encodeURIComponent(flvUrl)}&token=${encodeURIComponent(authToken)}`;
              setFallbackStreamUrl(proxiedFlv);
            }

            setFetchError(null);
            return;
          }

          setFetchError(data.errorMsg || data.msg || 'API Error');
        } else {
          const errData = await res.json().catch(() => ({}));
          setFetchError(errData.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        console.warn("Failed to retrieve live stream URL from HikConnect", e);
        setFetchError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setIsLoadingStream(false);
      }
    };

    fetchLiveStream();
  }, [camera.type, camera.hikCameraId, camera.id, isPlaying]);

  const activeStreamUrl = activeUrlOverride || liveStreamUrl || (camera.streamUrl && !camera.streamUrl.includes('stream-placeholder') ? camera.streamUrl : null);

  // Load and play HLS or direct media stream if streamUrl is present
  useEffect(() => {
    const video = videoRef.current;
    let syncInterval: any = null;

    // Cleanup helper
    const destroyPlayers = () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (flvPlayerRef.current) {
        try { flvPlayerRef.current.destroy(); } catch(e) {}
        flvPlayerRef.current = null;
      }
      if (ezPlayerRef.current) {
        try { ezPlayerRef.current.stop(); } catch(e) {}
        ezPlayerRef.current = null;
      }
    };

    if (!video || !activeStreamUrl || !isPlaying) {
      destroyPlayers();
      return;
    }

    setStreamError(false);
    setIsUsingFallback(false);
    destroyPlayers();

    let rawStreamUrl = activeStreamUrl;
    if (activeStreamUrl.includes('/api/hik/proxy-stream')) {
      try {
        const qIdx = activeStreamUrl.indexOf('?');
        if (qIdx !== -1) {
          const urlParam = activeStreamUrl.substring(qIdx + 1).split('&').find(p => p.startsWith('url='));
          if (urlParam) rawStreamUrl = decodeURIComponent(urlParam.substring(4));
        }
      } catch(e) {}
    }

    console.log('[CCTVStream] rawStreamUrl:', rawStreamUrl);

    const isEzOpen = rawStreamUrl.startsWith('ezopen://');
    const isExplicitHls = rawStreamUrl.includes('.m3u8') || rawStreamUrl.includes('mpegurl') || rawStreamUrl.includes('/hls');
    const isExplicitMp4 = rawStreamUrl.endsWith('.mp4') || rawStreamUrl.includes('stream-placeholder');
    // For Hikvision / HikCentral Connect / VTMS streams:
    // If not ezopen, not HLS and not static MP4, treat live stream as FLV (compatible with mpegts.js)
    const isFlv = !isEzOpen && !isExplicitHls && !isExplicitMp4;
    const isHls = !isEzOpen && isExplicitHls;

    console.log('[CCTVStream] isEzOpen:', isEzOpen, 'isFlv:', isFlv, 'isHls:', isHls);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const playbackUrl = activeStreamUrl.startsWith('/') ? `${origin}${activeStreamUrl}` : activeStreamUrl;

    if (isEzOpen) {
      const containerId = `ezuikit-container-${camera.id}`;
      const token = localStorage.getItem('hik_access_token') || '';
      import('ezuikit-js').then(({ default: EZUIKit }) => {
        try {
          const ezPlayer = new (EZUIKit as any).EZUIKitPlayer({
            id: containerId,
            accessToken: token,
            url: rawStreamUrl,
            width: '100%',
            height: '100%',
          });
          ezPlayerRef.current = ezPlayer;
          setIsVideoActive(true);
          setStreamError(false);
        } catch (err: any) {
          console.error('[CCTVStream] EZUIKit player error:', err);
        }
      }).catch(err => {
        console.error('[CCTVStream] Failed to dynamically load EZUIKit:', err);
      });
    } else if (isFlv) {
      // Use mpegts.js for FLV live streams
      try {
        const features = mpegts.getFeatureList();
        console.log('[CCTVStream] mpegts features:', features);

        if (features.mseLivePlayback) {
          const player = mpegts.createPlayer({
            type: 'flv',
            isLive: true,
            url: playbackUrl,
            cors: true,
            withCredentials: false,
          }, {
            enableWorker: false,
            enableStashBuffer: true,
            stashInitialSize: 256,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 3.0,
            liveBufferLatencyMinRemain: 0.5,
            lazyLoad: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 10,
            autoCleanupMinBackwardDuration: 5,
          });

          flvPlayerRef.current = player;

          player.on(mpegts.Events.MEDIA_INFO, (info: any) => {
            console.log('[CCTVStream] mpegts MEDIA_INFO:', info);
            setStreamError(false);
            setIsVideoActive(true);
          });

          player.on(mpegts.Events.ERROR, (errType: any, errDetail: any) => {
            console.error('[CCTVStream] mpegts ERROR:', errType, errDetail);

            if (fallbackStreamUrl && activeStreamUrl !== fallbackStreamUrl) {
              console.warn('[CCTVStream] FLV stream error, attempting fallback stream:', fallbackStreamUrl);
              setActiveUrlOverride(fallbackStreamUrl);
              setFetchError(null);
              return;
            }

            if (!video.currentTime || video.paused) {
              setFetchError(`Stream offline: ${errDetail?.msg || errType || 'Format stream tidak didukung'}`);
              setStreamError(true);
              setIsVideoActive(false);
              destroyPlayers();
            }
          });

          player.on(mpegts.Events.STATISTICS_INFO, (info: any) => {
            if (info.speed > 0 || info.currentJitter > 0) {
              setStreamError(false);
              setIsVideoActive(true);
            }
          });

          player.attachMediaElement(video);
          player.load();

          video.play().catch((e) => {
            console.warn('[CCTVStream] autoplay blocked:', e);
          });

          syncInterval = setInterval(() => {
            if (video && !video.paused && video.buffered.length > 0) {
              const end = video.buffered.end(video.buffered.length - 1);
              const lag = end - video.currentTime;
              if (lag > 5.0) {
                console.log('[CCTVStream] lag sync:', lag.toFixed(1) + 's, seeking to', end - 0.5);
                video.currentTime = end - 0.5;
              }
            }
          }, 2000);

        } else {
          console.warn('[CCTVStream] MSE not supported, falling through to hls');
          setFetchError('MSE not supported for FLV in this browser');
          setStreamError(true);
        }
      } catch (e: any) {
        console.error('[CCTVStream] mpegts init error:', e);
        setFetchError('Player init error: ' + e.message);
        setStreamError(true);
      }

    } else if (isHls) {
      // Use hls.js for HLS streams
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playbackUrl;
        video.load();
        video.play().catch(() => undefined);
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          maxMaxBufferLength: 15,
          liveSyncDuration: 3,
          liveMaxLatencyDuration: 10,
          enableWorker: true,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => undefined);
          setIsVideoActive(true);
        });
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          console.error('[CCTVStream] HLS error:', data);
          if (data.fatal) {
            setFetchError(`HLS stream offline (${data.details || data.type})`);
            setStreamError(true);
            setIsVideoActive(false);
            hls.destroy();
            hlsInstanceRef.current = null;
          }
        });
      } else {
        setFetchError('HLS not supported in this browser');
        setStreamError(true);
        setIsVideoActive(false);
      }
    } else {
      // Direct media URL
      video.src = playbackUrl;
      video.load();
      video.play().catch(() => undefined);
    }

    video.onerror = (e) => {
      console.error('[CCTVStream] video element error:', e);
      setStreamError(true);
      setIsVideoActive(false);
    };

    if (activeStreamUrl.includes('stream-placeholder')) {
      setIsUsingFallback(true);
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      destroyPlayers();
    };
  }, [activeStreamUrl, isPlaying]);

  // Audio element for white noise simulation
  const [noiseActive, setNoiseActive] = useState<boolean>(false);

  // Keep timestamp rolling
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      setCurrentTimeStr(timeStr);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fluctuating Bitrate and FPS to simulate a real network feed
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setBitrate(prev => {
        const delta = Math.floor(Math.random() * 200) - 100;
        const next = prev + delta;
        return Math.max(1200, Math.min(3200, next));
      });
      setFps(prev => {
        const delta = Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const next = prev + delta;
        return Math.max(24, Math.min(26, next));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle PTZ Simulation
  const handlePtz = (direction: 'up' | 'down' | 'left' | 'right') => {
    switch (direction) {
      case 'up': setPtzY(prev => Math.max(-30, prev - 5)); break;
      case 'down': setPtzY(prev => Math.min(30, prev + 5)); break;
      case 'left': setPtzX(prev => Math.max(-40, prev - 5)); break;
      case 'right': setPtzX(prev => Math.min(40, prev + 5)); break;
    }
  };

  const resetPtz = () => {
    setPtzX(0);
    setPtzY(0);
    setZoomLevel(1);
  };

  // Define location specific animations and elements to simulate active CCTV video stream
  const renderFeed = () => {
    const style: React.CSSProperties = {
      transform: `scale(${zoomLevel}) translate(${ptzX}px, ${ptzY}px)`,
      transition: 'transform 0.2s ease-out',
    };

    const bgImg = currentThumbUrl || getDefaultThumb();

    return (
      <div style={style} className="relative w-full h-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
        {/* Fallback background image overlay */}
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <img 
            src={bgImg} 
            alt={camera.name} 
            className={`w-full h-full object-cover filter brightness-75 contrast-105 transition-opacity duration-700 ${
              isVideoActive ? 'opacity-0' : 'opacity-100'
            }`}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.fallback) {
                target.dataset.fallback = 'true';
                target.src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';
              }
            }}
          />
        </div>

        {fetchError && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-amber-500/40 text-center shadow-2xl">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="flex flex-col text-left">
              <div className="text-amber-400 text-[9px] font-mono font-bold tracking-widest uppercase">MODE SNAPSHOT LIVE AKTIF</div>
              <div className="text-white/70 text-[8px] font-mono max-w-[280px]">Live video standby pada Cloud Hikvision. Foto pengawasan diperbarui otomatis.</div>
            </div>
            <button 
              onClick={handleReconnect}
              className="ml-2 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 text-[8px] font-mono font-bold rounded uppercase transition tracking-wider"
            >
              RECONNECT
            </button>
          </div>
        )}

        {isLoadingStream && !fetchError && !liveStreamUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-center">
            <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-2" />
            <div className="text-emerald-400 text-[9px] font-mono tracking-widest uppercase">Fetching Stream URL...</div>
          </div>
        )}

        {/* Live video motion simulation gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none z-10" />

        {/* Status banner */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] text-[#10b981] font-mono tracking-widest bg-black/85 px-3 py-1 rounded-md border border-[#10b981]/30 flex items-center gap-1.5 shadow-xl pointer-events-none z-20">
          <span className={`w-2 h-2 rounded-full ${isVideoActive ? 'bg-[#10b981] animate-ping' : (fetchError ? 'bg-amber-400' : 'bg-[#10b981]')}`} />
          <span>{isVideoActive ? 'LIVE VIDEO STREAM ACTIVE' : (fetchError ? 'HIK-CONNECT SNAPSHOT MODE' : 'LIVE FEED ACTIVE')} [CH {camera.channel || 1}]</span>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`relative w-full h-full bg-[#0a0a0a] select-none overflow-hidden group border transition-all duration-300 ${
        isFocused ? 'border-white ring-2 ring-white/10' : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* CCTV HUD Header - Top Left */}
      <div className="absolute top-3 left-3 z-10 font-mono text-[10px] text-zinc-100 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded border border-white/5 flex flex-col gap-0.5 tracking-wider pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse" />
          <span className="font-semibold text-[#ef4444] text-[9px]">REC</span>
          <span className="text-white/20">|</span>
          <span className="text-white font-bold">{branchName}</span>
        </div>
        <div className="text-[9px] text-white/80 font-bold">{camera.name}</div>
        <div className="text-[8px] text-white/40">{camera.type} {camera.ipAddress ? `@ ${camera.ipAddress}:${camera.port}` : ''}</div>
      </div>

      {/* CCTV HUD Details - Top Right (Network stats only, keeping single master timestamp in TVDashboard header) */}
      <div className="absolute top-3 right-3 z-10 font-mono text-[9px] text-zinc-200 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded border border-white/5 flex flex-col items-end gap-0.5 pointer-events-none">
        <div className="flex gap-2 text-[#10b981] text-[8px] font-bold">
          <span>{bitrate} Kbps</span>
          <span>{fps.toFixed(1)} FPS</span>
          <span>CH {camera.channel || 1}</span>
        </div>
      </div>

      {/* Video element: always in DOM so videoRef is always available for mpegts.js */}
      <video
        ref={videoRef}
        autoPlay
        muted={isMuted}
        playsInline
        onPlaying={() => {
          setIsVideoActive(true);
          setStreamError(false);
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.currentTime > 0 && !v.paused) {
            setIsVideoActive(true);
            setStreamError(false);
          }
        }}
        onPause={() => {
          // Do not abruptly hide on temporary network buffering
        }}
        onEnded={() => setIsVideoActive(false)}
        className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ${
          isPlaying && isVideoActive && !hasStreamError && !activeStreamUrl?.startsWith('ezopen://') ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } filter contrast-110 brightness-95`}
      />

      {/* EZUIKit Player container for ezopen:// proprietary streams */}
      <div 
        id={`ezuikit-container-${camera.id}`} 
        className={`absolute inset-0 w-full h-full z-10 ${
          isPlaying && isVideoActive && (activeStreamUrl?.startsWith('ezopen://') || false) ? 'block' : 'hidden'
        }`} 
      />

      {/* Camera Live/Offline State Renderer */}
      {isPlaying ? (
        <div className="w-full h-full relative">
          {streamStatus === 'connecting' && (
            <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center font-mono">
              <div className="relative mb-3">
                <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <span className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase">MENGHUBUNGKAN KE HIKVISION NVR</span>
              <span className="text-white/40 text-[9px] mt-1">{camera.ipAddress || '192.168.1.100'}:{camera.port || 8000} (CH {camera.channel || 1})</span>
            </div>
          )}

          {renderFeed()}

          
          {/* Watermark Logo */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/5 text-[9px] text-white/50 font-mono">
            <Shield className="w-3 h-3 text-white/40" />
            <span>HIKVISION H.265+</span>
          </div>

          {/* PTZ Indicator HUD overlay (only shows on hover) */}
          <div className="absolute bottom-12 right-3 z-10 pointer-events-none bg-black/80 border border-white/10 p-2 rounded text-[8px] font-mono text-white/50 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="text-white/80 font-bold border-b border-white/5 pb-0.5">PTZ STATUS</div>
            <div>PAN: {ptzX > 0 ? `+${ptzX}` : ptzX}°</div>
            <div>TILT: {ptzY > 0 ? `+${ptzY}` : ptzY}°</div>
            <div>ZOOM: {zoomLevel.toFixed(1)}x</div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-[#050505] flex flex-col items-center justify-center font-mono p-4">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-2 animate-pulse">
            <Radio className="w-6 h-6" />
          </div>
          <span className="text-[#ef4444] font-bold text-xs tracking-widest">NO SIGNAL</span>
          <span className="text-white/40 text-[10px] mt-1 text-center uppercase tracking-wider">FEED DISCONNECTED / POWER FAULT</span>
        </div>
      )}

      {/* Hikvision Controller Overlays (Visible on Hover / Focused) */}
      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
        {/* Top Spacer */}
        <div />

        {/* Center PTZ Controls for Kiosk Interactivity */}
        <div className="flex justify-center items-center gap-2 pointer-events-auto">
          {isPlaying && (
            <div className="flex flex-col items-center bg-black/60 backdrop-blur-sm p-1.5 rounded-lg border border-white/10 shadow-xl">
              <button 
                onClick={() => handlePtz('up')} 
                title="Pan Up"
                className="p-1 hover:bg-white/10 hover:text-white text-white/70 rounded transition"
              >
                <MoveUp className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handlePtz('left')} 
                  title="Pan Left"
                  className="p-1 hover:bg-white/10 hover:text-white text-white/70 rounded transition"
                >
                  <MoveLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={resetPtz} 
                  title="Reset PTZ"
                  className="p-1 hover:bg-white/10 text-[7px] text-white/50 font-mono font-bold rounded"
                >
                  RST
                </button>
                <button 
                  onClick={() => handlePtz('right')} 
                  title="Pan Right"
                  className="p-1 hover:bg-white/10 hover:text-white text-white/70 rounded transition"
                >
                  <MoveRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <button 
                onClick={() => handlePtz('down')} 
                title="Pan Down"
                className="p-1 hover:bg-white/10 hover:text-white text-white/70 rounded transition"
              >
                <MoveDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="flex justify-between items-center bg-black/80 p-1.5 rounded border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title={isPlaying ? "Stop Stream" : "Start Stream"}
            >
              {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>
            <button 
              onClick={handleReconnect}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded text-[9px] font-mono tracking-wider transition uppercase flex items-center gap-1 border border-white/10"
              title="Reconnect Stream"
            >
              <span>RECONNECT</span>
            </button>
          </div>

          {isPlaying && (
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setZoomLevel(z => Math.min(3, z + 0.2))} 
                title="Zoom In"
                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setZoomLevel(z => Math.max(1, z - 0.2))} 
                title="Zoom Out"
                className="p-1 text-white/70 hover:text-white hover:bg-[#050505] rounded transition"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
