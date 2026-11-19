import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Notfound } from './app/pages/notfound/notfound';
import { AppConstantRoute } from '@/app/constants';
import { authGuard, founderGuard } from '@/app/core/auth/auth.guard';

export const appRoutes: Routes = [
    {
        // Signed-in area, inside the main layout.
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: Dashboard, data: { breadcrumb: 'Ma journée' } },
            {
                path: AppConstantRoute.Legal_Assistant_PATH,
                loadComponent: () => import('./app/pages/legal-assistant/legal-assistant').then((c) => c.LegalAssistant),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Assistant juridique' }
            },
            {
                path: AppConstantRoute.Clients_PATH,
                loadComponent: () => import('./app/pages/clients/clients').then((c) => c.Clients),
                data: { breadcrumb: 'Clients' }
            },
            {
                path: `${AppConstantRoute.Clients_PATH}/:id`,
                loadComponent: () => import('./app/pages/clients/client-detail').then((c) => c.ClientDetail),
                data: { breadcrumb: 'Fiche client' }
            },
            {
                path: AppConstantRoute.Cash_PATH,
                loadComponent: () => import('./app/pages/cash/cash').then((c) => c.Cash),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Trésorerie' }
            },
            {
                path: AppConstantRoute.Advisor_PATH,
                loadComponent: () => import('./app/pages/advisor/advisor').then((c) => c.Advisor),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Conseiller financier' }
            },
            // Founder-only pages below: invoices, cash, advisor (the API refuses employees).
            // US-14 invoices. Static paths first: 'nouvelle' must not be read as an id.
            {
                path: AppConstantRoute.Invoices_PATH,
                loadComponent: () => import('./app/pages/invoices/invoices').then((c) => c.Invoices),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Factures' }
            },
            {
                path: `${AppConstantRoute.Invoices_PATH}/nouvelle`,
                loadComponent: () => import('./app/pages/invoices/invoice-editor').then((c) => c.InvoiceEditor),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Nouvelle facture' }
            },
            {
                path: `${AppConstantRoute.Invoices_PATH}/:id`,
                loadComponent: () => import('./app/pages/invoices/invoice-detail').then((c) => c.InvoiceDetail),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Facture' }
            },
            {
                path: `${AppConstantRoute.Invoices_PATH}/:id/modifier`,
                loadComponent: () => import('./app/pages/invoices/invoice-editor').then((c) => c.InvoiceEditor),
                canActivate: [founderGuard],
                data: { breadcrumb: 'Modifier la facture' }
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
