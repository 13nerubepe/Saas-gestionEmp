import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

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

@Injectable({ providedIn: 'root' })
export class LegalService {
    private readonly http = inject(HttpClient);

    /** US-02. Omit `conversationId` to start a new conversation. */
    ask(question: string, conversationId?: string): Observable<LegalAnswer> {
        const body = conversationId ? { question, conversation_id: conversationId } : { question };
        return this.http.post<LegalAnswer>(`${environment.apiUrl}/agents/legal/questions/`, body);
    }
}
