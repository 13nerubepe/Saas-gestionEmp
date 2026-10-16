import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { AppConstantRoute } from '@/app/constants';
import { authGuard } from '@/app/core/auth/auth.guard';

export const appRoutes: Routes = [
    // Redirection par défaut vers la page Login
    // {
    //     path: '',
    //     redirectTo: 'auth/login',
    //     pathMatch: 'full' },

    {

        // Pages protégées avec le layout principal
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [

            { path: '', component: Dashboard },

            {
                path: AppConstantRoute.Dashbord_PATH,
                loadComponent: () => import('./app/pages/dashboard/dashboard').then((c) => c.Dashboard),
                data: { breadcrumb: 'Dashboard' },
            },

            {
                path: AppConstantRoute.Activated_Desactived_PATH,
                loadComponent: () => import('./app/pages/activated-desactived/activated-desactived').then((c) => c.ActivatedDesactived),
                data: { breadcrumb: 'Actived-desactived' },
            },
            {
                path: AppConstantRoute.Created_PATH,
                loadComponent: () => import('./app/pages/create-user-entreprise/create-user-entreprise').then((c) => c.CreateUserEntreprise),
                data: { breadcrumb: 'Create' },
            },
            {
                path: AppConstantRoute.Liste_Tableau_PATH,
                loadComponent: () => import('./app/pages/activated-desactived/activated-desactived').then((c) => c.ActivatedDesactived),
                data: { breadcrumb: 'Actived-desactived' },
            },
            {
                path: AppConstantRoute.Permission_PATH,
                loadComponent: () => import('@/app/pages/page-permissions/pages-permissions').then((c) => c.PagesPermissions),
                data: { breadcrumb: 'Gestion desPermision et Roles' },
            },
            {
                path: AppConstantRoute.Gestion_Utilisateur_PATH,
                loadComponent: () => import('@/app/pages/gestio-utilisateurs/gestio-utilisateurs').then((c) => c.GestioUtilisateurs),
                data: { breadcrumb: 'Gestion des utilisateurs' },
            },

            // {
            //     path: AppConstantRoute.ComparaisonActif_PATH,
            //     loadComponent: () => import('@/app/pages/deconnection/deconnection').then((c) => c.ComparaisonActifComponent),
            //     data: { breadcrumb: 'ComparairéActifs' },
            // },

            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
            { path: 'documentation', component: Documentation },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    // Routes d'authentification
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
