/**
 * Branded A4 invoice PDF, generated entirely in the browser with jsPDF +
 * jspdf-autotable (both vendored locally). Port of the original pdf module.
 */

import { APP_CONFIG } from "./config.js";
import {
  computeInvoiceTotals,
  downloadBlobFile,
  formatCurrency,
  formatDate,
  formatInvoiceNumber,
} from "./utils.js";

function formatMoneyPdf(value) {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: APP_CONFIG.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${APP_CONFIG.currency}`;
  }
}

function getJsPdf() {
  const scope = window.jspdf;
  if (!scope || typeof scope.jsPDF !== "function") {
    throw new Error("The PDF library failed to load. Check /js/vendor/jspdf.umd.min.js.");
  }
  return scope.jsPDF;
}

function drawTable(doc, options) {
  if (typeof doc.autoTable === "function") {
    doc.autoTable(options);
    return doc.lastAutoTable;
  }
  const plugin = window.jspdfAutoTable;
  if (typeof plugin === "function") {
    plugin(doc, options);
    return doc.lastAutoTable;
  }
  throw new Error("The PDF table plugin failed to load.");
}

/**
 * Builds a branded A4 PDF invoice. Returns the jsPDF document so callers can
 * download or preview it.
 */
export function createInvoicePdf({ invoice, items, customer }) {
  const JsPDF = getJsPdf();
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Header band
  doc.setFillColor(34, 120, 235);
  doc.rect(0, 0, pageWidth, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(APP_CONFIG.clinicName, margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(APP_CONFIG.clinicAddress, margin, 58);
  doc.text(`${APP_CONFIG.clinicPhone}  ·  ${APP_CONFIG.clinicEmail}`, margin, 72);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INVOICE", pageWidth - margin, 44, { align: "right" });

  // Meta
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Billed to", margin, 126);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text((customer && customer.full_name) || "Walk-in customer", margin, 142);
  if (customer && customer.phone) doc.text(customer.phone, margin, 156);

  doc.setFont("helvetica", "bold");
  doc.text("Invoice details", pageWidth - margin, 126, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(formatInvoiceNumber(invoice.id), pageWidth - margin, 142, { align: "right" });
  doc.text(`Issued ${formatDate(invoice.created_at)}`, pageWidth - margin, 156, {
    align: "right",
  });
  doc.text(`Status: ${String(invoice.status).toUpperCase()}`, pageWidth - margin, 170, {
    align: "right",
  });

  // Line items
  const tableResult = drawTable(doc, {
    startY: 196,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: items.map((item) => [
      item.description,
      String(item.quantity),
      formatMoneyPdf(item.unit_price),
      formatMoneyPdf(item.quantity * item.unit_price),
    ]),
    styles: { fontSize: 9, cellPadding: 8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [239, 248, 255], textColor: [28, 69, 138], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 50 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  const totals = computeInvoiceTotals(
    items.map((item) => ({ quantity: item.quantity, unitPrice: item.unit_price })),
    invoice.subtotal > 0 ? (invoice.tax / invoice.subtotal) * 100 : 0,
  );

  let cursorY = tableResult && tableResult.finalY ? tableResult.finalY + 24 : 380;
  const boxWidth = 220;
  const boxX = pageWidth - margin - boxWidth;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal", boxX, cursorY);
  doc.text(formatMoneyPdf(totals.subtotal), pageWidth - margin, cursorY, { align: "right" });
  cursorY += 18;
  doc.text("Tax", boxX, cursorY);
  doc.text(formatMoneyPdf(totals.tax), pageWidth - margin, cursorY, { align: "right" });
  cursorY += 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(boxX, cursorY, pageWidth - margin, cursorY);
  cursorY += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Total", boxX, cursorY);
  doc.text(formatMoneyPdf(invoice.total), pageWidth - margin, cursorY, { align: "right" });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 56;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Thank you for choosing our clinic. Please keep this invoice for your records.",
    margin,
    footerY,
  );
  doc.text("Generated by ClinicFlow", pageWidth - margin, footerY, { align: "right" });

  return doc;
}

/** Generates and downloads a PDF invoice. */
export function downloadInvoicePdf(input) {
  const doc = createInvoicePdf(input);
  const blob = doc.output("blob");
  downloadBlobFile(`${formatInvoiceNumber(input.invoice.id)}.pdf`, blob);
}

export { formatCurrency };
