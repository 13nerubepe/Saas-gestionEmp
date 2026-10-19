import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '@/environments/environment';
import { AccessToken, RegisterPayload, User } from './auth.models';
import { AccessRequestPayload, AccessRequestResponse, AuthResponse, LoginPayload } from '@/app/model';
// import { AccessToken, ProfileUpdate, RegisterPayload, User } from './auth.models';

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

    // Le token d'accès reste en mémoire.
    private readonly accessToken = signal<string | null>(null);
    private refreshInFlight: Observable<string> | null = null;

    readonly user = signal<User | null>(null);

    /**
     * Vérifie si un token d'accès est présent.
     */
    readonly isAuthenticated = computed(() => this.accessToken() !== null);
    /** Company the user works in. First membership until a company switcher exists. */
    readonly activeMembership = computed(() => this.user()?.memberships[0] ?? null);
    /** Company sent in X-Company-ID. */
    readonly activeCompanyId = computed(() => this.activeMembership()?.company_id ?? null);
    /** Founders only: asking the legal agent, for instance. */
    readonly isFounder = computed(() => this.activeMembership()?.role === 'founder');
    /** Company sent in X-Company-ID. First membership until a company switcher exists. */
        // Première entreprise associée à l'utilisateur connecté.
    // readonly activeCompanyId = computed(() => this.user()?.memberships[0]?.company_id ?? null);

    get token(): string | null {
        return this.accessToken();
    }

    /**
     * Connexion et récupération des tokens JWT.
     */
    login(email: string, password: string): Observable<User> {
        return this.http.post<AccessToken>(`${AUTH_URL}/login/`, { email, password }, { withCredentials: true }).pipe(
            tap(({ access }) => this.accessToken.set(access)),
            switchMap(() => this.loadCurrentUser())
        );
    }

    /**
     * Inscription du fondateur et création de son entreprise.
     */
    register(payload: RegisterPayload): Observable<User> {
        return this.http.post<User>(`${AUTH_URL}/register/`, payload);
    }

    /**
     * Récupération du profil connecté.
     */
    loadCurrentUser(): Observable<User> {
        return this.http.get<User>(`${AUTH_URL}/me/`).pipe(tap((user) => this.user.set(user)));
    }

    // /** Name and language. The language also sets the language of agent answers. */
    // updateProfile(changes: ProfileUpdate): Observable<User> {
    //     return this.http.patch<User>(`${AUTH_URL}/me/`, changes).pipe(tap((user) => this.user.set(user)));
    // }

    /** New access token from the refresh cookie. Concurrent callers share one request. */
    /**
     * Récupération d'un nouveau token depuis le cookie de rafraîchissement.
     */
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

    /**
     * Déconnexion locale.
     */
    logout(): void {
        this.http
            .post(`${AUTH_URL}/logout/`, {}, { withCredentials: true })
            .pipe(catchError(() => of(null)))
            .subscribe(() => {
                this.clear();
                this.router.navigate(['/auth/login']);
            });
    }

    /**
     * Suppression des données de session en mémoire.
     */
    clear(): void {
        this.accessToken.set(null);
        this.user.set(null);
    }

    /**
     * Retourne le token d'accès actuel.
     */
    getAccessToken(): string | null {
        return this.accessToken();
    }

    /**
     * Envoi d'une demande d'accès à l'administration.
     */
    // submitRequest(
    //     payload: AccessRequestPayload
    // ): Observable<unknown> {
    //     return this.http.post<unknown>(
    //         `${AUTH_URL}/access-requests/`,
    //         payload
    //     );
    // }

    submitRequest(
        payload: AccessRequestPayload
    ): Observable<AccessRequestResponse> {
        return this.http.post<AccessRequestResponse>(
            `${AUTH_URL}/access-requests/`,
            payload
        );
    }

    /**
     * Récupération de la liste des utilisateurs.
     * À utiliser uniquement lorsque le backend expose cette route.
     */
    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(`${AUTH_URL}/users/`);
    }

    /**
     * Récupération d'un utilisateur par son identifiant.
     * À adapter selon les routes réellement exposées par le backend.
     */
    getUserById(id: string): Observable<User> {
        return this.http.get<User>(
            `${AUTH_URL}/users/${encodeURIComponent(id)}/`
        );
    }

    /**
     * Modification du profil de l'utilisateur connecté.
     * Seuls first_name, last_name et language sont modifiables.
     */
    updateCurrentUser(payload: Partial<Pick<User, 'first_name' | 'last_name' | 'language'>>): Observable<User> {
        return this.http.patch<User>(`${AUTH_URL}/me/`, payload).pipe(
            tap((user) => this.user.set(user))
        );
    }


    // envoyerDemande(payload: AccessRequestPayload): Observable<{ message: string }> {
    //     return this.http.post<{ message: string }>(
    //         `${AUTH_URL}/access-requests/`,
    //         payload
    //     );
    // }
}
