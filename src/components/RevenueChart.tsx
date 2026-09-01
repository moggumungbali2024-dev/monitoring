import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, Cell } from 'recharts';
import { Branch, OmsetRecord } from '../types';
import { TrendingUp, Award, DollarSign } from 'lucide-react';

interface RevenueChartProps {
  branches: Branch[];
  omsetRecords: OmsetRecord[];
  selectedBranchId: string;
}

export default function RevenueChart({ branches, omsetRecords, selectedBranchId }: RevenueChartProps) {
  // Format currency into Rupiah (IDR)
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatShortIDR = (value: number) => {
    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
    } else if (value >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)}rb`;
    }
    return `Rp ${value}`;
  };

  // 1. Process daily trend data
  const getDailyTrendData = () => {
    // Filter records based on selected branch
    const filteredRecords = selectedBranchId === 'all'
      ? omsetRecords
      : omsetRecords.filter(r => r.branchId === selectedBranchId);

    // Group by date
    const dateMap: Record<string, { date: string; Total: number; Target: number; Transaksi: number }> = {};
    
    // Generate last 7 days of dates to ensure data exists
    const dates = Array.from(new Set(filteredRecords.map(r => r.date))).sort();

    dates.forEach(d => {
      let dailyTotal = 0;
      let dailyTarget = 0;
      let dailyTrans = 0;

      if (selectedBranchId === 'all') {
        branches.forEach(b => {
          dailyTarget += b.targetOmsetDaily;
        });
        filteredRecords.filter(r => r.date === d).forEach(r => {
          dailyTotal += r.amount;
          dailyTrans += r.transactionsCount;
        });
      } else {
        const b = branches.find(branch => branch.id === selectedBranchId);
        dailyTarget = b ? b.targetOmsetDaily : 0;
        filteredRecords.filter(r => r.date === d).forEach(r => {
          dailyTotal += r.amount;
          dailyTrans += r.transactionsCount;
        });
      }

      // Extract day name or simplified date label
      const dateParts = d.split('-');
      const label = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : d;

      dateMap[d] = {
        date: label,
        Total: dailyTotal,
        Target: dailyTarget,
        Transaksi: dailyTrans,
      };
    });

    return Object.values(dateMap);
  };

  // 2. Process branch comparison data (Bar Chart)
  const getBranchComparisonData = () => {
    return branches.map(b => {
      const totalAmount = omsetRecords
        .filter(r => r.branchId === b.id)
        .reduce((sum, r) => sum + r.amount, 0);

      const totalTrans = omsetRecords
        .filter(r => r.branchId === b.id)
        .reduce((sum, r) => sum + r.transactionsCount, 0);

      return {
        name: b.name,
        'Total Omset': totalAmount,
        'Transaksi': totalTrans,
        Target: b.targetOmsetDaily * 7, // Simulated target for the loaded range
      };
    }).sort((a, b) => b['Total Omset'] - a['Total Omset']);
  };

  const trendData = getDailyTrendData();
  const comparisonData = getBranchComparisonData();

  // Color options for branches
  const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#06b6d4', '#f43f5e', '#a855f7'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      
      {/* Chart 1: Daily Revenue Trend (Area Chart) */}
      <div className="glass rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-white/70" />
              <h3 className="text-xs font-bold text-white tracking-widest font-mono uppercase">TREND OMSET HARIAN</h3>
            </div>
            <span className="text-[9px] bg-white/10 text-white font-mono border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
              {selectedBranchId === 'all' ? 'GABUNGAN SEMUA' : branches.find(b => b.id === selectedBranchId)?.name}
            </span>
          </div>
          <p className="text-xs text-white/50 mb-6 font-sans">
            Menampilkan data pencapaian omset harian restoran dibandingkan target harian operasional.
          </p>
        </div>

        <div className="h-72 w-full">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.3)" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <YAxis stroke="rgba(255, 255, 255, 0.3)" tickFormatter={formatShortIDR} style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.85)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                  labelStyle={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold' }}
                  formatter={(value: any, name: any) => [formatIDR(value), name]}
                />
                <Area type="monotone" dataKey="Total" name="Omset Aktual" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
                <Area type="monotone" dataKey="Target" name="Target Bisnis" stroke="rgba(255, 255, 255, 0.4)" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorTarget)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 font-mono text-xs uppercase tracking-widest">
              TIDAK ADA DATA REKAMAN OMSET
            </div>
          )}
        </div>
      </div>

      {/* Chart 2: Branch Sales Comparison (Bar Chart) */}
      <div className="glass rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-white/70" />
              <h3 className="text-xs font-bold text-white tracking-widest font-mono uppercase">KONTRIBUSI ANTAR CABANG</h3>
            </div>
            <span className="text-[9px] bg-white/10 text-white font-mono px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">
              Total Mingguan
            </span>
          </div>
          <p className="text-xs text-white/50 mb-6 font-sans">
            Menampilkan total kontribusi finansial dari masing-masing cabang resto terhadap pendapatan kelompok.
          </p>
        </div>

        <div className="h-72 w-full">
          {comparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.3)" style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <YAxis stroke="rgba(255, 255, 255, 0.3)" tickFormatter={formatShortIDR} style={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 10, 10, 0.85)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                  labelStyle={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold' }}
                  formatter={(value: any, name: any) => [formatIDR(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', marginTop: '10px', color: 'rgba(255, 255, 255, 0.6)' }} />
                <Bar dataKey="Total Omset" name="Total Omset" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
                <Bar dataKey="Target" name="Target Cabang" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth={1} strokeDasharray="3 3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 font-mono text-xs uppercase tracking-widest">
              TIDAK ADA DATA CABANG UNTUK DIBANDINGKAN
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
