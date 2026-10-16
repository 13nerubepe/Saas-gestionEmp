import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Notfound } from './app/pages/notfound/notfound';
import { AppConstantRoute } from '@/app/constants';
import { authGuard } from '@/app/core/auth/auth.guard';

export const appRoutes: Routes = [
    {
        // Signed-in area, inside the main layout.
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: Dashboard, data: { breadcrumb: 'Tableau de bord' } },
            {
                path: AppConstantRoute.Legal_Assistant_PATH,
                loadComponent: () => import('./app/pages/legal-assistant/legal-assistant').then((c) => c.LegalAssistant),
                data: { breadcrumb: 'Assistant juridique' }
            },
            {
                path: AppConstantRoute.Profile_PATH,
                loadComponent: () => import('./app/pages/profile/profile').then((c) => c.Profile),
                data: { breadcrumb: 'Profil' }
            }
        ]
    },
    // Login and sign-up.
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: 'notfound', component: Notfound },
    { path: '**', redirectTo: '/notfound' }
];
