import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

const AGENTS_URL = `${environment.apiUrl}/agents`;

export interface LegalSource {
    rank: number;
    jurisdiction: string;
    citation: string;
    title: string;
    content: string;
    source_url: string;
    effective_date: string | null;
}

export interface LegalAnswer {
    id: string;
    conversation_id: string;
    question: string;
    answer: string;
    found_sources: boolean;
    sources: LegalSource[];
    disclaimer: string;
    created_at: string;
}

export interface Conversation {
    id: string;
    title: string;
    created_at: string;
}

export interface ConversationDetail extends Conversation {
    exchanges: LegalAnswer[];
}

/** DRF page: `next` / `previous` are full URLs, or null. */
export interface Page<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

@Injectable({ providedIn: 'root' })
export class LegalService {
    private readonly http = inject(HttpClient);

    /** US-02. Omit `conversationId` to start a new conversation. */
    ask(question: string, conversationId?: string): Observable<LegalAnswer> {
        const body = conversationId ? { question, conversation_id: conversationId } : { question };
        return this.http.post<LegalAnswer>(`${AGENTS_URL}/legal/questions/`, body);
    }

    /** The current user's conversations in the active company, newest first (25 per page). */
    listConversations(page = 1): Observable<Page<Conversation>> {
        return this.http.get<Page<Conversation>>(`${AGENTS_URL}/conversations/`, { params: new HttpParams().set('page', page) });
    }

    getConversation(id: string): Observable<ConversationDetail> {
        return this.http.get<ConversationDetail>(`${AGENTS_URL}/conversations/${id}/`);
    }
}
