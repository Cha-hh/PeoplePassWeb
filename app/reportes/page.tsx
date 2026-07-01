'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase, Payment, MembershipType, MEMBERSHIP_LABELS } from '../../lib/supabase';
import {
  format, parseISO, startOfMonth, endOfMonth,
  subMonths, isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';

function money(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
}

const MEMBERSHIP_COLORS: Record<string, string> = {
  full_pass:    'bg-teal-500',
  '3_pass':     'bg-sky-500',
  '2_pass':     'bg-violet-500',
  visit_pass:   'bg-orange-500',
  trial_pass:   'bg-gray-500',
  wellhub:      'bg-pink-500',
  fitness_pass: 'bg-rose-500',
};

const REAL_TYPES: MembershipType[] = ['full_pass', '3_pass', '2_pass'];

// ─── Builds last N months array (newest first) ────────────────────────────────
function buildMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(now, i);
    return {
      key:   format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: es }),
      start: startOfMonth(d),
      end:   endOfMonth(d),
    };
  });
}

export default function ReportesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [months]                = useState(() => buildMonths(12));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*')
      .order('paidAt', { ascending: false });
    if (data) setPayments(data as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // ── Per-month stats ─────────────────────────────────────────────────────────
  const monthStats = months.map(m => {
    const ps = payments.filter(p =>
      isWithinInterval(parseISO(p.paidAt), { start: m.start, end: m.end })
    );
    const cash  = ps.filter(p => p.paymentMethod === 'cash').reduce((s, p) => s + p.amount, 0);
    const card  = ps.filter(p => p.paymentMethod === 'card').reduce((s, p) => s + p.amount, 0);
    return { ...m, cash, card, total: cash + card, count: ps.length, payments: ps };
  });

  const maxTotal     = Math.max(...monthStats.map(m => m.total), 1);
  const totalAll     = monthStats.reduce((s, m) => s + m.total, 0);
  const bestMonth    = monthStats.reduce((a, b) => b.total > a.total ? b : a, monthStats[0]);
  const avgMonthly   = Math.round(totalAll / months.length);
  const totalPayments = monthStats.reduce((s, m) => s + m.count, 0);

  // ── By membership type (all time within window) ─────────────────────────────
  const byType = REAL_TYPES.map(type => {
    const ps = monthStats.flatMap(m => m.payments).filter(p => p.membershipType === type);
    return { type, total: ps.reduce((s, p) => s + p.amount, 0), count: ps.length };
  }).sort((a, b) => b.total - a.total);
  const maxType = Math.max(...byType.map(t => t.total), 1);

  // ── All-time cash vs card ────────────────────────────────────────────────────
  const allCash = payments.reduce((s, p) => p.paymentMethod === 'cash' ? s + p.amount : s, 0);
  const allCard = payments.reduce((s, p) => p.paymentMethod === 'card' ? s + p.amount : s, 0);
  const allTotal = allCash + allCard;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand">📊 Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <Link href="/" className="text-brand hover:underline">← Dashboard</Link>
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-sm hover:border-brand transition-colors disabled:opacity-50">
          {loading ? '⟳ Cargando...' : '⟳ Actualizar'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-teal-800 bg-teal-950/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Acumulado 12 meses</p>
          <p className="text-2xl font-bold text-teal-300">{money(totalAll)}</p>
          <p className="text-xs text-gray-500 mt-1">{totalPayments} pagos</p>
        </div>
        <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Mejor mes</p>
          <p className="text-2xl font-bold text-yellow-300">{money(bestMonth?.total ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1 capitalize">{bestMonth?.label}</p>
        </div>
        <div className="rounded-xl border border-blue-800 bg-blue-950/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Promedio mensual</p>
          <p className="text-2xl font-bold text-blue-300">{money(avgMonthly)}</p>
          <p className="text-xs text-gray-500 mt-1">últimos 12 meses</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Total registros</p>
          <p className="text-2xl font-bold text-gray-200">{payments.length}</p>
          <p className="text-xs text-gray-500 mt-1">pagos en base de datos</p>
        </div>
      </div>

      {/* Bar chart */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Ingresos por mes</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-end gap-2 h-44">
            {[...monthStats].reverse().map(m => {
              const pct = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0;
              const cashPct = m.total > 0 ? (m.cash / m.total) * 100 : 50;
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                      <p className="font-bold text-gray-100 capitalize">{m.label}</p>
                      <p className="text-green-400">💵 {money(m.cash)}</p>
                      <p className="text-blue-400">💳 {money(m.card)}</p>
                      <p className="text-brand font-semibold border-t border-gray-700 mt-1 pt-1">Total {money(m.total)}</p>
                      <p className="text-gray-500">{m.count} pagos</p>
                    </div>
                    <div className="w-2 h-2 bg-gray-800 border-r border-b border-gray-700 rotate-45 -mt-1" />
                  </div>
                  {/* Bar */}
                  <div
                    className="w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  >
                    <div className="bg-green-600/70" style={{ height: `${cashPct}%` }} />
                    <div className="bg-blue-600/70 flex-1" />
                  </div>
                  <p className="text-[9px] text-gray-500 text-center leading-tight capitalize">
                    {format(m.start, 'MMM', { locale: es })}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-800">
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-green-600/70 inline-block" /> Efectivo</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-blue-600/70 inline-block" /> Tarjeta</span>
          </div>
        </div>
      </section>

      {/* Monthly table */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Detalle mensual</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold">Mes</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold">Pagos</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold">💵 Efectivo</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold">💳 Tarjeta</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {monthStats.map((m, i) => (
                <tr key={m.key}
                  className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/30 ${
                    m.total === bestMonth?.total && m.key === bestMonth?.key ? 'bg-yellow-950/20' : ''
                  }`}>
                  <td className="px-4 py-3 capitalize font-medium text-gray-200">
                    {m.label}
                    {m.key === bestMonth?.key && m.total > 0 && (
                      <span className="ml-2 text-[10px] text-yellow-400 bg-yellow-950/50 border border-yellow-800/50 rounded px-1.5 py-0.5">mejor</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{m.count}</td>
                  <td className="px-4 py-3 text-right text-green-400">{m.cash > 0 ? money(m.cash) : <span className="text-gray-700">—</span>}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{m.card > 0 ? money(m.card) : <span className="text-gray-700">—</span>}</td>
                  <td className={`px-4 py-3 text-right font-bold ${m.total > 0 ? 'text-brand' : 'text-gray-700'}`}>
                    {m.total > 0 ? money(m.total) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-900/80 border-t-2 border-gray-700">
                <td className="px-4 py-3 font-bold text-gray-200">Total</td>
                <td className="px-4 py-3 text-right font-bold text-gray-300">{totalPayments}</td>
                <td className="px-4 py-3 text-right font-bold text-green-400">{money(monthStats.reduce((s, m) => s + m.cash, 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-400">{money(monthStats.reduce((s, m) => s + m.card, 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-brand">{money(totalAll)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">

        {/* By membership type */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Ingresos por tipo de membresía</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
            {byType.map(({ type, total, count }) => {
              const pct = maxType > 0 ? Math.round((total / maxType) * 100) : 0;
              const bar = MEMBERSHIP_COLORS[type] ?? 'bg-gray-500';
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-200">{MEMBERSHIP_LABELS[type]}</span>
                    <span className="text-gray-400 text-xs">{money(total)} · {count} pagos</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {byType.every(t => t.total === 0) && (
              <p className="text-sm text-gray-500">Sin pagos en el período</p>
            )}
          </div>
        </section>

        {/* Cash vs Card all-time */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Forma de pago (total histórico)</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-5">
            {/* Donut-style visual */}
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="3.5" />
                  {allTotal > 0 && (
                    <>
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke="#22c55e"
                        strokeWidth="3.5"
                        strokeDasharray={`${(allCash / allTotal) * 100} ${100 - (allCash / allTotal) * 100}`}
                        strokeDashoffset="0"
                      />
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3.5"
                        strokeDasharray={`${(allCard / allTotal) * 100} ${100 - (allCard / allTotal) * 100}`}
                        strokeDashoffset={`${-((allCash / allTotal) * 100)}`}
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xs text-gray-400 font-semibold">Total</p>
                  <p className="text-xs font-bold text-brand">{money(allTotal)}</p>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-1.5 text-gray-200"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Efectivo</span>
                    <span className="font-bold text-green-400">{allTotal > 0 ? Math.round((allCash / allTotal) * 100) : 0}%</span>
                  </div>
                  <p className="text-lg font-bold text-green-400">{money(allCash)}</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-1.5 text-gray-200"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Tarjeta</span>
                    <span className="font-bold text-blue-400">{allTotal > 0 ? Math.round((allCard / allTotal) * 100) : 0}%</span>
                  </div>
                  <p className="text-lg font-bold text-blue-400">{money(allCard)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

    </div>
  );
}
