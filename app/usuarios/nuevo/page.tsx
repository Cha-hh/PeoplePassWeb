'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, MembershipType, MEMBERSHIP_LABELS } from '../../../lib/supabase';

const MEMBERSHIP_OPTIONS: MembershipType[] = ['full_pass', '3_pass', '2_pass'];

const MEMBERSHIP_COLORS: Record<string, string> = {
  full_pass: 'border-teal-500 bg-teal-500/10 text-teal-400',
  '3_pass':  'border-sky-500 bg-sky-500/10 text-sky-400',
  '2_pass':  'border-violet-500 bg-violet-500/10 text-violet-400',
};

const DEFAULT_AMOUNTS: Record<string, string> = {
  full_pass: '1350', '3_pass': '1200', '2_pass': '1100',
};

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Step = 'form' | 'qr';

interface CreatedUser {
  id: string; name: string; email: string | null; phone: string | null;
  membershipType: MembershipType; qrCode: string; renewalDate: string;
}

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Paso 1: formulario ──────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [membership, setMembership] = useState<MembershipType>('full_pass');
  const [emergencyName, setEmergencyName]   = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // ── Paso 2: QR + pago ───────────────────────────────────────────────────
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [payAmount, setPayAmount]     = useState('');
  const [payMethod, setPayMethod]     = useState<'cash' | 'card'>('card');
  const [savingPay, setSavingPay]     = useState(false);

  // Genera el QR en canvas cuando llega el usuario creado
  useEffect(() => {
    if (!createdUser || !canvasRef.current) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, createdUser.qrCode, {
        width: 220, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
    });
  }, [createdUser]);

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setError('');
    const now      = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const renewal  = addDays(now, 30);
    const nowFull  = now.toISOString().slice(0, 19);
    const qrCode   = 'PP-' + generateId();
    const userId   = generateId();

    const user = {
      id: userId, name: name.trim(),
      email: email.trim() || null, phone: phone.trim() || null,
      membershipType: membership, membershipStatus: 'active',
      paymentDay: now.getDate(), startDate: todayISO, renewalDate: renewal,
      qrCode,
      emergencyContactName:  emergencyName.trim()  || null,
      emergencyContactPhone: emergencyPhone.trim() || null,
      createdAt: nowFull, updatedAt: nowFull,
    };

    const { error: err } = await supabase.from('users').insert(user);
    setSaving(false);
    if (err) { setError('Error al guardar: ' + err.message); return; }

    setCreatedUser({ id: userId, name: name.trim(), email: email.trim() || null,
      phone: phone.trim() || null, membershipType: membership, qrCode, renewalDate: renewal });
    setPayAmount(DEFAULT_AMOUNTS[membership] ?? '');
    setStep('qr');
  };

  const downloadQr = () => {
    if (!canvasRef.current || !createdUser) return;
    const link = document.createElement('a');
    link.download = `QR-${createdUser.name.replace(/\s+/g, '_')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const openEmail = () => {
    if (!createdUser) return;
    const subject = encodeURIComponent(`Tu código QR de acceso — People Pass`);
    const body    = encodeURIComponent(
      `Hola ${createdUser.name},\n\nYa estás registrado en el gimnasio. ` +
      `Adjunta el QR que descargaste para acceder.\n\nTu membresía es válida hasta: ${createdUser.renewalDate}\n\n— People Pass`
    );
    const to = createdUser.email ? encodeURIComponent(createdUser.email) : '';
    window.open(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  const savePay = async () => {
    if (!createdUser) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;
    setSavingPay(true);
    const now        = new Date();
    const renewalDate = addDays(now, 30);
    await supabase.from('payments').insert({
      id: generateId(), userId: createdUser.id, userName: createdUser.name,
      membershipType: createdUser.membershipType, amount,
      paymentMethod: payMethod, renewalDate, paidAt: now.toISOString(),
      notes: 'Pago inicial — registrado desde dashboard web',
    });
    setSavingPay(false);
    router.push(`/usuarios/${createdUser.id}`);
  };

  // ── Paso 2: pantalla de QR + pago ───────────────────────────────────────
  if (step === 'qr' && createdUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand">¡Usuario registrado!</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <Link href="/usuarios" className="text-brand hover:underline">← Usuarios</Link>
          </p>
        </div>

        <div className="space-y-6">

          {/* QR */}
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col items-center gap-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Código QR</p>
            <div className="rounded-xl p-3 bg-white shadow-lg">
              <canvas ref={canvasRef} />
            </div>
            <p className="text-lg font-semibold text-gray-100">{createdUser.name}</p>
            <p className="text-sm text-gray-500">{MEMBERSHIP_LABELS[createdUser.membershipType]} · válido hasta {createdUser.renewalDate}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <button onClick={downloadQr}
                className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition-colors flex items-center gap-2">
                ⬇ Descargar QR
              </button>
              {createdUser.email && (
                <button onClick={openEmail}
                  className="px-4 py-2 rounded-lg border border-brand/50 text-sm text-brand hover:border-brand transition-colors flex items-center gap-2">
                  ✉ Abrir correo
                </button>
              )}
            </div>
            {createdUser.email && (
              <p className="text-xs text-gray-600 text-center max-w-xs">
                Descarga el QR primero y adjúntalo manualmente al correo que se abrirá.
              </p>
            )}
          </section>

          {/* Pago inicial */}
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Pago inicial (opcional)</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Monto</label>
                <input
                  type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  placeholder="1350"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:border-brand outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Forma de pago</label>
                <div className="grid grid-cols-2 gap-2 h-[42px]">
                  {(['cash','card'] as const).map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`rounded-lg border text-sm font-medium transition-colors h-full ${
                        payMethod === m
                          ? m === 'cash' ? 'border-green-500 bg-green-500/10 text-green-400'
                                         : 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {m === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={savePay} disabled={savingPay || !payAmount}
              className="w-full py-3 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
              {savingPay ? 'Guardando...' : '+ Registrar pago y ver perfil'}
            </button>
          </section>

          <button onClick={() => router.push(`/usuarios/${createdUser.id}`)}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Continuar sin registrar pago →
          </button>
        </div>
      </div>
    );
  }

  // ── Paso 1: formulario ───────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand">Nuevo usuario</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <Link href="/usuarios" className="text-brand hover:underline">← Usuarios</Link>
        </p>
      </div>

      <div className="space-y-6">

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Información personal</h2>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:border-brand outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:border-brand outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+52 000 000 0000"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:border-brand outline-none transition-colors"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Membresía</h2>
          <div className="grid grid-cols-3 gap-2">
            {MEMBERSHIP_OPTIONS.map(type => (
              <button key={type} onClick={() => setMembership(type)}
                className={`py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                  membership === type ? MEMBERSHIP_COLORS[type] : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {MEMBERSHIP_LABELS[type]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <span>📅</span> Membresía válida por 30 días desde el registro
          </p>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Contacto de emergencia</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input type="text" value={emergencyName} onChange={e => setEmergencyName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:border-brand outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Teléfono</label>
              <input type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="+52 000 000 0000"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:border-brand outline-none transition-colors"
              />
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="flex gap-3">
          <Link href="/usuarios"
            className="flex-1 text-center py-3 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 transition-colors"
          >
            Cancelar
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Registrar usuario →'}
          </button>
        </div>

      </div>
    </div>
  );
}
