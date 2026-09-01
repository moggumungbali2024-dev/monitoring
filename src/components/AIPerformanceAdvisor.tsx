import React, { useState, useEffect } from 'react';
import { Branch, Camera, OmsetRecord, AIAnalysisResponse } from '../types';
import { Sparkles, BrainCircuit, RotateCcw, AlertTriangle, CheckCircle, BarChart2, TrendingUp, HelpCircle } from 'lucide-react';

interface AIPerformanceAdvisorProps {
  branches: Branch[];
  cameras: Camera[];
  omsetRecords: OmsetRecord[];
}

export default function AIPerformanceAdvisor({ branches, cameras, omsetRecords }: AIPerformanceAdvisorProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getAIAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    // Animate status text to look professional
    const statuses = [
      'Membaca data omset cabang...',
      'Menganalisis pola transaksi harian...',
      'Mendeteksi kepadatan kasir dari CCTV...',
      'Merumuskan rekomendasi operasional...',
      'Membuat peringkat performa finansial...'
    ];

    let currentStatusIdx = 0;
    setLoadingStatus(statuses[0]);
    
    const interval = setInterval(() => {
      currentStatusIdx = (currentStatusIdx + 1) % statuses.length;
      setLoadingStatus(statuses[currentStatusIdx]);
    }, 1200);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branches,
          omsetRecords,
          camerasCount: cameras.length
        })
      });

      if (!response.ok) {
        throw new Error('Gagal terhubung dengan server analis AI.');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Terjadi kesalahan saat memproses data AI.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // Run on first mount
  useEffect(() => {
    getAIAnalysis();
  }, [branches.length, omsetRecords.length]);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-xl font-sans relative overflow-hidden">
      
      {/* Decorative AI light reflection */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/10">
            <BrainCircuit className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-black text-zinc-100 tracking-wider font-mono flex items-center gap-2">
              ASISTEN ANALISIS BISNIS AI <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Analisis omset real-time dan tinjauan kepatuhan operasional dari rekaman CCTV cabang.</p>
          </div>
        </div>

        <button
          onClick={getAIAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-xs font-bold font-mono tracking-wider rounded-lg text-amber-400 hover:text-amber-300 disabled:opacity-50 transition flex items-center justify-center gap-1.5 self-start md:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Analisis Ulang</span>
        </button>
      </div>

      {/* MAIN RENDER CONTENT */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin" />
            <BrainCircuit className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <span className="text-sm font-mono font-bold text-amber-400 mt-6 tracking-wide">{loadingStatus}</span>
          <span className="text-xs text-zinc-500 mt-2 font-mono">Didukung oleh Gemini 3.5 Flash</span>
        </div>
      ) : error ? (
        <div className="bg-red-950/20 border border-red-500/20 p-5 rounded-lg flex gap-3 text-red-400 text-xs font-mono">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider block">GAGAL MELAKUKAN ANALISIS AI</span>
            <span className="mt-1 block text-zinc-400">{error}</span>
          </div>
        </div>
      ) : analysis ? (
        <div className="space-y-6">
          
          {/* Executive Summary Section */}
          <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 relative">
            <div className="absolute top-3 right-3 text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
              RINGKASAN EKSEKUTIF
            </div>
            <h3 className="text-xs font-bold font-mono text-zinc-400 tracking-wider uppercase mb-3">TINJAUAN OPERASIONAL GRUP</h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">{analysis.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Branch Rankings column */}
            <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800">
              <h3 className="text-xs font-bold font-mono text-zinc-400 tracking-wider uppercase mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-500" /> PERINGKAT OMSET CABANG
              </h3>
              <div className="space-y-3 font-mono text-xs">
                {analysis.performanceRank && analysis.performanceRank.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-800/60 rounded">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                        idx === 0 ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                      }`}>{idx + 1}</span>
                      <span className="font-bold text-zinc-200">{item.branchName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-400 font-bold">{formatIDR(item.totalRevenue)}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        item.performance.includes('Baik') 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : item.performance.includes('Perhatian') || item.performance.includes('Drop')
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {item.performance}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Detected Anomalies column */}
            <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-mono text-zinc-400 tracking-wider uppercase mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" /> DETEKSI ANOMALI & KENDALA
                </h3>
                <div className="space-y-3 font-sans text-xs">
                  {analysis.anomalies && analysis.anomalies.map((item, idx) => (
                    <div key={idx} className="flex gap-2.5 p-3 bg-red-950/10 border border-red-500/10 rounded text-zinc-300">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                  {(!analysis.anomalies || analysis.anomalies.length === 0) && (
                    <div className="flex gap-2.5 p-3 bg-emerald-950/10 border border-emerald-500/10 rounded text-emerald-400">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Semua cabang beroperasi secara aman tanpa anomali terdeteksi harian.</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-zinc-900 text-[10px] font-mono text-zinc-500">
                Peringatan CCTV disinkronisasikan langsung ke NVR pusat Hikvision.
              </div>
            </div>

          </div>

          {/* Business & CCTV Recommendations */}
          <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800">
            <h3 className="text-xs font-bold font-mono text-zinc-400 tracking-wider uppercase mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" /> STRATEGI TAKTIS REKOMENDASI AI (BASED ON CCTV & OMSET)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {analysis.recommendations && analysis.recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex gap-3 text-xs text-zinc-300 leading-relaxed font-sans">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-mono font-black text-[10px] border border-amber-500/20">{idx + 1}</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <HelpCircle className="w-12 h-12 text-zinc-700 mb-2" />
          <p className="text-zinc-500 font-mono text-xs">SILAKAN TEKAN TOMBOL ANALISIS ULANG UNTUK MEMULAI</p>
        </div>
      )}

    </div>
  );
}
