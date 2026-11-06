import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { Page } from '@/app/core/page';

// Mirrors the API contract (tag "advisor" in /api/docs/).
const ADVISOR_URL = `${environment.apiUrl}/advisor`;

export type AdvisorConfidence = 'high' | 'medium' | 'low';

/** A fact computed by the application that the answer relies on. */
export interface AdvisorSource {
    number: number;
    topic: string;
    text: string;
    link_type: '' | 'client' | 'invoice';
    link_id: string;
}

export interface AdvisorExchange {
    id: string;
    kind: 'question' | 'reminder';
    question: string;
    invoice_id: string | null;
    subject: string;
    answer: string;
    confidence: AdvisorConfidence;
    referral: boolean;
    referral_text: string;
    sources: AdvisorSource[];
    disclaimer: string;
    model_name: string;
    created_at: string;
}

export type ReminderChannel = 'whatsapp' | 'email';
export type ReminderTone = 'friendly' | 'firm';

/** The financial and commercial advisor agent. Founders only. */
@Injectable({ providedIn: 'root' })
export class AdvisorService {
    private readonly http = inject(HttpClient);

    ask(question: string): Observable<AdvisorExchange> {
        return this.http.post<AdvisorExchange>(`${ADVISOR_URL}/questions/`, { question });
    }

    /** The current user's past questions, newest first. */
    history(page = 1): Observable<Page<AdvisorExchange>> {
        return this.http.get<Page<AdvisorExchange>>(`${ADVISOR_URL}/questions/`, { params: new HttpParams().set('page', page) });
    }

    /** A reminder draft the founder reviews and sends: the agent sends nothing. */
    draftReminder(invoiceId: string, channel: ReminderChannel, tone: ReminderTone): Observable<AdvisorExchange> {
        return this.http.post<AdvisorExchange>(`${ADVISOR_URL}/invoices/${invoiceId}/reminder/`, { channel, tone });
    }
}
