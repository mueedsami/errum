// lib/qz-tray.ts
import { normalizeOrderForReceipt, type ReceiptOrder } from '@/lib/receipt';
import { openReceiptPreview, openBulkReceiptPreview } from '@/lib/receiptHtml';

let qzConnected = false;
let connectPromise: Promise<boolean> | null = null;

function getQZ() {
  if (typeof window === 'undefined') return null;
  return (window as any).qz ?? null;
}

function getErrMsg(err: any) {
  return String(err?.message || err || '');
}

function isOpenConnectionAlreadyExists(err: any) {
  const msg = getErrMsg(err).toLowerCase();
  return msg.includes('open connection') && msg.includes('already exists');
}

function isActiveSocket(): boolean {
  const qz = getQZ();
  try {
    if (!qz?.websocket) return false;
    if (typeof qz.websocket.isActive === 'function') return !!qz.websocket.isActive();
    return !!qz.websocket?.connected || !!qz.websocket?.active;
  } catch {
    return false;
  }
}

/**
 * Connect to QZ Tray safely (idempotent).
 * - If already active: returns true
 * - If connect already in progress: waits for it
 * - If QZ returns "open connection already exists": treat as success
 */
export async function connectQZ(): Promise<boolean> {
  if (qzConnected || isActiveSocket()) {
    qzConnected = true;
    return true;
  }

  // Prevent parallel connect() calls from different pages/buttons
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const qz = getQZ();
    if (!qz?.websocket) {
      qzConnected = false;
      connectPromise = null;
      throw new Error('QZ Tray not available');
    }

    try {
      // If active by the time we try, don't reconnect
      if (isActiveSocket()) {
        qzConnected = true;
        return true;
      }

      await qz.websocket.connect();
      qzConnected = true;
      console.log('✅ QZ Tray connected successfully');
      return true;
    } catch (error: any) {
      // IMPORTANT: treat as success (QZ is already connected)
      if (isOpenConnectionAlreadyExists(error) || isActiveSocket()) {
        qzConnected = true;
        console.log('ℹ️ QZ Tray already connected (reused existing connection)');
        return true;
      }

      qzConnected = false;
      console.error('❌ Failed to connect to QZ Tray:', error);
      throw new Error('QZ Tray is not running. Please start QZ Tray application.');
    } finally {
      // Always clear: next time we can reconnect if needed
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export async function disconnectQZ(): Promise<void> {
  try {
    const qz = getQZ();
    if (qz?.websocket && (qzConnected || isActiveSocket())) {
      await qz.websocket.disconnect();
      console.log('✅ QZ Tray disconnected');
    }
  } catch (error) {
    console.error('❌ Failed to disconnect QZ Tray:', error);
  } finally {
    qzConnected = false;
    connectPromise = null;
  }
}

export async function getPrinters(): Promise<string[]> {
  try {
    await connectQZ();

    const qz = getQZ();
    if (!qz) return [];

    const qzPrinters = qz.printers;
    if (qzPrinters?.find) {
      const printers = await qzPrinters.find();
      return printers;
    }

    return [];
  } catch (error) {
    console.error('❌ Failed to get printers:', error);
    return [];
  }
}

export async function getDefaultPrinter(): Promise<string | null> {
  try {
    await connectQZ();

    const qz = getQZ();
    if (!qz) return null;

    const qzPrinters = qz.printers;
    if (qzPrinters?.getDefault) {
      const printer = await qzPrinters.getDefault();
      return printer;
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to get default printer:', error);
    return null;
  }
}

/**
 * Returns the printer chosen by the user (if saved), otherwise falls back to QZ default.
 * Supports legacy keys previously used in the app.
 */
export async function getPreferredPrinter(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined') {
      const saved =
        window.localStorage.getItem('preferredPrinter') ||
        window.localStorage.getItem('defaultPrinter') ||
        window.localStorage.getItem('selectedPrinter');
      if (saved && saved.trim()) return saved;
    }
    return await getDefaultPrinter();
  } catch {
    return await getDefaultPrinter();
  }
}

/** Save the preferred printer so other pages (POS, purchase history etc.) can reuse it */
export function savePreferredPrinter(printerName: string) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('preferredPrinter', printerName);
      // also keep older key in sync to avoid breaking older UI components
      window.localStorage.setItem('defaultPrinter', printerName);
    }
  } catch {
    // ignore
  }
}

