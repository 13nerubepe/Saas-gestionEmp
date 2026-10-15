import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './auth/auth.models';

// Messages per stable API error code (see `code` in API error bodies).
const MESSAGES_BY_CODE: Record<string, string> = {
    no_active_account: 'Email ou mot de passe incorrect.',
    authentication_failed: 'Email ou mot de passe incorrect.',
    not_authenticated: 'Votre session a expiré. Reconnectez-vous.',
    permission_denied: "Vous n'avez pas accès à cette action.",
    throttled: 'Trop de tentatives. Réessayez dans une minute.',
    llm_unavailable: "Le service d'IA est momentanément indisponible. Réessayez plus tard."
};

/** A message to show the user for any failed API call. */
export function apiErrorMessage(error: unknown, fallback = 'Une erreur est survenue. Réessayez.'): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 0) return 'Serveur injoignable. Vérifiez que le backend est démarré.';

    const body = (error.error ?? {}) as ApiError;
    if (body.code && MESSAGES_BY_CODE[body.code]) return MESSAGES_BY_CODE[body.code];
    if (typeof body.detail === 'string') return body.detail;

    // Validation errors: { field: ["message", ...] } — show the first one.
    for (const value of Object.values(body)) {
        if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
    return fallback;
}
