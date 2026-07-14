'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, User, Payment, MembershipType, MEMBERSHIP_LABELS } from '../../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const MEMBERSHIP_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  full_pass:    { bg: '#0d9488', text: '#ffffff' },
  '3_pass':     { bg: '#0284c7', text: '#ffffff' },
  '2_pass':     { bg: '#7c3aed', text: '#ffffff' },
  visit_pass:   { bg: '#ea580c', text: '#ffffff' },
  trial_pass:   { bg: '#92400e', text: '#ffffff' },
  wellhub:      { bg: '#be185d', text: '#ffffff' },
  fitness_pass: { bg: '#b45309', text: '#ffffff' },
};

const MEMBERSHIP_TYPES = ['full_pass', '3_pass', '2_pass', 'visit_pass', 'trial_pass'] as const;

function fmt(d: string) {
  try { return format(parseISO(d), "d MMM yyyy", { locale: es }); } catch { return d; }
}
function fmtDT(d: string) {
  try { return format(parseISO(d), "d MMM yyyy · HH:mm", { locale: es }); } catch { return d; }
}
function money(n: number) { return `$${n.toLocaleString('es-MX')}`; }

// ── Componente de campo editable ─────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 text-sm focus:border-brand focus:outline-none"
      />
    </div>
  );
}

