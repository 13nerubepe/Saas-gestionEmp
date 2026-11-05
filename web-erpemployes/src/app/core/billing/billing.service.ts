import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { Page } from '@/app/core/page';

// Mirrors the API contract (tag "billing" in /api/docs/). Amounts are decimal strings.
const BILLING_URL = `${environment.apiUrl}/billing`;

export type InvoiceStatus = 'draft' | 'issued';

export interface InvoiceLine {
    description: string;
    quantity: string;
    unit_price: string;
    tax_rate_code: string;
    tax_rate: string;
    subtotal: string;
    tax_amount: string;
}

export interface Invoice {
    id: string;
    number: string;
    status: InvoiceStatus;
    is_overdue: boolean;
    client_id: string;
    client_display_name: string;
    issue_date: string | null;
    due_date: string | null;
    currency: string;
    notes: string;
    subtotal: string;
    tax_total: string;
    total: string;
    lines: InvoiceLine[];
    seller_name: string;
    seller_tax_id: string;
    client_name: string;
    client_tax_id: string;
    client_address: string;
    created_at: string;
    updated_at: string;
}

export interface InvoiceLinePayload {
    description: string;
    quantity: string;
    unit_price: string;
    tax_rate_code: string;
}

export interface InvoicePayload {
    client: string;
    due_date: string | null;
    notes: string;
    lines: InvoiceLinePayload[];
}

export interface TaxRate {
    code: string;
    rate: string;
    label: string;
}

/** Invoicing rules of the active company's country. */
export interface InvoicingRules {
    country: string;
    currency: string;
    currency_decimals: number;
    default_tax_rate: string;
    tax_rates: TaxRate[];
}

export interface InvoiceFilters {
    status?: InvoiceStatus;
    overdue?: boolean;
    client?: string;
}

/** US-14 invoices of the active company. Founders only. */
@Injectable({ providedIn: 'root' })
export class BillingService {
    private readonly http = inject(HttpClient);

    listInvoices(page = 1, filters: InvoiceFilters = {}): Observable<Page<Invoice>> {
        let params = new HttpParams().set('page', page);
        if (filters.status) params = params.set('status', filters.status);
        if (filters.overdue) params = params.set('overdue', 'true');
        if (filters.client) params = params.set('client', filters.client);
        return this.http.get<Page<Invoice>>(`${BILLING_URL}/invoices/`, { params });
    }

    getInvoice(id: string): Observable<Invoice> {
        return this.http.get<Invoice>(`${BILLING_URL}/invoices/${id}/`);
    }

    createInvoice(payload: InvoicePayload): Observable<Invoice> {
        return this.http.post<Invoice>(`${BILLING_URL}/invoices/`, payload);
    }

    updateInvoice(id: string, payload: InvoicePayload): Observable<Invoice> {
        return this.http.put<Invoice>(`${BILLING_URL}/invoices/${id}/`, payload);
    }

    deleteInvoice(id: string): Observable<void> {
        return this.http.delete<void>(`${BILLING_URL}/invoices/${id}/`);
    }

    /** Gives the draft its number and freezes it. */
    issueInvoice(id: string): Observable<Invoice> {
        return this.http.post<Invoice>(`${BILLING_URL}/invoices/${id}/issue/`, null);
    }

    getRules(): Observable<InvoicingRules> {
        return this.http.get<InvoicingRules>(`${BILLING_URL}/rules/`);
    }
}
