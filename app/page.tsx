'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, User, AccessLog, Payment, MEMBERSHIP_LABELS } from '../lib/supabase';
import {
  format, parseISO, differenceInCalendarDays,
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date: string) {
  try { return format(parseISO(date), 'd MMM yyyy', { locale: es }); }
  catch { return date; }
}
function fmtTime(date: string) {
  try { return format(parseISO(date), 'd MMM · HH:mm', { locale: es }); }
  catch { return date; }
}
function money(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
}
function daysLeft(renewalDate: string) {
  return differenceInCalendarDays(parseISO(renewalDate), new Date());
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-sm text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">{title}</h2>
      {children}
    </section>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [users,    setUsers]    = useState<User[]>([]);
  const [logs,     setLogs]     = useState<AccessLog[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [payRange, setPayRange] = useState<'week' | 'month'>('month');

  const load = useCallback(async () => {
    setLoading(true);
    const [u, l, p] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('access_logs').select('*').order('accessTime', { ascending: false }).limit(200),
      supabase.from('payments').select('*').order('paidAt', { ascending: false }).limit(500),
    ]);
    if (u.data) setUsers(u.data as User[]);
    if (l.data) setLogs(l.data as AccessLog[]);
    if (p.data) setPayments(p.data as Payment[]);
    setLastSync(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const realUsers  = users.filter(u => !['wellhub', 'fitness_pass', 'visit_pass', 'trial_pass'].includes(u.membershipType));
  const active     = realUsers.filter(u => u.membershipStatus === 'active');
  const expired    = realUsers.filter(u => u.membershipStatus === 'expired');
  const expiringSoon = realUsers.filter(u => {
    const d = daysLeft(u.renewalDate);
    return d >= 0 && d <= 7;
  }).sort((a, b) => daysLeft(a.renewalDate) - daysLeft(b.renewalDate));

  const todayLogs  = logs.filter(l => isToday(parseISO(l.accessTime)));
  const grantedToday = todayLogs.filter(l => l.status === 'granted').length;
  const deniedToday  = todayLogs.filter(l => l.status === 'denied').length;

  const now    = new Date();
  const rangeStart = payRange === 'week'
    ? startOfWeek(now, { weekStartsOn: 1 })
    : startOfMonth(now);
  const rangeEnd = payRange === 'week'
    ? endOfWeek(now, { weekStartsOn: 1 })
    : endOfMonth(now);

  const rangePayments = payments.filter(p => {
    const d = parseISO(p.paidAt);
    return d >= rangeStart && d <= rangeEnd;
  });
  const cashTotal  = rangePayments.filter(p => p.paymentMethod === 'cash').reduce((s, p) => s + p.amount, 0);
  const cardTotal  = rangePayments.filter(p => p.paymentMethod === 'card').reduce((s, p) => s + p.amount, 0);
  const totalIncome = cashTotal + cardTotal;

  // membership breakdown
  const byType = Object.entries(
    realUsers.reduce((acc, u) => {
      acc[u.membershipType] = (acc[u.membershipType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand">⬡ People Pass</h1>
          <p className="text-sm text-gray-500 mt-0.5">Panel de control · {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-sm hover:border-brand transition-colors disabled:opacity-50"
        >
          {loading ? '⟳ Actualizando...' : '⟳ Actualizar'}
        </button>
      </div>
      {lastSync && (
        <p className="text-xs text-gray-600 -mt-8">
          Última actualización: {format(lastSync, 'HH:mm:ss')}
        </p>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Activos"        value={active.length}   sub={`de ${realUsers.length} totales`}   color="border-teal-800 bg-teal-950/40" />
        <StatCard label="Vencidos"       value={expired.length}  sub="requieren renovación"                color="border-red-800 bg-red-950/40" />
        <StatCard label="Accesos hoy"    value={grantedToday}    sub={`${deniedToday} denegados`}          color="border-blue-800 bg-blue-950/40" />
        <StatCard label="Por vencer"     value={expiringSoon.length} sub="próximos 7 días"                 color="border-yellow-700 bg-yellow-950/40" />
      </div>

      {/* Ingresos */}
      <Section title="Ingresos">
        <div className="flex gap-2 mb-4">
          {(['week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setPayRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                payRange === r
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {r === 'week' ? 'Esta semana' : 'Este mes'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-green-800 bg-green-950/30 p-5">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">💵 Efectivo</p>
            <p className="text-2xl font-bold text-green-400">{money(cashTotal)}</p>
            <p className="text-xs text-gray-500 mt-1">{rangePayments.filter(p => p.paymentMethod === 'cash').length} pagos</p>
          </div>
          <div className="rounded-xl border border-blue-800 bg-blue-950/30 p-5">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">💳 Tarjeta</p>
            <p className="text-2xl font-bold text-blue-400">{money(cardTotal)}</p>
            <p className="text-xs text-gray-500 mt-1">{rangePayments.filter(p => p.paymentMethod === 'card').length} pagos</p>
          </div>
          <div className="rounded-xl border border-teal-700 bg-teal-950/30 p-5">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">💰 Total</p>
            <p className="text-2xl font-bold text-brand">{money(totalIncome)}</p>
            <p className="text-xs text-gray-500 mt-1">{rangePayments.length} pagos</p>
          </div>
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-10">

        {/* Por vencer */}
        <Section title="Por vencer (próximos 7 días)">
          {expiringSoon.length === 0 ? (
            <p className="text-sm text-gray-500">Ninguno en los próximos 7 días</p>
          ) : (
            <div className="space-y-2">
              {expiringSoon.map(u => {
                const d = daysLeft(u.renewalDate);
                return (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-gray-500">{MEMBERSHIP_LABELS[u.membershipType]} · vence {fmt(u.renewalDate)}</p>
                    </div>
                    <span className={`text-sm font-bold ${d === 0 ? 'text-red-400' : d <= 3 ? 'text-yellow-400' : 'text-orange-400'}`}>
                      {d === 0 ? 'HOY' : `${d}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Accesos de hoy */}
        <Section title={`Accesos de hoy (${todayLogs.length})`}>
          {todayLogs.length === 0 ? (
            <p className="text-sm text-gray-500">Sin accesos registrados hoy</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {todayLogs.map(l => (
                <div key={l.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.status === 'granted' ? 'bg-teal-400' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.userName ?? '—'}</p>
                    <p className="text-xs text-gray-500">{MEMBERSHIP_LABELS[l.membershipType]}</p>
                  </div>
                  <p className="text-xs text-gray-500 flex-shrink-0">{fmtTime(l.accessTime)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>

      <div className="grid md:grid-cols-2 gap-10">

        {/* Distribución de membresías */}
        <Section title="Distribución de membresías">
          <div className="space-y-2">
            {byType.map(([type, count]) => {
              const pct = Math.round((count / realUsers.length) * 100);
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{MEMBERSHIP_LABELS[type as keyof typeof MEMBERSHIP_LABELS] ?? type}</span>
                    <span className="text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Últimos pagos */}
        <Section title="Últimos pagos">
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {payments.slice(0, 20).map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5">
                <span className="text-lg">{p.paymentMethod === 'cash' ? '💵' : '💳'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.userName}</p>
                  <p className="text-xs text-gray-500">{fmtTime(p.paidAt)}</p>
                </div>
                <p className="text-sm font-bold text-brand">{money(p.amount)}</p>
              </div>
            ))}
            {payments.length === 0 && <p className="text-sm text-gray-500">Sin pagos registrados</p>}
          </div>
        </Section>

      </div>

      {/* Vencidos */}
      <Section title={`Membresías vencidas (${expired.length})`}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {expired.map(u => (
            <div key={u.id} className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-gray-500">{MEMBERSHIP_LABELS[u.membershipType]}</p>
              </div>
              <p className="text-xs text-red-400">venció {fmt(u.renewalDate)}</p>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
