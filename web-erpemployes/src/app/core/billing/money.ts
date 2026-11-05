import { Invoice } from './billing.service';

/** "119250.00" + XAF → "119 250 FCFA" (French formatting, the currency's own decimals). */
export function formatMoney(amount: string | number, currency: string, decimals?: number): string {
    const value = typeof amount === 'number' ? amount : Number(amount);
    const options: Intl.NumberFormatOptions = { style: 'currency', currency };
    if (decimals !== undefined) {
        options.minimumFractionDigits = decimals;
        options.maximumFractionDigits = decimals;
    }
    return new Intl.NumberFormat('fr-FR', options).format(Number.isFinite(value) ? value : 0);
}

/** Half-up rounding to `decimals`, as the API does (amounts are positive). */
export function roundAmount(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface LineTotals {
    subtotal: number;
    tax: number;
}

/**
 * Preview of a line's amounts while the founder types. The API recomputes
 * them on save with the same rule: round the line, then round its tax.
 */
export function lineTotals(quantity: number, unitPrice: number, ratePercent: number, decimals: number): LineTotals {
    const subtotal = roundAmount(quantity * unitPrice, decimals);
    return { subtotal, tax: roundAmount((subtotal * ratePercent) / 100, decimals) };
}

export type InvoiceDisplayStatus = 'draft' | 'issued' | 'overdue';

export function displayStatus(invoice: Invoice): InvoiceDisplayStatus {
    if (invoice.status === 'draft') return 'draft';
    return invoice.is_overdue ? 'overdue' : 'issued';
}

export const INVOICE_STATUS_LABELS: Record<InvoiceDisplayStatus, string> = {
    draft: 'Brouillon',
    issued: 'Émise',
    overdue: 'En retard'
};

export const INVOICE_STATUS_SEVERITY: Record<InvoiceDisplayStatus, 'secondary' | 'info' | 'danger'> = {
    draft: 'secondary',
    issued: 'info',
    overdue: 'danger'
};
