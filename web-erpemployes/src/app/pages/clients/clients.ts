import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Client, CrmService } from '@/app/core/crm/crm.service';
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, CLIENT_STATUS_SEVERITY } from '@/app/core/crm/crm-labels';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { EmptyState } from '@/app/commons/empty-state';
import { mediaQuery, NARROW_SCREEN } from '@/app/commons/media';
import { PageHeader } from '@/app/commons/page-header';
import { ClientForm } from './client-form';

/**
 * US-03: the company's clients and prospects, searchable.
 * A table on wide screens, a list of cards on phones (one or the other is
 * rendered, never both, so each client appears once in the page).
 */
@Component({
    selector: 'app-clients',
    standalone: true,
    imports: [DatePipe, FormsModule, RouterLink, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, SkeletonModule, TableModule, TagModule, ClientForm, EmptyState, PageHeader],
    template: `
        <app-page-header title="Clients et prospects" [subtitle]="subtitle()">
            <p-button label="Nouveau client" icon="pi pi-plus" (onClick)="formVisible.set(true)" />
        </app-page-header>

        <div class="card !mb-0 flex flex-col gap-4">
            <form role="search" (ngSubmit)="search()">
                <p-iconfield class="w-full md:w-96">
                    <p-inputicon class="pi pi-search" />
                    <input pInputText type="search" name="query" class="w-full" [(ngModel)]="query" placeholder="Nom, contact, email, téléphone" aria-label="Rechercher un client" enterkeyhint="search" (search)="search()" />
                </p-iconfield>
            </form>

            @if (error()) {
                <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                    <span><i class="pi pi-exclamation-circle mr-2"></i>{{ error() }}</span>
                    <p-button label="Réessayer" icon="pi pi-refresh" size="small" [text]="true" severity="danger" (onClick)="loadPage(page)" />
                </div>
            }

            @if (loading() && clients().length === 0) {
                <!-- First load: placeholders keep the layout stable on a slow network. -->
                <div class="flex flex-col gap-3" aria-busy="true" aria-label="Chargement des clients">
                    @for (i of [1, 2, 3]; track i) {
                        <p-skeleton height="4rem" borderRadius="0.75rem" />
                    }
                </div>
            } @else if (clients().length === 0) {
                @if (!error()) {
                    @if (activeQuery) {
                        <app-empty-state icon="pi-search" title="Aucun client ne correspond à cette recherche." text="Vérifiez l'orthographe ou cherchez par numéro de téléphone.">
                            <p-button label="Effacer la recherche" icon="pi pi-times" [outlined]="true" (onClick)="clearSearch()" />
                        </app-empty-state>
                    } @else {
                        <app-empty-state icon="pi-users" title="Aucun client pour l'instant." text="Créez une fiche pour chaque client ou prospect : vous y noterez vos appels, rendez-vous et messages.">
                            <p-button label="Créer une fiche client" icon="pi pi-plus" [outlined]="true" (onClick)="formVisible.set(true)" />
                        </app-empty-state>
                    }
                }
            } @else if (narrow()) {
                <ul class="m-0 flex list-none flex-col gap-3 p-0" [class.opacity-60]="loading()">
                    @for (client of clients(); track client.id) {
                        <li>
                            <a
                                [routerLink]="['/', clientsPath, client.id]"
                                class="flex flex-col gap-2 rounded-xl border border-surface-200 p-4 text-color no-underline transition-colors hover:border-primary active:bg-surface-50 dark:border-surface-700 dark:active:bg-surface-800"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <div class="font-semibold text-surface-900 dark:text-surface-0">{{ client.name }}</div>
                                        <div class="text-xs text-muted-color">
                                            {{ kindLabel(client) }}
                                            @if (client.city) {
                                                · {{ client.city }}
                                            }
                                        </div>
                                    </div>
                                    <p-tag class="shrink-0 whitespace-nowrap" [value]="statusLabel(client)" [severity]="statusSeverity(client)" />
                                </div>
                                @if (client.contact_name || client.phone || client.email) {
                                    <div class="flex items-center gap-2 text-sm">
                                        <i class="pi pi-user text-xs text-muted-color" aria-hidden="true"></i>
                                        <span class="truncate"
                                            >{{ client.contact_name }}
                                            @if (client.contact_name && (client.phone || client.email)) {
                                                ·
                                            }
                                            {{ client.phone || client.email }}</span
                                        >
                                    </div>
                                }
                                <div class="flex items-center gap-2 text-xs text-muted-color">
                                    <i class="pi pi-history text-xs" aria-hidden="true"></i>
                                    @if (client.last_interaction_at) {
                                        Dernier échange le {{ client.last_interaction_at | date: 'd MMM y' }} ({{ client.interaction_count }})
                                    } @else {
                                        Aucun échange
                                    }
                                </div>
                            </a>
                        </li>
                    }
                </ul>
            } @else {
                <p-table [value]="clients()" dataKey="id" [tableStyle]="{ 'min-width': '40rem' }" [class.opacity-60]="loading()">
                    <ng-template #header>
                        <tr>
                            <th>Nom</th>
                            <th>Statut</th>
                            <th>Contact</th>
                            <th>Ville</th>
                            <th>Dernier échange</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-client>
                        <tr class="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800" tabindex="0" [attr.aria-label]="'Ouvrir la fiche ' + client.name" (click)="open(client)" (keydown.enter)="open(client)">
                            <td>
                                <div class="font-medium">{{ client.name }}</div>
                                <div class="text-xs text-muted-color">{{ kindLabel(client) }}</div>
                            </td>
                            <td><p-tag class="whitespace-nowrap" [value]="statusLabel(client)" [severity]="statusSeverity(client)" /></td>
                            <td>
                                <div>{{ client.contact_name }}</div>
                                <div class="text-xs text-muted-color">{{ client.phone || client.email }}</div>
                            </td>
                            <td>{{ client.city }}</td>
                            <td>
                                @if (client.last_interaction_at) {
                                    {{ client.last_interaction_at | date: 'd MMM y' }}
                                    <span class="text-xs text-muted-color">({{ client.interaction_count }})</span>
                                } @else {
                                    <span class="text-muted-color">Aucun</span>
                                }
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            }

            @if (hasMore()) {
                <div class="flex justify-center">
                    <p-button label="Charger plus" icon="pi pi-angle-down" [text]="true" [loading]="loading()" (onClick)="loadPage(page + 1)" />
                </div>
            }
        </div>

        <app-client-form [(visible)]="formVisible" (saved)="open($event)" />
    `
})
export class Clients implements OnInit {
    private readonly crm = inject(CrmService);
    private readonly router = inject(Router);