// ── Modal genérico ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function UserDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [user,     setUser]     = useState<User | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');

  // Edit user modal state
  const [editUser,  setEditUser]  = useState(false);
  const [uForm,     setUForm]     = useState({ name: '', email: '', phone: '', membershipType: '', membershipStatus: '', renewalDate: '' });

  // Edit payment modal state
  const [editPay,   setEditPay]   = useState<Payment | null>(null);
  const [pForm,     setPForm]     = useState({ amount: '', paymentMethod: 'cash' as 'cash' | 'card', paidAt: '', notes: '' });

  // Add payment modal state
  const [addPay, setAddPay] = useState(false);
  const [newPay, setNewPay] = useState({ amount: '', paymentMethod: 'cash' as 'cash' | 'card', paidAt: new Date().toISOString().slice(0, 16), notes: '', membershipType: '' });

  const load = async () => {
    const [uRes, pRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase.from('payments').select('*').eq('userId', id).order('paidAt', { ascending: false }),
    ]);
    if (uRes.data) setUser(uRes.data as User);
    if (pRes.data) setPayments(pRes.data as Payment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Genera el QR en canvas cuando carga el usuario
  useEffect(() => {
    if (!user || !qrCanvasRef.current) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(qrCanvasRef.current!, user.qrCode, {
        width: 180, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    });
  }, [user]);

  // Descarga tarjeta con QR + nombre + membresía con branding People Pass
  const downloadQrCard = async () => {
    if (!user) return;
    const QRCode = await import('qrcode');

    const W = 400, H = 520;
    const canvas = document.createElement('canvas');
    canvas.width  = W * 2; // retina
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);

    // Fondo oscuro
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Franja superior teal
    const grad = ctx.createLinearGradient(0, 0, W, 60);
    grad.addColorStop(0, '#0d9488');
    grad.addColorStop(1, '#0f766e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 60);

    // Logo texto ⬡ People Pass
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⬡ People Pass', W / 2, 40);

    // Cuadro blanco para el QR
    const qrSize = 200;
    const qrX = (W - qrSize) / 2;
    const qrY = 80;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16);
    ctx.fill();

    // QR sobre el canvas
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, user.qrCode, { width: qrSize, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Nombre del usuario
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // Truncar nombre largo
    let name = user.name;
    while (ctx.measureText(name).width > W - 48 && name.length > 4) name = name.slice(0, -1);
    if (name !== user.name) name += '…';
    ctx.fillText(name, W / 2, qrY + qrSize + 52);

    // Badge de membresía
    const badge = MEMBERSHIP_BADGE_COLORS[user.membershipType] ?? { bg: '#0d9488', text: '#fff' };
    const label = MEMBERSHIP_LABELS[user.membershipType as MembershipType] ?? user.membershipType;
    ctx.font = 'bold 14px system-ui, sans-serif';
    const bw = ctx.measureText(label).width + 32;
    const bx = (W - bw) / 2;
    const by = qrY + qrSize + 66;
    ctx.fillStyle = badge.bg;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 30, 15);
    ctx.fill();
    ctx.fillStyle = badge.text;
    ctx.fillText(label, W / 2, by + 20);

    // Línea divisoria y código QR abreviado
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, H - 56);
    ctx.lineTo(W - 32, H - 56);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const shortCode = user.qrCode.length > 28 ? user.qrCode.slice(0, 28) + '…' : user.qrCode;
    ctx.fillText(shortCode, W / 2, H - 36);
    ctx.fillText('Acceso individual e intransferible', W / 2, H - 18);

    // Descarga
    const link = document.createElement('a');
    link.download = `QR-${user.name.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // ── Guardar usuario ─────────────────────────────────────────────────────
  const openEditUser = () => {
    if (!user) return;
    setUForm({
      name: user.name, email: user.email ?? '', phone: user.phone ?? '',
      membershipType: user.membershipType, membershipStatus: user.membershipStatus,
      renewalDate: user.renewalDate,
    });
    setEditUser(true);
  };

  const saveUser = async () => {
    setSaving(true);
    const { error } = await supabase.from('users').update({
      name: uForm.name, email: uForm.email || null, phone: uForm.phone || null,
      membershipType: uForm.membershipType, membershipStatus: uForm.membershipStatus,
      renewalDate: uForm.renewalDate, updatedAt: new Date().toISOString(),
    }).eq('id', id);
    setSaving(false);
    if (error) { notify('❌ Error al guardar'); return; }
    setEditUser(false);
    notify('✅ Usuario actualizado');
    load();
  };

  // ── Editar pago ─────────────────────────────────────────────────────────
  const openEditPay = (p: Payment) => {
    setEditPay(p);
    setPForm({ amount: String(p.amount), paymentMethod: p.paymentMethod, paidAt: p.paidAt.slice(0, 16), notes: p.notes ?? '' });
  };

  const savePay = async () => {
    if (!editPay) return;
    setSaving(true);
    const { error } = await supabase.from('payments').update({
      amount: parseFloat(pForm.amount), paymentMethod: pForm.paymentMethod,
      paidAt: new Date(pForm.paidAt).toISOString(), notes: pForm.notes || null,
    }).eq('id', editPay.id);
    setSaving(false);
    if (error) { notify('❌ Error al guardar pago'); return; }
    setEditPay(null);
    notify('✅ Pago actualizado');
    load();
  };

  const deletePay = async (payId: string) => {
    if (!confirm('¿Eliminar este pago?')) return;
    await supabase.from('payments').delete().eq('id', payId);
    notify('🗑 Pago eliminado');
    load();
  };

  // ── Eliminar usuario ────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteUser = async () => {
    setSaving(true);
    await supabase.from('users').delete().eq('id', id);
    // Registra el borrado para que el iPad lo elimine localmente.
    // Los pagos y accesos se conservan en Supabase para mantener
    // el historial financiero y de asistencia en los reportes.
    await supabase.from('deleted_users').upsert({ id });
    setSaving(false);
    router.push('/usuarios');
  };

  // ── Agregar pago ────────────────────────────────────────────────────────
  const saveNewPay = async () => {
    if (!user) return;
    setSaving(true);

    // Siempre 30 días desde la fecha del pago registrado (no acumula con renewalDate anterior)
    const payDate   = new Date(newPay.paidAt);
    const newRenewal = new Date(payDate);
    newRenewal.setDate(newRenewal.getDate() + 30);
    const newRenewalStr  = newRenewal.toISOString().slice(0, 10);
    const membershipType = newPay.membershipType || user.membershipType;

    const [payRes, userRes] = await Promise.all([
      supabase.from('payments').insert({
        id: crypto.randomUUID(),
        userId: user.id, userName: user.name,
        membershipType,
        amount: parseFloat(newPay.amount),
        paymentMethod: newPay.paymentMethod,
        renewalDate: newRenewalStr,
        paidAt: payDate.toISOString(),
        notes: newPay.notes || null,
      }),
      supabase.from('users').update({
        membershipStatus: 'active',
        membershipType,
        renewalDate: newRenewalStr,
        updatedAt: new Date().toISOString(),
      }).eq('id', user.id),
    ]);

    setSaving(false);
    if (payRes.error || userRes.error) { notify('❌ Error al agregar pago'); return; }
    setAddPay(false);
    notify(`✅ Pago registrado · Membresía activa hasta ${newRenewalStr}`);
    load();
  };

  const daysLeftCurrent = user ? Math.ceil((new Date(user.renewalDate).getTime() - Date.now()) / 86400000) : 0;

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Cargando...</div>;
  if (!user)   return <div className="flex items-center justify-center h-screen text-gray-500">Usuario no encontrado</div>;

  const daysLeft = daysLeftCurrent;
  const expired  = user.membershipStatus === 'expired' || daysLeft < 0;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {msg && <div className="fixed top-4 right-4 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm z-50">{msg}</div>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1"><Link href="/usuarios" className="text-brand hover:underline">← Usuarios</Link></p>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <span className="inline-block mt-1 text-xs font-bold text-white px-3 py-0.5 rounded-full"
            style={{ backgroundColor: expired ? '#dc2626' : '#0d9488' }}>
            {MEMBERSHIP_LABELS[user.membershipType]} · {expired ? 'Vencida' : `${daysLeft}d restantes`}
          </span>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={openEditUser}
            className="px-4 py-2 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/10 transition-colors">
            ✏ Editar
          </button>
          <button onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 rounded-lg border border-red-800 text-red-500 text-sm font-semibold hover:bg-red-950/40 transition-colors">
            🗑 Eliminar
          </button>
        </div>
      </div>

      {/* QR card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col sm:flex-row items-center gap-5">
        <div className="rounded-xl bg-white p-2 shadow-lg flex-shrink-0">
          <canvas ref={qrCanvasRef} />
        </div>
        <div className="flex flex-col gap-2 items-center sm:items-start">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Código QR de acceso</p>
          <p className="text-xs text-gray-600 font-mono break-all">{user.qrCode}</p>
          <button onClick={downloadQrCard}
            className="mt-1 px-4 py-2 rounded-lg border border-brand/50 text-brand text-sm font-semibold hover:bg-brand/10 transition-colors flex items-center gap-2">
            ⬇ Descargar tarjeta QR
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Información</p>
          <p className="text-sm">{user.email || <span className="text-gray-600">Sin email</span>}</p>
          <p className="text-sm">{user.phone || <span className="text-gray-600">Sin teléfono</span>}</p>
          <p className="text-sm text-gray-400">Alta: {fmt(user.startDate)}</p>
        </div>
        <div className={`rounded-xl border p-4 space-y-2 ${expired ? 'border-red-800 bg-red-950/20' : 'border-gray-800 bg-gray-900'}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Membresía</p>
          <p className={`text-lg font-bold ${expired ? 'text-red-400' : 'text-brand'}`}>
            {expired ? '⚠ Vencida' : '✓ Activa'}
          </p>
          <p className="text-sm text-gray-400">{expired ? 'Venció' : 'Renueva'}: {fmt(user.renewalDate)}</p>
          <p className="text-sm text-gray-500">Total pagado: <span className="text-brand font-semibold">{money(totalPaid)}</span></p>
        </div>
      </div>

      {/* Pagos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Historial de pagos ({payments.length})</h2>
          <button onClick={() => { setNewPay({ amount: '', paymentMethod: 'cash', paidAt: new Date().toISOString().slice(0,16), notes: '', membershipType: user.membershipType }); setAddPay(true); }}
            className="px-3 py-1.5 rounded-lg bg-brand/10 border border-brand text-brand text-xs font-bold hover:bg-brand/20 transition-colors">
            + Agregar pago
          </button>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin pagos registrados</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
                <span className="text-xl">{p.paymentMethod === 'cash' ? '💵' : '💳'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand">{money(p.amount)}</p>
                  <p className="text-xs text-gray-500">{fmtDT(p.paidAt)}{p.notes ? ` · ${p.notes}` : ''}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEditPay(p)}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:border-brand hover:text-brand transition-colors">
                    Editar
                  </button>
                  <button onClick={() => deletePay(p.id)}
                    className="text-xs px-2 py-1 rounded-lg border border-red-900/50 text-red-500 hover:border-red-500 transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal editar usuario */}
      {editUser && (
        <Modal title="Editar usuario" onClose={() => setEditUser(false)}>
          <div className="space-y-3">
            <Field label="Nombre" value={uForm.name} onChange={v => setUForm(f => ({ ...f, name: v }))} />
            <Field label="Email" value={uForm.email} onChange={v => setUForm(f => ({ ...f, email: v }))} type="email" />
            <Field label="Teléfono" value={uForm.phone} onChange={v => setUForm(f => ({ ...f, phone: v }))} />
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Plan</label>
              <select value={uForm.membershipType} onChange={e => setUForm(f => ({ ...f, membershipType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 text-sm focus:border-brand focus:outline-none">
                {MEMBERSHIP_TYPES.map(t => <option key={t} value={t}>{MEMBERSHIP_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Estado</label>
              <select value={uForm.membershipStatus} onChange={e => setUForm(f => ({ ...f, membershipStatus: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 text-sm focus:border-brand focus:outline-none">
                <option value="active">Activa</option>
                <option value="expired">Vencida</option>
              </select>
            </div>
            <Field label="Fecha de renovación" value={uForm.renewalDate} onChange={v => setUForm(f => ({ ...f, renewalDate: v }))} type="date" />
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setEditUser(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">Cancelar</button>
            <button onClick={saveUser} disabled={saving} className="flex-2 flex-1 py-2 rounded-lg bg-brand text-gray-950 font-bold text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal editar pago */}
      {editPay && (
        <Modal title="Editar pago" onClose={() => setEditPay(null)}>
          <div className="space-y-3">
            <Field label="Monto ($)" value={pForm.amount} onChange={v => setPForm(f => ({ ...f, amount: v }))} type="number" />
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Forma de pago</label>
              <div className="flex gap-2">
                {(['cash', 'card'] as const).map(m => (
                  <button key={m} onClick={() => setPForm(f => ({ ...f, paymentMethod: m }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      pForm.paymentMethod === m ? 'border-brand bg-brand/10 text-brand' : 'border-gray-700 text-gray-400'}`}>
                    {m === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Fecha y hora" value={pForm.paidAt} onChange={v => setPForm(f => ({ ...f, paidAt: v }))} type="datetime-local" />
            <Field label="Notas (opcional)" value={pForm.notes} onChange={v => setPForm(f => ({ ...f, notes: v }))} />
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setEditPay(null)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">Cancelar</button>
            <button onClick={savePay} disabled={saving} className="flex-1 py-2 rounded-lg bg-brand text-gray-950 font-bold text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDelete && (
        <Modal title="⚠ Eliminar usuario" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-gray-300">
            ¿Estás seguro de que quieres eliminar a <span className="font-bold text-white">{user.name}</span>?
          </p>
          <p className="text-sm text-gray-400">
            Sus pagos y registros de acceso se conservarán en los reportes históricos.
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">
              Cancelar
            </button>
            <button onClick={deleteUser} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal agregar pago */}
      {addPay && (
        <Modal title="Agregar pago" onClose={() => setAddPay(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Membresía</label>
              <div className="flex gap-2 flex-wrap">
                {MEMBERSHIP_TYPES.map(t => (
                  <button key={t} onClick={() => setNewPay(f => ({ ...f, membershipType: t }))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      (newPay.membershipType || user?.membershipType) === t
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-gray-700 text-gray-400'}`}>
                    {MEMBERSHIP_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Monto ($)" value={newPay.amount} onChange={v => setNewPay(f => ({ ...f, amount: v }))} type="number" />
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Forma de pago</label>
              <div className="flex gap-2">
                {(['cash', 'card'] as const).map(m => (
                  <button key={m} onClick={() => setNewPay(f => ({ ...f, paymentMethod: m }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      newPay.paymentMethod === m ? 'border-brand bg-brand/10 text-brand' : 'border-gray-700 text-gray-400'}`}>
                    {m === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Fecha y hora" value={newPay.paidAt} onChange={v => setNewPay(f => ({ ...f, paidAt: v }))} type="datetime-local" />
            <Field label="Notas (opcional)" value={newPay.notes} onChange={v => setNewPay(f => ({ ...f, notes: v }))} />
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setAddPay(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm">Cancelar</button>
            <button onClick={saveNewPay} disabled={saving || !newPay.amount}
              className="flex-1 py-2 rounded-lg bg-brand text-gray-950 font-bold text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
