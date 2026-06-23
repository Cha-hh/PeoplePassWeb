// Un QR por página — ideal para guardar página individual y enviar por WhatsApp.
// Ejecutar: node scripts/generate-qrs-individual.mjs
// Salida: qr-codes-individual.pdf

import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';

const supabase = createClient(
  'https://leouxhiftwsxnokupssq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb3V4aGlmdHdzeG5va3Vwc3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDUwMTksImV4cCI6MjA5MzY4MTAxOX0.BaanFTrxBhpwkViY8Xi9Yp7Ci4gZJomeTUWaQjgJik4'
);

const LABELS = {
  full_pass:  'Ilimitado',
  '3_pass':   '12 Clases',
  '2_pass':   '8 Clases',
  visit_pass: 'Visita',
  trial_pass: 'Prueba',
};

const COLORS = {
  full_pass:  [13, 148, 136],
  '3_pass':   [2, 132, 199],
  '2_pass':   [124, 58, 237],
  visit_pass: [78, 122, 158],
  trial_pass: [176, 104, 32],
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const QR_SIZE = 320;

async function main() {
  console.log('Obteniendo usuarios de Supabase...');
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, membershipType, membershipStatus, renewalDate, qrCode')
    .not('membershipType', 'in', '("wellhub","fitness_pass","trial_pass")')
    .order('name');

  if (error) { console.error(error.message); process.exit(1); }
  console.log(`  → ${users.length} usuarios`);

  console.log('Generando QR codes...');
  const cards = await Promise.all(users.map(async (u) => {
    const qrBuf = await QRCode.toBuffer(u.qrCode, {
      type: 'png', width: QR_SIZE * 3, margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    let renewal = '';
    try {
      renewal = new Date(u.renewalDate).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {}
    return { ...u, qrBuf, renewal };
  }));

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
  const out  = './qr-codes-individual.pdf';
  const stream = createWriteStream(out);
  doc.pipe(stream);

  for (const card of cards) {
    doc.addPage();

    const color   = COLORS[card.membershipType] ?? [100, 116, 139];
    const label   = LABELS[card.membershipType]  ?? card.membershipType;
    const expired = card.membershipStatus === 'expired';

    // Fondo suave
    doc.rect(0, 0, PAGE_W, PAGE_H)
       .fillColor('#f8fafc').fill();

    // Franja de color superior
    doc.rect(0, 0, PAGE_W, 8)
       .fillColor(`rgb(${color.join(',')})`)
       .fill();

    // Logo / título
    doc.fontSize(22).fillColor('#0d9488').font('Helvetica-Bold')
       .text('⬡ People Pass', 0, 28, { align: 'center', width: PAGE_W });

    // Badge membresía
    const badgeW = 140;
    const badgeX = (PAGE_W - badgeW) / 2;
    doc.roundedRect(badgeX, 62, badgeW, 24, 12)
       .fillColor(`rgb(${color.join(',')})`)
       .fill();
    doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
       .text(label.toUpperCase(), badgeX, 69, { width: badgeW, align: 'center' });

    // QR centrado
    const qrX = (PAGE_W - QR_SIZE) / 2;
    const qrY = 106;
    // Fondo blanco con sombra leve para el QR
    doc.roundedRect(qrX - 12, qrY - 12, QR_SIZE + 24, QR_SIZE + 24, 16)
       .fillColor('#ffffff').fill();
    doc.roundedRect(qrX - 12, qrY - 12, QR_SIZE + 24, QR_SIZE + 24, 16)
       .strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.image(card.qrBuf, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });

    // Nombre del usuario
    const nameY = qrY + QR_SIZE + 30;
    doc.fontSize(26).fillColor('#0f172a').font('Helvetica-Bold')
       .text(card.name, 40, nameY, { align: 'center', width: PAGE_W - 80 });

    // Línea divisora
    doc.moveTo(80, nameY + 48).lineTo(PAGE_W - 80, nameY + 48)
       .strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Estado y fecha
    if (expired) {
      doc.fontSize(14).fillColor('#dc2626').font('Helvetica-Bold')
         .text('⚠  Membresía vencida', 0, nameY + 58, { align: 'center', width: PAGE_W });
    } else {
      doc.fontSize(13).fillColor('#64748b').font('Helvetica')
         .text(`Vence: ${card.renewal}`, 0, nameY + 58, { align: 'center', width: PAGE_W });
    }

    // Instrucción
    doc.fontSize(10).fillColor('#94a3b8').font('Helvetica')
       .text('Presenta este código en la entrada del gimnasio', 0, nameY + 82, {
         align: 'center', width: PAGE_W,
       });

    // Franja inferior
    doc.rect(0, PAGE_H - 8, PAGE_W, 8)
       .fillColor(`rgb(${color.join(',')})`)
       .fill();
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log(`\n✅ PDF generado: ${out}`);
  console.log(`   ${users.length} páginas — una por usuario.`);
  console.log('   En Preview: Archivo → Exportar como PDF para guardar páginas individuales.');
}

main().catch(console.error);
