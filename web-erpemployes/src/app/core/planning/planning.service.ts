import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { FollowUp } from '@/app/core/crm/crm.service';

export interface OverdueInvoice {
    id: string;
    number: string;
    client_id: string;
    client_name: string;
    balance_due: string;
    due_date: string;
    days_late: number;
}

export type MyDayAlert = { code: 'cash_below_threshold'; amount: string; threshold: string } | { code: 'cash_forecast_risk'; date: string } | { code: 'draft_invoices'; count: number };

/** US-06. Financial blocks are null for employees. */
export interface MyDay {
    today: string;
    follow_ups: FollowUp[];
    follow_up_count: number;
    overdue_invoices: OverdueInvoice[] | null;
    overdue_invoice_count: number | null;
    overdue_total: string | null;
    alerts: MyDayAlert[] | null;
    currency: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
    private readonly http = inject(HttpClient);

    myDay(): Observable<MyDay> {
        return this.http.get<MyDay>(`${environment.apiUrl}/planning/my-day/`);
    }
}
