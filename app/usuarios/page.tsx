'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, User, MEMBERSHIP_LABELS } from '../../lib/supabase';

const COLORS: Record<string, string> = {
  full_pass: '#0d9488', '3_pass': '#0284c7', '2_pass': '#7c3aed',
  visit_pass: '#4e7a9e', trial_pass: '#b06820',
};

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function UsuariosPage() {
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'soon'>('all');

  useEffect(() => {
    supabase.from('users').select('*')
      .not('membershipType', 'in', '("wellhub","fitness_pass")')
      .order('name')
      .then(({ data }) => { if (data) setUsers(data as User[]); setLoading(false); });
  }, []);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.phone ?? '').includes(search);
    if (!matchSearch) return false;
    if (filter === 'active')  return u.membershipStatus === 'active' && daysLeft(u.renewalDate) > 7;
    if (filter === 'expired') return u.membershipStatus === 'expired' || daysLeft(u.renewalDate) < 0;
    if (filter === 'soon')    return u.membershipStatus === 'active' && daysLeft(u.renewalDate) <= 7 && daysLeft(u.renewalDate) >= 0;
    return true;
  });

  const counts = {
    all:     users.length,
    active:  users.filter(u => u.membershipStatus === 'active' && daysLeft(u.renewalDate) > 7).length,
    expired: users.filter(u => u.membershipStatus === 'expired' || daysLeft(u.renewalDate) < 0).length,
    soon:    users.filter(u => u.membershipStatus === 'active' && daysLeft(u.renewalDate) <= 7 && daysLeft(u.renewalDate) >= 0).length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand">👤 Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5"><Link href="/" className="text-brand hover:underline">← Dashboard</Link></p>
        </div>
        <Link href="/usuarios/nuevo"
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          + Nuevo usuario
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          ['all', 'Todos', counts.all],
          ['active', 'Activos', counts.active],
          ['soon', 'Por vencer', counts.soon],
          ['expired', 'Vencidos', counts.expired],
        ] as const).map(([k, label, count]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filter === k ? 'border-brand bg-brand/10 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {label} <span className="opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <input
        type="text" placeholder="Buscar por nombre, email o teléfono..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 placeholder-gray-500 text-sm"
      />

      {loading ? (
        <p className="text-center text-gray-500 py-20">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const d       = daysLeft(u.renewalDate);
            const expired = u.membershipStatus === 'expired' || d < 0;
            const soon    = !expired && d <= 7 && d >= 0;
            return (
              <Link key={u.id} href={`/usuarios/${u.id}`}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 hover:border-brand transition-colors group ${
                  expired ? 'border-red-900/50 bg-red-950/10' : soon ? 'border-yellow-700/50 bg-yellow-950/10' : 'border-gray-800 bg-gray-900'
                }`}
              >
                <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[u.membershipType] ?? '#64748b' }}>
                  {MEMBERSHIP_LABELS[u.membershipType] ?? u.membershipType}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate group-hover:text-brand transition-colors">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{[u.email, u.phone].filter(Boolean).join(' · ') || 'Sin contacto'}</p>
                </div>
                <p className={`text-xs flex-shrink-0 font-medium ${expired ? 'text-red-400' : soon ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {expired ? `Venció hace ${Math.abs(d)}d` : d === 0 ? 'Vence HOY' : `${d}d restantes`}
                </p>
                <span className="text-gray-600 group-hover:text-brand">›</span>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-12">Sin resultados</p>
          )}
        </div>
      )}
    </div>
  );
}