// =====================
// Receipt generation (ESC/POS)
// =====================
function generateReceiptData(order: any): string[] {
  const r: ReceiptOrder = normalizeOrderForReceipt(order);
  const commands: string[] = [];
  const width = 48; // 80mm width

  const ESC = String.fromCharCode(27);
  const GS = String.fromCharCode(29);

  const storeTitle = (r.storeName || 'STORE').toUpperCase();

  // Init & center
  commands.push(`${ESC}@`);
  commands.push(`${ESC}a\x01`);

  // Header
  commands.push(`${ESC}!\x30`);
  commands.push(`${storeTitle}\n`);
  commands.push(`${ESC}!\x00`);
  commands.push(centerText('SALES RECEIPT', width) + '\n');
  commands.push('\n');

  // Meta
  commands.push(`${ESC}a\x00`);
  commands.push(formatTwoColumn(`ORDER #${r.orderNo}`, r.dateTime, width) + '\n');
  if (r.salesBy) commands.push(formatLine(`Sales By: ${r.salesBy}`, width) + '\n');
  commands.push('='.repeat(width) + '\n');
  commands.push('\n');

  // Customer
  if (r.customerName || r.customerPhone || (r.customerAddressLines && r.customerAddressLines.length)) {
    commands.push(`${ESC}!\x08`);
    commands.push('CUSTOMER\n');
    commands.push(`${ESC}!\x00`);
    if (r.customerName) commands.push(`Name: ${r.customerName}\n`);
    if (r.customerPhone) commands.push(`Phone: ${r.customerPhone}\n`);
    if (r.customerAddressLines && r.customerAddressLines.length) {
      commands.push('Address:\n');
      for (const line of r.customerAddressLines.slice(0, 4)) {
        commands.push(`  ${line}\n`);
      }
    }
    commands.push('\n');
  }

  // Items
  commands.push(`${ESC}!\x08`);
  commands.push('ITEMS\n');
  commands.push(`${ESC}!\x00`);
  commands.push('='.repeat(width) + '\n');

  for (const it of r.items) {
    const name = (it.name || 'Item').trim();
    const line1 = name.length > 40 ? name.slice(0, 37) + '...' : name;
    commands.push(`${line1}${it.variant ? ` (${it.variant})` : ''}\n`);
    commands.push(
      formatTwoColumn(
        `  x${it.qty} @ Tk${Math.round(it.unitPrice)}`,
        `Tk${Math.round(it.lineTotal).toLocaleString()}`,
        width
      ) + '\n'
    );

    if (it.barcodes && it.barcodes.length) {
      commands.push(`  Barcodes: ${it.barcodes.slice(0, 3).join(', ')}\n`);
    }
    commands.push('\n');
  }

  commands.push('='.repeat(width) + '\n');
  commands.push('\n');

  // Totals
  commands.push(formatTwoColumn('Subtotal:', `Tk${Math.round(r.totals.subtotal).toLocaleString()}`, width) + '\n');
  if (r.totals.discount > 0) {
    commands.push(formatTwoColumn('Discount:', `-Tk${Math.round(r.totals.discount).toLocaleString()}`, width) + '\n');
  }
  if (r.totals.tax > 0) {
    commands.push(formatTwoColumn('Tax/VAT:', `Tk${Math.round(r.totals.tax).toLocaleString()}`, width) + '\n');
  }
  if (r.totals.shipping > 0) {
    commands.push(formatTwoColumn('Shipping:', `Tk${Math.round(r.totals.shipping).toLocaleString()}`, width) + '\n');
  }
  commands.push('-'.repeat(width) + '\n');

  commands.push(`${ESC}!\x18`);
  commands.push(formatTwoColumn('TOTAL:', `Tk${Math.round(r.totals.total).toLocaleString()}`, width) + '\n');
  commands.push(`${ESC}!\x00`);
  commands.push('\n');

  commands.push(formatTwoColumn('Paid:', `Tk${Math.round(r.totals.paid).toLocaleString()}`, width) + '\n');
  if (r.totals.due > 0) {
    commands.push(`${ESC}!\x08`);
    commands.push(formatTwoColumn('DUE:', `Tk${Math.round(r.totals.due).toLocaleString()}`, width) + '\n');
    commands.push(`${ESC}!\x00`);
  }
  if (r.totals.change > 0) {
    commands.push(formatTwoColumn('Change:', `Tk${Math.round(r.totals.change).toLocaleString()}`, width) + '\n');
  }

  if (r.notes) {
    commands.push('\n');
    commands.push('Notes:\n');
    commands.push(formatLine(r.notes, width) + '\n');
  }

  // Footer
  commands.push('\n');
  commands.push('='.repeat(width) + '\n');
  commands.push(`${ESC}a\x01`);
  commands.push('THANK YOU\n');
  commands.push('This is a computer-generated receipt\n');
  commands.push('\n\n\n');

  // Cut
  commands.push(`${GS}V\x41\x00`);

  return commands;
}

