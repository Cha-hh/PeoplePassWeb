// Genera un PDF con todos los QR codes. Ese PDF se puede enviar por WhatsApp, email, etc.
// Ejecutar: node scripts/generate-qrs-pdf.mjs
// Salida: qr-codes.pdf (en la raíz del proyecto)

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

// ── Layout ────────────────────────────────────────────────────────────────────
const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 28;
const COLS    = 3;
const CARD_W  = (PAGE_W - MARGIN * 2) / COLS;  // ~179 pts
const QR_SIZE = 120;
const CARD_H  = QR_SIZE + 56;  // QR + badge + name + renewal + padding

// Primera página tiene encabezado, las demás empiezan desde MARGIN
const HEADER_H       = 52;
const ROWS_PAGE_1    = Math.floor((PAGE_H - MARGIN - HEADER_H) / CARD_H);
const ROWS_OTHER     = Math.floor((PAGE_H - MARGIN * 2) / CARD_H);
const CARDS_PAGE_1   = ROWS_PAGE_1 * COLS;
const CARDS_PER_PAGE = ROWS_OTHER * COLS;

function cardPosition(i) {
  if (i < CARDS_PAGE_1) {
    return {
      page: 0,
      x: MARGIN + (i % COLS) * CARD_W,
      y: HEADER_H + Math.floor(i / COLS) * CARD_H,
    };
  }
  const rest     = i - CARDS_PAGE_1;
  const pageIdx  = Math.floor(rest / CARDS_PER_PAGE) + 1;
  const inPage   = rest % CARDS_PER_PAGE;
  return {
    page: pageIdx,
    x: MARGIN + (inPage % COLS) * CARD_W,
    y: MARGIN + Math.floor(inPage / COLS) * CARD_H,
  };
}

function drawCard(doc, card, x, y) {
  const color   = COLORS[card.membershipType] ?? [100, 116, 139];
  const label   = LABELS[card.membershipType]  ?? card.membershipType;
  const expired = card.membershipStatus === 'expired';

  // Fondo + borde
  doc.roundedRect(x + 4, y + 3, CARD_W - 8, CARD_H - 6, 9)
     .fillColor(expired ? '#fff5f5' : '#f8fafc').fill();
  doc.roundedRect(x + 4, y + 3, CARD_W - 8, CARD_H - 6, 9)
     .strokeColor(expired ? '#fca5a5' : '#e2e8f0').lineWidth(0.8).stroke();

  // Badge membresía
  const cx = x + CARD_W / 2;
  doc.roundedRect(cx - 34, y + 10, 68, 14, 7)
     .fillColor(`rgb(${color.join(',')})`)
     .fill();
  doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
     .text(label.toUpperCase(), cx - 34, y + 13, { width: 68, align: 'center' });

  // QR image
  const qrX = x + (CARD_W - QR_SIZE) / 2;
  const qrY = y + 28;
  doc.image(card.qrBuf, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });

  // Nombre
  doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold')
     .text(card.name, x + 6, qrY + QR_SIZE + 5, { width: CARD_W - 12, align: 'center' });

  // Renovación
  const renewText = expired ? 'Membresía vencida' : `Vence: ${card.renewal}`;
  doc.fontSize(7).fillColor(expired ? '#dc2626' : '#64748b').font('Helvetica')
     .text(renewText, x + 6, qrY + QR_SIZE + 17, { width: CARD_W - 12, align: 'center' });
}

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
      type: 'png', width: QR_SIZE * 3, margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    let renewal = '';
    try {
      renewal = new Date(u.renewalDate).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {}
    return { ...u, qrBuf, renewal };
  }));

  const totalPages = 1 + Math.ceil(Math.max(0, cards.length - CARDS_PAGE_1) / CARDS_PER_PAGE);
  console.log(`Creando PDF (${totalPages} página${totalPages > 1 ? 's' : ''})...`);

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
  const out  = './qr-codes.pdf';
  const stream = createWriteStream(out);
  doc.pipe(stream);

  // Encabezado primera página
  doc.fontSize(18).fillColor('#0d9488').font('Helvetica-Bold')
     .text('People Pass — Códigos QR', MARGIN, 14, { align: 'center', width: PAGE_W - MARGIN * 2 });
  doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
     .text(
       `${users.length} usuarios · ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
       MARGIN, 34, { align: 'center', width: PAGE_W - MARGIN * 2 }
     );

  let currentPage = 0;

  for (let i = 0; i < cards.length; i++) {
    const pos = cardPosition(i);

    if (pos.page > currentPage) {
      doc.addPage();
      currentPage = pos.page;
    }

    drawCard(doc, cards[i], pos.x, pos.y);
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log(`\n✅ PDF generado: ${out}`);
  console.log('   Abre el Finder → arrastra el PDF a WhatsApp o comparte por AirDrop/iCloud.');
}

main().catch(console.error);
