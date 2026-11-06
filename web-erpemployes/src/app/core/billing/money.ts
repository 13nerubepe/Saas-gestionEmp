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

export type InvoiceDisplayStatus = 'draft' | 'issued' | 'overdue' | 'paid' | 'cancelled' | 'credit_note';

export function displayStatus(invoice: Invoice): InvoiceDisplayStatus {
    if (invoice.kind === 'credit_note') return 'credit_note';
    if (invoice.status !== 'issued') return invoice.status;
    return invoice.is_overdue ? 'overdue' : 'issued';
}

export const INVOICE_STATUS_LABELS: Record<InvoiceDisplayStatus, string> = {
    draft: 'Brouillon',
    issued: 'Émise',
    overdue: 'En retard',
    paid: 'Payée',
    cancelled: 'Annulée',
    credit_note: 'Avoir'
};

export const INVOICE_STATUS_SEVERITY: Record<InvoiceDisplayStatus, 'secondary' | 'info' | 'danger' | 'success' | 'contrast'> = {
    draft: 'secondary',
    issued: 'info',
    overdue: 'danger',
    paid: 'success',
    cancelled: 'secondary',
    credit_note: 'contrast'
};

/** Labels of the cash movement categories (API codes). */
export const CASH_CATEGORY_LABELS: Record<string, string> = {
    opening_balance: 'Solde de départ',
    sale: 'Vente sans facture',
    owner_contribution: 'Apport du fondateur',
    loan: 'Emprunt',
    supplies: 'Achats et marchandises',
    rent: 'Loyer',
    staff: 'Personnel',
    transport: 'Transport',
    utilities: 'Eau, électricité, téléphone, internet',
    taxes: 'Impôts et taxes',
    bank_fees: 'Frais bancaires et Mobile Money',
    owner_withdrawal: 'Prélèvement du fondateur',
    other: 'Autre'
};

/** Categories offered for each direction, as the API accepts them. */
export const CASH_CATEGORIES_BY_DIRECTION: Record<'in' | 'out', string[]> = {
    in: ['sale', 'owner_contribution', 'loan', 'opening_balance', 'other'],
    out: ['supplies', 'rent', 'staff', 'transport', 'utilities', 'taxes', 'bank_fees', 'owner_withdrawal', 'other']
};
