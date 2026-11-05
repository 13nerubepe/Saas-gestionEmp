import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { Client, CrmService, Interaction, InteractionKind } from '@/app/core/crm/crm.service';
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, CLIENT_STATUS_SEVERITY, INTERACTION_KIND_ICONS, INTERACTION_KIND_LABELS, selectOptions } from '@/app/core/crm/crm-labels';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { ClientForm } from './client-form';

/** Local date-time for <input type="datetime-local">, e.g. 2026-11-05T14:30. */
function nowLocal(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** US-03 client record and US-04 interaction history. */
@Component({
    selector: 'app-client-detail',
    standalone: true,
    imports: [DatePipe, FormsModule, RouterLink, ButtonModule, ConfirmDialogModule, SelectModule, TagModule, TextareaModule, ClientForm],
    providers: [ConfirmationService],
    template: `
        <div class="mb-4">
            <a [routerLink]="['/', clientsPath]" class="text-sm text-primary"><i class="pi pi-arrow-left mr-1 text-xs"></i>Tous les clients</a>
        </div>

        @if (error()) {
            <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
        }

        @if (client(); as c) {
            <div class="grid grid-cols-12 gap-6">
                <!-- Record -->
                <div class="col-span-12 lg:col-span-5">
                    <div class="card !mb-0 flex flex-col gap-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <h2 class="m-0 !text-xl font-semibold">{{ c.name }}</h2>
                                <span class="text-sm text-surface-500">{{ kindLabels[c.kind] }}</span>
                            </div>
                            <p-tag [value]="statusLabels[c.status]" [severity]="statusSeverity[c.status]" />
                        </div>

                        <dl class="m-0 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                            @for (row of details(c); track row.label) {
                                <dt class="text-surface-500">{{ row.label }}</dt>
                                <dd class="col-span-2 m-0 break-words">{{ row.value || '—' }}</dd>
                            }
                        </dl>

                        @if (c.notes) {
                            <p class="m-0 whitespace-pre-line rounded-lg bg-surface-100 p-3 text-sm dark:bg-surface-800">{{ c.notes }}</p>
                        }

                        <div class="flex gap-2">
                            <p-button label="Modifier" icon="pi pi-pencil" [outlined]="true" size="small" (onClick)="formVisible.set(true)" />
                            <p-button label="Supprimer" icon="pi pi-trash" severity="danger" [text]="true" size="small" (onClick)="confirmDelete(c)" />
                        </div>
                    </div>
                </div>

                <!-- History -->
                <div class="col-span-12 lg:col-span-7">
                    <div class="card !mb-0 flex flex-col gap-4">
                        <h2 class="m-0 !text-xl font-semibold">Historique des échanges</h2>

                        <form class="flex flex-col gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700" (ngSubmit)="record(c)">
                            <div class="flex flex-wrap gap-3">
                                <p-select name="kind" [(ngModel)]="newKind" [options]="interactionOptions" optionLabel="label" optionValue="value" ariaLabel="Type d'échange" />
                                <input type="datetime-local" name="occurred_at" [(ngModel)]="newOccurredAt" class="p-inputtext" aria-label="Date de l'échange" [max]="maxOccurredAt" />
                            </div>
                            <textarea pTextarea name="summary" [(ngModel)]="newSummary" rows="2" [autoResize]="true" placeholder="Résumé de l'échange…" class="w-full"></textarea>
                            @if (recordError()) {
                                <p class="m-0 text-sm text-red-600" role="alert">{{ recordError() }}</p>
                            }
                            <div class="flex justify-end">
                                <p-button type="submit" label="Ajouter" icon="pi pi-plus" size="small" [loading]="recording()" [disabled]="!newSummary.trim() || !newOccurredAt" />
                            </div>
                        </form>

                        <ol class="m-0 flex list-none flex-col gap-3 p-0">
                            @for (i of interactions(); track i.id) {
                                <li class="flex gap-3">
                                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary dark:bg-primary-900"><i [class]="kindIcons[i.kind]"></i></span>
                                    <div class="flex flex-col gap-1">
                                        <span class="text-xs text-surface-500"
                                            >{{ kindLabelsInteraction[i.kind] }} · {{ i.occurred_at | date: 'd MMM y, HH:mm' }}
                                            @if (i.created_by_email) {
                                                · {{ i.created_by_email }}
                                            }
                                        </span>
                                        <span class="whitespace-pre-line text-sm">{{ i.summary }}</span>
                                    </div>
                                </li>
                            } @empty {
                                @if (!loadingInteractions()) {
                                    <li class="text-sm text-surface-500">Aucun échange enregistré.</li>
                                }
                            }
                        </ol>

                        @if (loadingInteractions()) {
                            <p class="m-0 text-sm text-surface-500"><i class="pi pi-spin pi-spinner mr-2"></i>Chargement…</p>
                        } @else if (hasMore()) {
                            <p-button label="Charger plus" [text]="true" size="small" (onClick)="loadInteractions(c.id, page + 1)" />
                        }
                    </div>
                </div>
            </div>

            <app-client-form [client]="c" [(visible)]="formVisible" (saved)="client.set($event)" />
        } @else if (!error()) {
            <p class="text-sm text-surface-500"><i class="pi pi-spin pi-spinner mr-2"></i>Chargement…</p>
        }

        <p-confirmdialog />
    `
})
export class ClientDetail implements OnInit {
    private readonly crm = inject(CrmService);
    private readonly router = inject(Router);
    private readonly confirmation = inject(ConfirmationService);

    /** Route parameter (withComponentInputBinding). */
    readonly id = input.required<string>();

    readonly client = signal<Client | null>(null);
    readonly interactions = signal<Interaction[]>([]);
    readonly error = signal('');
    readonly loadingInteractions = signal(false);
    readonly hasMore = signal(false);
    readonly recording = signal(false);
    readonly recordError = signal('');
    readonly formVisible = signal(false);

    readonly clientsPath = AppConstantRoute.Clients_PATH;
    readonly kindLabels = CLIENT_KIND_LABELS;
    readonly statusLabels = CLIENT_STATUS_LABELS;
    readonly statusSeverity = CLIENT_STATUS_SEVERITY;
    readonly kindLabelsInteraction = INTERACTION_KIND_LABELS;
    readonly kindIcons = INTERACTION_KIND_ICONS;
    readonly interactionOptions = selectOptions(INTERACTION_KIND_LABELS);
    readonly maxOccurredAt = nowLocal();

    newKind: InteractionKind = 'call';
    newOccurredAt = nowLocal();
    newSummary = '';
    page = 1;

    ngOnInit(): void {
        this.crm.getClient(this.id()).subscribe({
            next: (client) => this.client.set(client),
            // Another company's client is a 404, like an unknown one.
            error: (error) => this.error.set(error?.status === 404 ? 'Client introuvable.' : apiErrorMessage(error))
        });
        this.loadInteractions(this.id(), 1);
    }

    details(c: Client): { label: string; value: string }[] {
        return [
            { label: 'Contact', value: c.contact_name },
            { label: 'Téléphone', value: c.phone },
            { label: 'Email', value: c.email },
            { label: 'Adresse', value: [c.address, c.city, c.country].filter(Boolean).join(', ') },
            { label: 'NIU', value: c.tax_id }
        ];
    }

    loadInteractions(clientId: string, page: number): void {
        this.loadingInteractions.set(true);
        this.crm.listInteractions(clientId, page).subscribe({
            next: (result) => {
                this.page = page;
                this.interactions.update((list) => (page === 1 ? result.results : [...list, ...result.results]));
                this.hasMore.set(result.next !== null);
                this.loadingInteractions.set(false);
            },
            error: (error) => {
                this.recordError.set(apiErrorMessage(error));
                this.loadingInteractions.set(false);
            }
        });
    }

    record(c: Client): void {
        const summary = this.newSummary.trim();
        if (!summary || !this.newOccurredAt || this.recording()) return;
        this.recording.set(true);
        this.recordError.set('');
        this.crm.recordInteraction(c.id, { kind: this.newKind, occurred_at: new Date(this.newOccurredAt).toISOString(), summary }).subscribe({
            next: (interaction) => {
                this.recording.set(false);
                this.newSummary = '';
                this.newOccurredAt = nowLocal();
                // Keep newest first, as the API returns it.
                this.interactions.update((list) => [interaction, ...list].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)));
                this.client.set({ ...c, interaction_count: c.interaction_count + 1, last_interaction_at: maxDate(c.last_interaction_at, interaction.occurred_at) });
            },
            error: (error) => {
                this.recordError.set(apiErrorMessage(error));
                this.recording.set(false);
            }
        });
    }

    confirmDelete(c: Client): void {
        this.confirmation.confirm({
            header: 'Supprimer le client',
            message: `Supprimer « ${c.name} » et tout son historique ? Cette action est définitive.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { text: true },
            accept: () =>
                this.crm.deleteClient(c.id).subscribe({
                    next: () => this.router.navigate(['/', AppConstantRoute.Clients_PATH]),
                    error: (error) => this.error.set(apiErrorMessage(error))
                })
        });
    }
}

function maxDate(a: string | null, b: string): string {
    return a && new Date(a) > new Date(b) ? a : b;
}
