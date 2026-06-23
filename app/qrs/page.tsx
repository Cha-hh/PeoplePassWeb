'use client';

import { useEffect, useState } from 'react';
import { supabase, User, MEMBERSHIP_LABELS } from '../../lib/supabase';
import QRCode from 'qrcode';

const COLORS: Record<string, string> = {
  full_pass:  '#0d9488',
  '3_pass':   '#0284c7',
  '2_pass':   '#7c3aed',
  visit_pass: '#4e7a9e',
  trial_pass: '#b06820',
};

interface UserWithQR extends User { qrDataUrl: string }

export default function QRsPage() {
  const [users, setUsers]     = useState<UserWithQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, membershipType, membershipStatus, renewalDate, qrCode')
        .not('membershipType', 'in', '("wellhub","fitness_pass","trial_pass")')
        .order('name');

      if (!data) { setLoading(false); return; }

      const withQR = await Promise.all((data as User[]).map(async (u) => ({
        ...u,
        qrDataUrl: await QRCode.toDataURL(u.qrCode, {
          width: 200, margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        }),
      })));
      setUsers(withQR);
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand">⬡ Códigos QR</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} usuarios · <a href="/" className="text-brand hover:underline">← Dashboard</a></p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-brand text-gray-950 font-bold text-sm hover:opacity-90 transition-opacity"
        >
          🖨 Imprimir / PDF
        </button>
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar usuario..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-6 px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 placeholder-gray-500 text-sm print:hidden"
      />

      {loading ? (
        <p className="text-center text-gray-500 py-20">Generando códigos QR...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(u => {
            const expired = u.membershipStatus === 'expired';
            const color   = COLORS[u.membershipType] ?? '#64748b';
            const label   = MEMBERSHIP_LABELS[u.membershipType] ?? u.membershipType;
            let renewal = '';
            try { renewal = new Date(u.renewalDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch {}

            return (
              <div
                key={u.id}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 ${
                  expired
                    ? 'border-red-800 bg-red-950/20 opacity-70'
                    : 'border-gray-800 bg-gray-900'
                }`}
              >
                <span
                  className="text-white text-xs font-bold uppercase tracking-wide px-3 py-0.5 rounded-full"
                  style={{ backgroundColor: color }}
                >
                  {label}
                </span>
                <img src={u.qrDataUrl} alt={`QR ${u.name}`} className="w-36 h-36 rounded-lg" />
                <p className="text-sm font-semibold text-center leading-tight">{u.name}</p>
                <p className={`text-xs text-center ${expired ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
                  {expired ? '⚠ Vencida' : `Vence: ${renewal}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}
