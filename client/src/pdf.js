import { jsPDF } from 'jspdf';
import { money, duration } from './format.js';

// Build a one-page PDF quote from what is on screen.
export function downloadQuotePdf({ fileName, geometry, validation, settings, printer, rows, advice, locked, canvas }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  doc.setFontSize(18);
  doc.text('Manufacturing quote', 15, y);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${new Date().toLocaleString()} · ${fileName}`, 15, (y += 6));
  if (locked) {
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text(`Quote ${locked.quoteId} · price locked until ${new Date(locked.expiresAt).toLocaleDateString()}`, 15, (y += 6));
    doc.setFont(undefined, 'normal');
  }
  doc.setTextColor(0);

  if (canvas) {
    try {
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, (y += 6), 80, 60);
    } catch {
      /* the 3D snapshot is optional */
    }
  }

  const [sx, sy, sz] = geometry.bbox.size;
  const facts = [
    ['Volume', `${(geometry.volume / 1000).toFixed(2)} cm³`],
    ['Surface area', `${(geometry.surfaceArea / 100).toFixed(1)} cm²`],
    ['Size', `${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)} mm`],
    ['Triangles', geometry.triangleCount.toLocaleString()],
    ['Mesh', validation.watertight ? 'watertight' : 'NOT watertight'],
    ['Print settings', `${settings.layerHeight} mm layers, ${Math.round(settings.infill * 100)} % infill`],
    ['Printer', printer ? printer.name.slice(0, 34) : 'Generic'],
    ['Quantity', String(settings.quantity)],
  ];
  let fy = y + 2;
  facts.forEach(([k, v]) => {
    doc.setFont(undefined, 'bold');
    doc.text(k, 102, fy);
    doc.setFont(undefined, 'normal');
    doc.text(v, 135, fy);
    fy += 7;
  });

  y += 70;
  doc.setFont(undefined, 'bold');
  const cols = [15, 60, 85, 115, 145, 172];
  ['Material', 'Process', 'Weight', 'Machine time', 'Per part', 'Total'].forEach((h, i) => doc.text(h, cols[i], y));
  doc.setFont(undefined, 'normal');
  doc.line(15, y + 2, 195, y + 2);
  rows.forEach((r) => {
    y += 7;
    [r.name, r.process === 'fdm' ? '3D print' : 'CNC', `${r.weightG.toFixed(1)} g`, duration(r.machineMinutes * 60), money(r.perPart), money(r.total)]
      .forEach((v, i) => doc.text(v, cols[i], y));
  });

  if (advice) {
    y += 12;
    doc.setFont(undefined, 'bold');
    doc.text(`AI recommendation: ${advice.materialName}`, 15, y);
    doc.setFont(undefined, 'normal');
    doc.text(doc.splitTextToSize(advice.reason, 180), 15, (y += 6));
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    locked
      ? 'Locked quote: price calculated by the server from the submitted mesh. Valid until the date above.'
      : 'Preview only, not locked. Save the quote to lock the price.',
    15,
    287,
  );
  doc.save(`quote-${fileName.replace(/\.stl$/i, '')}.pdf`);
}
