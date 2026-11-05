import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

export interface Company {
    id: string;
    name: string;
    country: string;
    currency: string;
    legal_form: string;
    tax_id: string;
}

export type CompanyPayload = Partial<Pick<Company, 'name' | 'legal_form' | 'tax_id'>>;

/** The active company: every member reads it, only a founder edits it. */
@Injectable({ providedIn: 'root' })
export class CompanyService {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/auth/company/`;

    get(): Observable<Company> {
        return this.http.get<Company>(this.url);
    }

    update(payload: CompanyPayload): Observable<Company> {
        return this.http.patch<Company>(this.url, payload);
    }
}
