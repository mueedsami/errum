// lib/receiptHtml.ts
// Browser-based receipt preview / printing fallback (works without QZ Tray).
// Users can use the Print dialog to "Save as PDF".

import { normalizeOrderForReceipt, type ReceiptOrder } from '@/lib/receipt';

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(n: any, currency = '৳') {
  const x = Number(n || 0);
  const formatted = x.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${currency}${formatted}`;
}

function receiptBody(r: ReceiptOrder) {
  const itemsHtml = (r.items || [])
    .map((it) => {
      const name = it.variant ? `${it.name} (${it.variant})` : it.name;
      return `<tr>
        <td style="width:58%">${escapeHtml(name)}</td>
        <td style="text-align:right; width:10%">${escapeHtml(String(it.qty))}</td>
        <td style="text-align:right; width:16%">${escapeHtml(money(it.unitPrice, r.currencySymbol))}</td>
        <td style="text-align:right; width:16%">${escapeHtml(money(it.lineTotal, r.currencySymbol))}</td>
      </tr>`;
    })
    .join('');

  const orderNo = r.orderNumber || r.orderId || '—';
  const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString() : new Date().toLocaleString();

  return `
    <h1>${escapeHtml((r.storeName || 'ERRUM').toUpperCase())}</h1>
    <div class="meta">
      <div><b>Order:</b> ${escapeHtml(String(orderNo))}</div>
      <div><b>Date:</b> ${escapeHtml(createdAt)}</div>
      ${r.customerName ? `<div><b>Customer:</b> ${escapeHtml(r.customerName)}</div>` : ''}
      ${r.customerPhone ? `<div><b>Phone:</b> ${escapeHtml(r.customerPhone)}</div>` : ''}
      ${r.paymentMethod ? `<div><b>Payment:</b> ${escapeHtml(r.paymentMethod)}</div>` : ''}
    </div>

    <div class="line"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="line"></div>

    <table>
      <tbody>
        <tr>
          <td>Subtotal</td>
          <td class="right">${escapeHtml(money(r.totals?.subtotal ?? 0, r.currencySymbol))}</td>
        </tr>
        ${(r.totals?.discount ?? 0) > 0 ? `<tr><td>Discount</td><td class="right">-${escapeHtml(money(r.totals?.discount ?? 0, r.currencySymbol))}</td></tr>` : ''}
        ${(r.totals?.shipping ?? 0) > 0 ? `<tr><td>Shipping</td><td class="right">${escapeHtml(money(r.totals?.shipping ?? 0, r.currencySymbol))}</td></tr>` : ''}
        <tr class="total">
          <td><b>Grand Total</b></td>
          <td class="right"><b>${escapeHtml(money(r.totals?.total ?? 0, r.currencySymbol))}</b></td>
        </tr>
        ${(r.totals?.paid ?? 0) > 0 ? `<tr><td>Paid</td><td class="right">${escapeHtml(money(r.totals?.paid ?? 0, r.currencySymbol))}</td></tr>` : ''}
        ${(r.totals?.due ?? 0) > 0 ? `<tr><td>Due</td><td class="right">${escapeHtml(money(r.totals?.due ?? 0, r.currencySymbol))}</td></tr>` : ''}
      </tbody>
    </table>

    ${r.notes ? `<div class="note">${escapeHtml(r.notes)}</div>` : ''}

    <div class="footer">${escapeHtml(r.footerText || 'Thank you!')}</div>
  `;
}

function wrapHtml(title: string, inner: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; color:#111; }
    h1 { font-size: 14px; margin:0 0 6px; text-align:center; }
    .meta { font-size: 11px; margin-bottom: 8px; }
    .line { border-top: 1px dashed #999; margin: 8px 0; }
    table { width:100%; border-collapse: collapse; font-size: 11px; }
    th { text-align:left; padding: 4px 0; border-bottom: 1px solid #ddd; }
    td { padding: 4px 0; vertical-align: top; }
    .right { text-align:right; }
    .total td { padding-top: 6px; }
    .footer { text-align:center; font-size: 11px; margin-top: 10px; }
    .note { font-size: 11px; margin-top: 8px; }
    .btnbar { position: fixed; top: 10px; right: 10px; display:flex; gap:8px; }
    .btnbar button { font-family: inherit; font-size: 12px; padding: 8px 10px; cursor:pointer; }
    @media print { .btnbar { display:none; } }
    .page { break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
  </style>
</head>
<body>
  <div class="btnbar">
    <button onclick="window.print()">Print / Save PDF</button>
    <button onclick="window.close()">Close</button>
  </div>
  ${inner}
</body>
</html>`;
}

export function receiptHtml(order: any): string {
  const r = normalizeOrderForReceipt(order);
  const title = `Receipt ${r.orderNumber || r.orderId || ''}`.trim();
  return wrapHtml(title, `<div class="page">${receiptBody(r)}</div>`);
}

export function receiptBulkHtml(orders: any[]): string {
  const pages = (orders || []).map((o) => {
    const r = normalizeOrderForReceipt(o);
    const title = `Receipt ${r.orderNumber || r.orderId || ''}`.trim();
    return `<div class="page" data-title="${escapeHtml(title)}">${receiptBody(r)}</div>`;
  }).join('');
  return wrapHtml('Bulk Receipts', pages || '<p>No orders selected</p>');
}

export function openReceiptPreview(order: any): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=800');
  if (!w) {
    alert('Popup blocked. Please allow popups to preview receipt.');
    return;
  }
  w.document.open();
  w.document.write(receiptHtml(order));
  w.document.close();
}

export function openBulkReceiptPreview(orders: any[]): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=520,height=900');
  if (!w) {
    alert('Popup blocked. Please allow popups to preview receipts.');
    return;
  }
  w.document.open();
  w.document.write(receiptBulkHtml(orders));
  w.document.close();
}
