import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Client, CrmService } from '@/app/core/crm/crm.service';
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, CLIENT_STATUS_SEVERITY } from '@/app/core/crm/crm-labels';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { ClientForm } from './client-form';

/** US-03: the company's clients and prospects, searchable. */
@Component({
    selector: 'app-clients',
    standalone: true,
    imports: [DatePipe, FormsModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, TableModule, TagModule, ClientForm],
    template: `
        <div class="card !mb-0 flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="m-0 !text-xl font-semibold">Clients et prospects</h2>
                <div class="flex flex-wrap gap-2">
                    <form (ngSubmit)="search()">
                        <p-iconfield>
                            <p-inputicon class="pi pi-search" />
                            <input pInputText type="search" name="query" [(ngModel)]="query" placeholder="Nom, contact, email, téléphone" (search)="search()" />
                        </p-iconfield>
                    </form>
                    <p-button label="Nouveau client" icon="pi pi-plus" (onClick)="formVisible.set(true)" />
                </div>
            </div>

            @if (error()) {
                <p class="m-0 text-sm text-red-600" role="alert">{{ error() }}</p>
            }

            <p-table [value]="clients()" [loading]="loading()" dataKey="id" [tableStyle]="{ 'min-width': '40rem' }">
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
                    <tr class="cursor-pointer" tabindex="0" (click)="open(client)" (keydown.enter)="open(client)">
                        <td>
                            <div class="font-medium">{{ client.name }}</div>
                            <div class="text-xs text-surface-500">{{ kindLabel(client) }}</div>
                        </td>
                        <td><p-tag [value]="statusLabel(client)" [severity]="statusSeverity(client)" /></td>
                        <td>
                            <div>{{ client.contact_name }}</div>
                            <div class="text-xs text-surface-500">{{ client.phone || client.email }}</div>
                        </td>
                        <td>{{ client.city }}</td>
                        <td>
                            @if (client.last_interaction_at) {
                                {{ client.last_interaction_at | date: 'd MMM y' }}
                                <span class="text-xs text-surface-500">({{ client.interaction_count }})</span>
                            } @else {
                                <span class="text-surface-500">Aucun</span>
                            }
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="5" class="text-center text-surface-500">
                            {{ activeQuery ? 'Aucun client ne correspond à cette recherche.' : "Aucun client pour l'instant. Ajoutez votre premier client ou prospect." }}
                        </td>
                    </tr>
                </ng-template>
            </p-table>

            @if (hasMore() && !loading()) {
                <p-button label="Charger plus" [text]="true" size="small" (onClick)="loadPage(page + 1)" />
            }
        </div>

        <app-client-form [(visible)]="formVisible" (saved)="open($event)" />
    `
})
export class Clients implements OnInit {
    private readonly crm = inject(CrmService);
    private readonly router = inject(Router);

    readonly clients = signal<Client[]>([]);
    readonly loading = signal(false);
    readonly hasMore = signal(false);
    readonly error = signal('');
    readonly formVisible = signal(false);

    query = '';
    activeQuery = '';
    page = 1;

    ngOnInit(): void {
        this.loadPage(1);
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
                this.loading.set(false);
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }
}
