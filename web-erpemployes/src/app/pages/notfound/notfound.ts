import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
    selector: 'app-notfound',
    standalone: true,
    imports: [RouterModule, ButtonModule],
    template: `
        <div class="flex min-h-screen items-center justify-center bg-surface-100 p-4 dark:bg-surface-950">
            <div class="w-full max-w-md rounded-3xl border border-surface-200 bg-white p-10 text-center shadow-xl dark:border-surface-700 dark:bg-surface-900">
                <div class="text-6xl font-bold text-primary">404</div>
                <h1 class="mb-2 mt-4 !text-2xl font-semibold">Page introuvable</h1>
                <p class="mb-8 mt-0 text-surface-500">Cette page n'existe pas ou a été déplacée.</p>
                <p-button label="Retour au tableau de bord" icon="pi pi-home" routerLink="/" />
            </div>
        </div>
    `
})
export class Notfound {}