    /** `?nouveau=1` (dashboard shortcut) opens the creation form directly. */
    readonly nouveau = input<string>();

    readonly clients = signal<Client[]>([]);
    readonly loading = signal(false);
    readonly hasMore = signal(false);
    readonly error = signal('');
    readonly formVisible = signal(false);
    /** Total from the API for the current search, null until the first answer. */
    readonly total = signal<number | null>(null);
    readonly narrow = mediaQuery(NARROW_SCREEN);
    readonly clientsPath = AppConstantRoute.Clients_PATH;

    readonly subtitle = computed(() => {
        const total = this.total();
        if (total === null) return 'Vos fiches clients et l’historique de vos échanges.';
        const plural = total > 1 ? 's' : '';
        return this.searchedFor() ? `${total} résultat${plural} pour « ${this.searchedFor()} »` : `${total} fiche${plural} client${plural}`;
    });
    // Signal copy of activeQuery for the subtitle (activeQuery is a plain field).
    private readonly searchedFor = signal('');

    query = '';
    activeQuery = '';
    page = 1;

    ngOnInit(): void {
        this.loadPage(1);
        if (this.nouveau()) {
            this.formVisible.set(true);
            // Drop the parameter so a reload or "back" does not reopen the form.
            this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
    }

    // Typed helpers: p-table rows are untyped in the template.
    kindLabel(client: Client): string {
        return CLIENT_KIND_LABELS[client.kind];
    }

    statusLabel(client: Client): string {
        return CLIENT_STATUS_LABELS[client.status];
    }

    statusSeverity(client: Client) {
        return CLIENT_STATUS_SEVERITY[client.status];
    }

    search(): void {
        this.activeQuery = this.query.trim();
        this.loadPage(1);
    }

    clearSearch(): void {
        this.query = '';
        this.search();
    }

    open(client: Client): void {
        this.router.navigate(['/', AppConstantRoute.Clients_PATH, client.id]);
    }

    loadPage(page: number): void {
        this.loading.set(true);
        this.error.set('');
        this.crm.listClients(page, this.activeQuery).subscribe({
            next: (result) => {
                this.page = page;
                this.clients.update((list) => (page === 1 ? result.results : [...list, ...result.results]));
                this.hasMore.set(result.next !== null);
                this.total.set(result.count);
                this.searchedFor.set(this.activeQuery);
                this.loading.set(false);
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }
}
