// Genera un HTML imprimible con los QR de todos los usuarios de Supabase.
// Ejecutar: node scripts/generate-qrs.mjs
// Abre qr-codes.html en Safari/Chrome → Archivo → Imprimir → Guardar como PDF

import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { writeFileSync } from 'fs';

const supabase = createClient(
  'https://leouxhiftwsxnokupssq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3V4aGlmdHdzeG5va3Vwc3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDUwMTksImV4cCI6MjA5MzY4MTAxOX0.BaanFTrxBhpwkViY8Xi9Yp7Ci4gZJomeTUWaQjgJik4'
);

const LABELS = {
  full_pass:    'Ilimitado',
  '3_pass':     '12 Clases',
  '2_pass':     '8 Clases',
  visit_pass:   'Visita',
  trial_pass:   'Prueba',
};

const COLORS = {
  full_pass:    '#0d9488',
  '3_pass':     '#0284c7',
  '2_pass':     '#7c3aed',
  visit_pass:   '#4e7a9e',
  trial_pass:   '#b06820',
};

async function main() {
  console.log('Obteniendo usuarios de Supabase...');
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, membershipType, membershipStatus, renewalDate, qrCode')
    .not('membershipType', 'in', '("wellhub","fitness_pass","trial_pass")')
    .order('name');

  if (error) { console.error(error.message); process.exit(1); }
  console.log(`  → ${users.length} usuarios`);

  const cards = await Promise.all(users.map(async (u) => {
    const dataUrl = await QRCode.toDataURL(u.qrCode, {
      width: 240, margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    const color   = COLORS[u.membershipType] ?? '#64748b';
    const label   = LABELS[u.membershipType]  ?? u.membershipType;
    const expired = u.membershipStatus === 'expired';
    let renewal = '';
    try {
      renewal = new Date(u.renewalDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {}

    return `
    <div class="card${expired ? ' expired' : ''}">
      <div class="badge" style="background:${color}">${label}</div>
      <img src="${dataUrl}" alt="QR ${u.name}" />
      <p class="name">${u.name}</p>
      <p class="renewal${expired ? ' exp' : ''}">${expired ? '⚠ Vencida' : `Vence: ${renewal}`}</p>
    </div>`;
  }));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>People Pass — Códigos QR</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:24px;color:#0f172a}
    h1{text-align:center;font-size:22px;color:#0d9488;margin-bottom:4px}
    .meta{text-align:center;font-size:12px;color:#94a3b8;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:14px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 10px;display:flex;flex-direction:column;align-items:center;gap:7px;break-inside:avoid}
    .card.expired{border-color:#fca5a5;background:#fff5f5;opacity:.7}
    .badge{color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:3px 10px;border-radius:999px}
    .card img{width:155px;height:155px;border-radius:6px;border:1px solid #e2e8f0}
    .name{font-size:12px;font-weight:700;text-align:center;line-height:1.3}
    .renewal{font-size:10px;color:#64748b;text-align:center}
    .renewal.exp{color:#dc2626;font-weight:600}
    @media print{body{background:#fff;padding:8px}.grid{gap:10px}}
  </style>
</head>
<body>
  <h1>⬡ People Pass</h1>
  <p class="meta">Códigos QR · ${users.length} usuarios · ${new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</p>
  <div class="grid">${cards.join('')}</div>
</body>
</html>`;

  const out = './qr-codes.html';
  writeFileSync(out, html, 'utf8');
  console.log(`\n✅ Listo: ${out}`);
  console.log('   Abre el archivo en tu navegador → Archivo → Imprimir → Guardar como PDF');
}

main().catch(console.error);
