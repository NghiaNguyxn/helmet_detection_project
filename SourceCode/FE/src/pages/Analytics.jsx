import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Target, ShieldCheck,
  Calendar, ChevronDown, Clock, Activity,
  Filter
} from 'lucide-react';
import api from '../services/api';
import CustomDropdown from '../components/CustomDropdown';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const toLocalDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Sparkline = ({ data, color, height = 30, width = 100 }) => {
  if (!data || data.length < 2) return <div style={{ height, width }}></div>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => ({
    x: i * stepX,
    y: height - ((val - min) / range) * height
  }));

  const pathData = `M ${points[0].x} ${points[0].y} ` +
    points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 2px ${color}80)` }}
      />
      <path
        d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#${gradId})`}
        className="opacity-20"
      />
    </svg>
  );
};

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [granularity, setGranularity] = useState('day'); // 'day' or 'hour'
  const timeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = toLocalDateValue(new Date());
      let startDateStr = today;
      let endDateStr = today;

      const start = new Date();
      if (timeRange === 'yesterday') {
        start.setDate(start.getDate() - 1);
        const yesterdayStr = toLocalDateValue(start);
        startDateStr = yesterdayStr;
        endDateStr = yesterdayStr; // Chỉ lấy duy nhất ngày hôm qua
      } else if (timeRange === '7d') {
        start.setDate(start.getDate() - 7);
        startDateStr = toLocalDateValue(start);
      } else if (timeRange === '30d') {
        start.setDate(start.getDate() - 30);
        startDateStr = toLocalDateValue(start);
      } else if (timeRange === 'all') {
        startDateStr = '2024-01-01';
      }

      const [summaryRes, trendRes] = await Promise.all([
        api.get(`/reports/summary?start_date=${startDateStr}&end_date=${endDateStr}`),
        api.get(`/reports/trend?start_date=${startDateStr}&end_date=${endDateStr}&granularity=${granularity}`)
      ]);

      if (summaryRes.data.code === 200) setSummary(summaryRes.data.result);
      if (trendRes.data.code === 200) setTrend(trendRes.data.result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Soft-polling avoids UI jitter and unnecessary database pressure.
  useEffect(() => {
    const intervalId = setInterval(fetchData, 300000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const chartData = (trend && trend.labels && trend.datasets) ? trend.labels.map((label, index) => ({
    name: label,
    violations: trend.datasets.violations ? trend.datasets.violations[index] : 0,
    safe: trend.datasets.compliance ? trend.datasets.compliance[index] : 0
  })) : [];

  const pieData = (summary && summary.total_detections > 0) ? [
    { name: 'Violations', value: summary.total_violations, color: '#ffb2b7' },
    { name: 'Safe Detections', value: Math.max(0, summary.total_detections - summary.total_violations), color: '#4edea3' },
  ] : [
    { name: 'No Data', value: 1, color: '#2d3449' }
  ];

  const stats = [
    {
      label: 'Total Violations',
      value: summary?.total_violations || '0',
      icon: ShieldCheck,
      color: 'bg-error/10 text-error',
      trendData: trend?.datasets?.violations?.slice(-10) || [0, 0, 0, 0, 0]
    },
    {
      label: 'Violation Rate',
      value: summary ? `${summary.total_detections > 0 ? ((summary.total_violations / summary.total_detections) * 100).toFixed(1) : 0.0}%` : '0.0%',
      icon: TrendingUp,
      color: 'bg-primary/10 text-primary',
      trendData: trend?.datasets?.violations?.map((v, i) => {
        const total = v + (trend.datasets.compliance[i] || 0);
        return total > 0 ? (v / total) * 100 : 0;
      }).slice(-10) || [0, 0, 0, 0, 0]
    },
    {
      label: 'Accuracy',
      value: summary ? `${summary.accuracy}%` : '100.0%',
      icon: Target,
      color: 'bg-primary/10 text-primary',
      trendData: trend?.datasets?.accuracy?.slice(-10) || [100, 100, 100, 100, 100]
    },
    {
      label: 'Peak Hour',
      value: summary?.peak_hour || 'N/A',
      icon: Clock,
      color: 'bg-secondary/10 text-secondary',
      isPeak: true
    },
  ];

  const renderPeakHour = (value) => {
    if (value === 'N/A' || !value.includes(' (')) {
      return (
        <p className="text-3xl font-black text-on-surface/20 font-mono tracking-tight leading-none mt-1">
          {value === 'N/A' ? '— —' : value}
        </p>
      );
    }
    const [time, countRaw] = value.split(' (');
    const count = countRaw.replace(')', '');
    return (
      <div className="flex flex-col mt-1">
        <span className="text-2xl font-black text-on-surface font-mono tracking-tight leading-none">{time}</span>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest whitespace-nowrap bg-primary/10 px-2 py-0.5 rounded-sm">{count}</span>
          <div className="h-px flex-1 bg-primary/20"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header & Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Intelligence Engine</h2>
          <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
            Deep Analytics & Trends - Confirmed Non-Demo Violations Only
          </p>
        </div>

        <CustomDropdown
          options={timeOptions}
          value={timeRange}
          onChange={setTimeRange}
          icon={Calendar}
          labelPrefix="Range"
          headerText="Select Time Range"
        />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="surface-1 border border-on-surface/5 p-6 rounded-md tech-glow">
              <div className="flex items-center justify-between mb-5">
                <Skeleton width="40px" height="40px" rounded="rounded-xl" />
                <Skeleton width="60px" height="12px" />
              </div>
              <Skeleton width="100px" height="14px" className="mb-3" />
              <Skeleton width="140px" height="32px" />
            </div>
          ))
        ) : (
          stats.map((stat, i) => (
            <div key={i} className="surface-1 border border-on-surface/5 p-6 rounded-md tech-glow group hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between mb-5">
                <div className={`p-2.5 rounded-xl border border-on-surface/5 ${stat.color} shadow-inner`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[7px] font-mono text-on-surface-variant uppercase tracking-widest font-bold opacity-60">
                    {stat.isPeak ? 'Time-based' : 'Live Sync'}
                  </span>
                  <div className="w-12 h-1 bg-on-surface/10 rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-current opacity-60 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold font-mono text-on-surface-variant uppercase tracking-[0.2em] mb-2 pl-0.5">{stat.label}</p>
                  {stat.isPeak ? (
                    renderPeakHour(stat.value)
                  ) : (
                    <p className={`text-3xl font-black font-mono tracking-tight leading-none mt-1 ${stat.value === '0' || stat.value === '0.0%' ? 'text-on-surface/20' : 'text-on-surface'}`}>
                      {stat.value}
                    </p>
                  )}
                </div>

                {!stat.isPeak && stat.trendData && (
                  <div className="pb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Sparkline
                      data={stat.trendData}
                      color={stat.color.includes('text-error') ? '#ffb2b7' : '#4edea3'}
                      width={80}
                      height={25}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Traffic Trend Chart */}
        <div className="col-span-12 lg:col-span-8 surface-1 border border-on-surface/5 p-6 rounded-md tech-glow flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/5 rounded border border-primary/10">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-xs font-mono uppercase font-bold tracking-[0.2em] text-on-surface-variant">Throughput vs. Violation Density</h3>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center p-1 bg-surface-low rounded-lg border border-on-surface/5">
              <button
                onClick={() => setGranularity('day')}
                className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${granularity === 'day'
                  ? 'bg-primary text-background shadow-lg'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Daily
              </button>
              <button
                onClick={() => setGranularity('hour')}
                className={`px-3 py-1.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all ${granularity === 'hour'
                  ? 'bg-primary text-background shadow-lg'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                Hourly
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="w-full h-full flex flex-col gap-4">
                <Skeleton height="20px" width="40%" />
                <Skeleton height="100%" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3449" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    stroke="#c0c6d6"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    fontFamily="monospace"
                  />
                  <YAxis
                    stroke="#c0c6d6"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                    fontFamily="monospace"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171f33', border: '1px solid rgba(218, 226, 253, 0.1)', borderRadius: '4px' }}
                    itemStyle={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: 'monospace' }}
                    labelStyle={{ color: '#c0c6d6', marginBottom: '8px', fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="safe"
                    name="Safe Persons"
                    stroke="#4edea3"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#4edea3', strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="violations"
                    name="Violations"
                    stroke="#ffb2b7"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#ffb2b7', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No Trend Data"
                message="Adjust the range or wait for more detections to populate the chart."
                className="h-full"
              />
            )}
          </div>
        </div>

        {/* Pulse Chart (Right 30%) */}
        <div className="col-span-12 lg:col-span-4 surface-1 border border-on-surface/5 p-6 rounded-md tech-glow flex flex-col h-[450px]">
          <h3 className="text-xs font-mono uppercase font-bold tracking-[0.2em] text-on-surface-variant mb-10">Compliance Integrity</h3>
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            {loading ? (
              <div className="w-full flex flex-col items-center gap-6">
                <Skeleton width="180px" height="180px" rounded="rounded-full" />
                <div className="w-full space-y-3">
                  <Skeleton height="40px" />
                  <Skeleton height="40px" />
                </div>
              </div>
            ) : summary && summary.total_detections > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={10}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#171f33', border: '1px solid rgba(218, 226, 253, 0.1)', borderRadius: '4px' }}
                      itemStyle={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: 'monospace' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="w-full space-y-3 mt-8">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-low/50 rounded border border-on-surface/5 group hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: item.color, color: item.color }}></div>
                        <span className="text-[10px] font-mono text-on-surface-variant group-hover:text-on-surface uppercase tracking-widest">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-on-surface">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={Activity}
                title="Integrity Check"
                message="No detections recorded for the selected period."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
