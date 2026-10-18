import { Routes } from '@angular/router';
import { Documentation } from './documentation/documentation';
import { Crud } from './crud/crud';
import { Empty } from './empty/empty';
import { ListeTableauDepartement } from './liste-tableau-departement/liste-tableau-departement';


export default [
    { path: 'documentation', component: Documentation },
    { path: 'crud', component: Crud },
    { path: 'empty', component: Empty },
    { path: 'departements', component: ListeTableauDepartement },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
