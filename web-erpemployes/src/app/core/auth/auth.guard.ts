import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/** Protected pages: tries to restore the session from the refresh cookie first. */
export const authGuard: CanActivateFn = (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.isAuthenticated()) {
        return true;
    }
    return auth.restoreSession().pipe(map((restored) => restored || router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })));
};

/** Login and sign-up pages: an already signed-in user goes straight to the app. */
export const guestGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

/**
 * Founder-only pages (invoices, cash, advisor, legal assistant): an employee
 * goes back to "Ma journée". Runs after `authGuard` on the parent route, so
 * the user is loaded. The API refuses employees anyway; this keeps them
 * away from pages whose every action would fail.
 */
export const founderGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    return auth.isFounder() || inject(Router).createUrlTree(['/']);
};