function formatLine(text: string, width: number = 48): string {
  return text.padEnd(width).substring(0, width);
}

function formatTwoColumn(left: string, right: string, width: number = 48): string {
  const rightLen = right.length;
  const leftLen = width - rightLen;
  return left.padEnd(leftLen).substring(0, leftLen) + right;
}

function centerText(text: string, width: number = 48): string {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
}

export async function printReceipt(order: any, printerName?: string): Promise<boolean> {
  try {
    await connectQZ();

    const qz = getQZ();
    if (!qz) throw new Error('QZ Tray not available');

    const printer = printerName || (await getPreferredPrinter());
    if (!printer) throw new Error('No printer selected');

    const config = qz.configs.create(printer);
    const receiptData = generateReceiptData(order);

    await qz.print(config, receiptData);
    console.log(`✅ Receipt printed for order #${order?.id ?? ''}`);
    return true;
  } catch (error) {
    console.warn('ℹ️ QZ print unavailable, opening receipt preview (browser print / Save as PDF).', error);
    try {
      openReceiptPreview(order);
      return true;
    } catch (e) {
      console.error('❌ Failed to open receipt preview:', e);
      return false;
    }
  }
}

export async function printBulkReceipts(
  orders: any[],
  printerName?: string
): Promise<{ successCount: number; failCount: number }> {
  try {
    await connectQZ();

    const qz = getQZ();
    if (!qz) throw new Error('QZ Tray not available');

    const printer = printerName || (await getPreferredPrinter());
    if (!printer) throw new Error('No printer selected');

    const config = qz.configs.create(printer);

    let successCount = 0;
    let failCount = 0;

    for (const order of orders) {
      try {
        const receiptData = generateReceiptData(order);
        await qz.print(config, receiptData);
        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`❌ Failed to print order #${order?.id ?? ''}:`, err);
        failCount++;
      }
    }

    return { successCount, failCount };
  } catch (error) {
    console.warn('ℹ️ QZ bulk print unavailable, opening bulk receipt preview (browser print / Save as PDF).', error);
    try {
      openBulkReceiptPreview(orders);
      return { successCount: 0, failCount: 0 };
    } catch (e) {
      console.error('❌ Failed to open bulk receipt preview:', e);
      return { successCount: 0, failCount: orders.length };
    }
  }
}

export async function checkQZStatus(): Promise<{
  connected: boolean;
  version?: string;
  error?: string;
}> {
  const qz = getQZ();
  if (!qz?.websocket) {
    return { connected: false, error: 'QZ Tray not loaded' };
  }

  // If already active, don't call connect again
  if (isActiveSocket() || qzConnected) {
    return {
      connected: true,
      version: qz.version || 'Unknown',
    };
  }

  // Try connecting once (safe connect)
  try {
    await connectQZ();
    return {
      connected: true,
      version: qz.version || 'Unknown',
    };
  } catch (error: any) {
    return {
      connected: false,
      error: getErrMsg(error) || 'QZ Tray not running',
    };
  }
}
