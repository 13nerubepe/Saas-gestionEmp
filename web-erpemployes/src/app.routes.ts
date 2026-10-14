import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { AppConstantRoute } from '@/app/constants';

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
        children: [

            { path: '', component: Dashboard },

            {
                path: AppConstantRoute.Activated_Desactived_PATH_PATH,
                loadComponent: () => import('./app/pages/activated-desactived/activated-desactived').then((c) => c.ActivatedDesactived),
                data: { breadcrumb: 'Actived-desactived' },
            },
            {
                path: AppConstantRoute.Created_PATH,
                loadComponent: () => import('./app/pages/create-user-entreprise/create-user').then((c) => c.CreateUser),
                data: { breadcrumb: 'Create' },
            },
            {
                path: AppConstantRoute.Liste_Tableau_PATH,
                loadComponent: () => import('./app/pages/activated-desactived/activated-desactived').then((c) => c.ActivatedDesactived),
                data: { breadcrumb: 'Actived-desactived' },
            },
            // {
            //     path: AppConstantRoute.Actualite_PATH,
            //     loadComponent: () => import('./app/pages/create-user-entreprise/create-user').then((c) => c.CreateUser),
            //     data: { breadcrumb: 'Create' },
            // },

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
