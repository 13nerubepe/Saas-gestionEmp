import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@/environments/environment';
import { CrmService } from './crm.service';

const CLIENTS_URL = `${environment.apiUrl}/crm/clients`;

describe('CrmService', () => {
    let service: CrmService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        service = TestBed.inject(CrmService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('lists clients with the page and a trimmed search', () => {
        service.listClients(2, '  mbarga ').subscribe();
        const req = http.expectOne((r) => r.url === `${CLIENTS_URL}/`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('page')).toBe('2');
        expect(req.request.params.get('search')).toBe('mbarga');
        req.flush({ count: 0, next: null, previous: null, results: [] });
    });

    it('sends no search parameter when the search is blank', () => {
        service.listClients(1, '   ').subscribe();
        const req = http.expectOne((r) => r.url === `${CLIENTS_URL}/`);
        expect(req.request.params.has('search')).toBeFalse();
        req.flush({ count: 0, next: null, previous: null, results: [] });
    });

    it('records an interaction on the client', () => {
        const payload = { kind: 'call' as const, occurred_at: '2026-11-05T10:00:00.000Z', summary: 'Appel de prospection' };
        service.recordInteraction('abc', payload).subscribe();
        const req = http.expectOne(`${CLIENTS_URL}/abc/interactions/`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(payload);
        req.flush({});
    });

    it('updates a client with PUT', () => {
        service.updateClient('abc', { name: 'Acme' } as never).subscribe();
        const req = http.expectOne(`${CLIENTS_URL}/abc/`);
        expect(req.request.method).toBe('PUT');
        req.flush({});
    });
});
