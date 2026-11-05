import { displayStatus, formatMoney, lineTotals, roundAmount } from './money';
import { Invoice } from './billing.service';

// Same figures as the API tests (billing/tests/test_services.py): the preview must match.
describe('invoice amounts', () => {
    it('rounds half up to the currency decimals', () => {
        expect(roundAmount(8662.5, 0)).toBe(8663);
        expect(roundAmount(1925.1925, 0)).toBe(1925);
        expect(roundAmount(10.005, 2)).toBe(10.01);
    });

    it('computes a line like the API: round the line, then its tax', () => {
        expect(lineTotals(3, 15000, 19.25, 0)).toEqual({ subtotal: 45000, tax: 8663 });
        expect(lineTotals(1, 10001, 19.25, 0)).toEqual({ subtotal: 10001, tax: 1925 });
        expect(lineTotals(2, 5000, 0, 0)).toEqual({ subtotal: 10000, tax: 0 });
    });

    it('formats XAF the French way, without centimes', () => {
        // fr-FR groups thousands with a narrow no-break space.
        expect(formatMoney('65589.00', 'XAF').replace(/\s/g, ' ')).toBe('65 589 FCFA');
    });

    it('shows an unpaid invoice past its due date as overdue, never a paid one', () => {
        const invoice = { status: 'issued', is_overdue: true } as Invoice;
        expect(displayStatus(invoice)).toBe('overdue');
        expect(displayStatus({ ...invoice, is_overdue: false })).toBe('issued');
        expect(displayStatus({ ...invoice, status: 'draft' })).toBe('draft');
        expect(displayStatus({ ...invoice, status: 'paid' })).toBe('paid');
    });
});
