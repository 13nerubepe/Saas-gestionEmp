import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '@/environments/environment';
import { AuthService } from './auth.service';

// Endpoints that must never carry the access token nor trigger a refresh.
const PUBLIC_AUTH_PATHS = ['/auth/login/', '/auth/register/', '/auth/refresh/', '/auth/logout/'];

function isApiRequest(req: HttpRequest<unknown>): boolean {
    return req.url.startsWith(environment.apiUrl);
}

function isPublicAuthRequest(req: HttpRequest<unknown>): boolean {
    return PUBLIC_AUTH_PATHS.some((path) => req.url.endsWith(path));
}

/**
 * On API calls: adds `Authorization: Bearer <access>` and `X-Company-ID`.
 * On a 401, refreshes the access token once and replays the request; if the
 * refresh fails too, the session is over and the user goes back to login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    if (!isApiRequest(req) || isPublicAuthRequest(req)) {
        return next(req);
    }

    const auth = inject(AuthService);
    const router = inject(Router);

    const withAuth = (request: HttpRequest<unknown>, token: string | null) => {
        let headers = request.headers;
        if (token) headers = headers.set('Authorization', `Bearer ${token}`);
        const companyId = auth.activeCompanyId();
        if (companyId) headers = headers.set('X-Company-ID', companyId);
        return request.clone({ headers });
    };

    return next(withAuth(req, auth.token)).pipe(
        catchError((error: unknown) => {
            if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
                return throwError(() => error);
            }
            return auth.refresh().pipe(
                catchError((refreshError) => {
                    auth.clear();
                    router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url } });
                    return throwError(() => refreshError);
                }),
                switchMap((token) => next(withAuth(req, token)))
            );
        })
    );
};
