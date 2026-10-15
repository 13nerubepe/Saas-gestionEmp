import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '@/environments/environment';
import { AccessToken, RegisterPayload, User } from './auth.models';

const AUTH_URL = `${environment.apiUrl}/auth`;

/**
 * Session handling.
 *
 * The access token lives in memory only (never in localStorage, out of reach of
 * injected scripts). The refresh token is an httpOnly cookie set by the API on
 * /auth/: the browser sends it on its own when `withCredentials` is true. After
 * a page reload, `restoreSession()` exchanges that cookie for a new access token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);

    private readonly accessToken = signal<string | null>(null);
    private refreshInFlight: Observable<string> | null = null;

    readonly user = signal<User | null>(null);
    readonly isAuthenticated = computed(() => this.accessToken() !== null);
    /** Company sent in X-Company-ID. First membership until a company switcher exists. */
    readonly activeCompanyId = computed(() => this.user()?.memberships[0]?.company_id ?? null);

    get token(): string | null {
        return this.accessToken();
    }

    login(email: string, password: string): Observable<User> {
        return this.http.post<AccessToken>(`${AUTH_URL}/login/`, { email, password }, { withCredentials: true }).pipe(
            tap(({ access }) => this.accessToken.set(access)),
            switchMap(() => this.loadCurrentUser())
        );
    }

    register(payload: RegisterPayload): Observable<User> {
        return this.http.post<User>(`${AUTH_URL}/register/`, payload);
    }

    loadCurrentUser(): Observable<User> {
        return this.http.get<User>(`${AUTH_URL}/me/`).pipe(tap((user) => this.user.set(user)));
    }

    /** New access token from the refresh cookie. Concurrent callers share one request. */
    refresh(): Observable<string> {
        this.refreshInFlight ??= this.http.post<AccessToken>(`${AUTH_URL}/refresh/`, {}, { withCredentials: true }).pipe(
            map(({ access }) => access),
            tap((access) => this.accessToken.set(access)),
            finalize(() => (this.refreshInFlight = null)),
            shareReplay(1)
        );
        return this.refreshInFlight;
    }

    /** True when a valid refresh cookie gave us back a session. */
    restoreSession(): Observable<boolean> {
        return this.refresh().pipe(
            switchMap(() => this.loadCurrentUser()),
            map(() => true),
            catchError(() => {
                this.clear();
                return of(false);
            })
        );
    }

    logout(): void {
        this.http
            .post(`${AUTH_URL}/logout/`, {}, { withCredentials: true })
            .pipe(catchError(() => of(null)))
            .subscribe(() => {
                this.clear();
                this.router.navigate(['/auth/login']);
            });
    }

    clear(): void {
        this.accessToken.set(null);
        this.user.set(null);
    }
}
