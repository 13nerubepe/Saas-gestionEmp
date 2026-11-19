import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { Page } from '@/app/core/page';

// Mirrors the API contract (tag "crm" in /api/docs/).
const CLIENTS_URL = `${environment.apiUrl}/crm/clients`;
const FOLLOW_UPS_URL = `${environment.apiUrl}/crm/follow-ups`;

export type ClientKind = 'company' | 'individual';
export type ClientStatus = 'prospect' | 'active' | 'inactive';
export type InteractionKind = 'call' | 'email' | 'meeting' | 'message' | 'note';

export interface Client {
    id: string;
    name: string;
    kind: ClientKind;
    status: ClientStatus;
    contact_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    tax_id: string;
    notes: string;
    interaction_count: number;
    last_interaction_at: string | null;
    /** Earliest open follow-up (US-05), or null. */
    next_follow_up_date: string | null;
    created_at: string;
    updated_at: string;
}

/** Fields the user can write. */
export type ClientPayload = Pick<Client, 'name' | 'kind' | 'status' | 'contact_name' | 'email' | 'phone' | 'address' | 'city' | 'country' | 'tax_id' | 'notes'>;

export interface Interaction {
    id: string;
    kind: InteractionKind;
    occurred_at: string;
    summary: string;
    created_by_email: string | null;
    created_at: string;
}

export type FollowUpChannel = '' | 'call' | 'whatsapp' | 'email' | 'meeting' | 'other';
export type FollowUpDue = 'today' | 'overdue' | 'upcoming' | 'done';

/** US-05: a dated reminder to get back to a client. */
export interface FollowUp {
    id: string;
    client_id: string;
    client_name: string;
    due_date: string;
    reason: string;
    channel: FollowUpChannel;
    status: 'open' | 'done';
    is_overdue: boolean;
    postponements: { from: string; to: string; at: string }[];
    done_at: string | null;
    outcome_summary: string | null;
    created_at: string;
}

export type FollowUpPayload = Pick<FollowUp, 'due_date' | 'reason' | 'channel'>;

export type InteractionPayload = Pick<Interaction, 'kind' | 'occurred_at' | 'summary'>;

/** US-03 client records and US-04 interaction history, in the active company. */
@Injectable({ providedIn: 'root' })
export class CrmService {
    private readonly http = inject(HttpClient);

    listClients(page = 1, search = ''): Observable<Page<Client>> {
        let params = new HttpParams().set('page', page);
        if (search.trim()) params = params.set('search', search.trim());
        return this.http.get<Page<Client>>(`${CLIENTS_URL}/`, { params });
    }

    getClient(id: string): Observable<Client> {
        return this.http.get<Client>(`${CLIENTS_URL}/${id}/`);
    }

    createClient(payload: ClientPayload): Observable<Client> {
        return this.http.post<Client>(`${CLIENTS_URL}/`, payload);
    }

    updateClient(id: string, payload: ClientPayload): Observable<Client> {
        return this.http.put<Client>(`${CLIENTS_URL}/${id}/`, payload);
    }

    deleteClient(id: string): Observable<void> {
        return this.http.delete<void>(`${CLIENTS_URL}/${id}/`);
    }

    /** Newest first. Interactions cannot be edited or deleted. */
    listInteractions(clientId: string, page = 1): Observable<Page<Interaction>> {
        return this.http.get<Page<Interaction>>(`${CLIENTS_URL}/${clientId}/interactions/`, { params: new HttpParams().set('page', page) });
    }

    recordInteraction(clientId: string, payload: InteractionPayload): Observable<Interaction> {
        return this.http.post<Interaction>(`${CLIENTS_URL}/${clientId}/interactions/`, payload);
    }

    /** US-05: a client's follow-ups, open ones first. */
    listClientFollowUps(clientId: string, due?: FollowUpDue): Observable<Page<FollowUp>> {
        let params = new HttpParams();
        if (due) params = params.set('due', due);
        return this.http.get<Page<FollowUp>>(`${CLIENTS_URL}/${clientId}/follow-ups/`, { params });
    }

    planFollowUp(clientId: string, payload: FollowUpPayload): Observable<FollowUp> {
        return this.http.post<FollowUp>(`${CLIENTS_URL}/${clientId}/follow-ups/`, payload);
    }

    /** The company's follow-ups, e.g. 'today' (due today or late) for "Ma journée". */
    listFollowUps(due?: FollowUpDue, page = 1): Observable<Page<FollowUp>> {
        let params = new HttpParams().set('page', page);
        if (due) params = params.set('due', due);
        return this.http.get<Page<FollowUp>>(`${FOLLOW_UPS_URL}/`, { params });
    }

    /** Closes the follow-up; the summary joins the client's history. */
    completeFollowUp(id: string, summary: string): Observable<FollowUp> {
        return this.http.post<FollowUp>(`${FOLLOW_UPS_URL}/${id}/complete/`, { summary });
    }

    postponeFollowUp(id: string, dueDate: string): Observable<FollowUp> {
        return this.http.post<FollowUp>(`${FOLLOW_UPS_URL}/${id}/postpone/`, { due_date: dueDate });
    }
}
