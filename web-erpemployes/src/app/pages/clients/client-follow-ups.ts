import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { CrmService, FollowUp, FollowUpChannel } from '@/app/core/crm/crm.service';
import { FOLLOW_UP_CHANNEL_ICONS, FOLLOW_UP_CHANNEL_LABELS, localDate, relativeDay, selectOptions } from '@/app/core/crm/crm-labels';
import { apiErrorMessage } from '@/app/core/api-errors';

/**
 * US-05: dated follow-ups on a client record. Plan one, mark it done with a
 * summary (which joins the client's history), or postpone it.
 */
@Component({
    selector: 'app-client-follow-ups',
    standalone: true,
    imports: [DatePipe, FormsModule, ButtonModule, InputTextModule, SelectModule, TagModule, TextareaModule],
    template: `
        <section class="card !mb-0 flex flex-col gap-4" aria-labelledby="follow-ups-title">
            <div class="flex items-baseline justify-between gap-2">
                <h2 id="follow-ups-title" class="!m-0 !text-lg font-semibold">Suivis</h2>
                <span class="text-sm text-muted-color">{{ open().length }} à faire</span>
            </div>

            <!-- Plan a follow-up -->
            <form class="flex flex-col gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700" (ngSubmit)="plan()">
                <label for="follow-up-reason" class="sr-only">Motif du suivi</label>
                <input pInputText id="follow-up-reason" name="reason" [(ngModel)]="reason" maxlength="255" placeholder="Ex. : rappeler pour le devis" class="w-full" />
                <div class="flex flex-wrap items-center gap-2">
                    <label for="follow-up-date" class="sr-only">Date du suivi</label>
                    <input pInputText id="follow-up-date" name="due_date" type="date" [(ngModel)]="dueDate" [min]="today" />
                    <p-button label="Demain" size="small" [text]="true" (onClick)="dueDate = inDays(1)" />
                    <p-button label="Dans 1 semaine" size="small" [text]="true" (onClick)="dueDate = inDays(7)" />
                    <p-select name="channel" class="min-w-36" [(ngModel)]="channel" [options]="channelOptions" optionLabel="label" optionValue="value" placeholder="Canal" [showClear]="true" ariaLabel="Canal du suivi" />
                </div>
                @if (formError()) {
                    <p class="!m-0 text-sm text-red-600" role="alert">{{ formError() }}</p>
                }
                <div class="flex justify-end">
                    <p-button type="submit" label="Programmer" icon="pi pi-calendar-plus" size="small" [loading]="saving()" [disabled]="!reason.trim() || !dueDate" />
                </div>
            </form>

            <!-- Open follow-ups -->
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
                @for (f of open(); track f.id) {
                    <li
                        class="flex flex-col gap-2 rounded-xl border p-3"
                        [class.border-red-300]="f.is_overdue"
                        [class.bg-red-50]="f.is_overdue"
                        [class.dark:bg-red-950]="f.is_overdue"
                        [class.border-surface-200]="!f.is_overdue"
                        [class.dark:border-surface-700]="!f.is_overdue"
                    >
                        <div class="flex items-start gap-3">
                            <i [class]="icons[f.channel] + ' mt-1 text-primary'" aria-hidden="true"></i>
                            <div class="min-w-0 flex-1">
                                <div class="font-medium">{{ f.reason }}</div>
                                <div class="text-xs text-muted-color">
                                    {{ f.due_date | date: 'EEEE d MMMM' }}
                                    @if (f.channel) {
                                        · {{ channelLabel(f.channel) }}
                                    }
                                    @if (f.postponements.length) {
                                        · reporté {{ f.postponements.length }} fois
                                    }
                                </div>
                            </div>
                            @if (relative(f); as r) {
                                <p-tag class="shrink-0 whitespace-nowrap" [value]="r" [severity]="f.is_overdue ? 'danger' : 'info'" />
                            }
                        </div>

                        @if (editing() === f.id && mode() === 'done') {
                            <div class="flex flex-col gap-2">
                                <label [for]="'summary-' + f.id" class="text-sm font-medium">Compte rendu (ajouté à l'historique)</label>
                                <textarea pTextarea [id]="'summary-' + f.id" [(ngModel)]="summary" rows="2" [autoResize]="true" placeholder="Ex. : devis accepté, livraison lundi" class="w-full"></textarea>
                                <div class="flex justify-end gap-2">
                                    <p-button label="Annuler" size="small" [text]="true" (onClick)="cancel()" />
                                    <p-button label="Valider" icon="pi pi-check" size="small" [loading]="saving()" [disabled]="summary.trim().length < 2" (onClick)="complete(f)" />
                                </div>
                            </div>
                        } @else if (editing() === f.id && mode() === 'postpone') {
                            <div class="flex flex-wrap items-center justify-end gap-2">
                                <label [for]="'postpone-' + f.id" class="text-sm font-medium">Nouvelle date</label>
                                <input pInputText [id]="'postpone-' + f.id" type="date" [(ngModel)]="newDate" [min]="today" />
                                <p-button label="Annuler" size="small" [text]="true" (onClick)="cancel()" />
                                <p-button label="Reporter" icon="pi pi-check" size="small" [loading]="saving()" [disabled]="!newDate" (onClick)="postpone(f)" />
                            </div>
                        } @else {
                            <div class="flex justify-end gap-2">
                                <p-button label="Reporter" icon="pi pi-calendar" size="small" [text]="true" (onClick)="start(f, 'postpone')" />
                                <p-button label="Fait" icon="pi pi-check" size="small" [outlined]="true" (onClick)="start(f, 'done')" />
                            </div>
                        }
                        @if (editing() === f.id && actionError()) {
                            <p class="!m-0 text-sm text-red-600" role="alert">{{ actionError() }}</p>
                        }
                    </li>
                } @empty {
                    @if (!loading()) {
                        <li class="text-sm text-muted-color">Aucun suivi prévu. Programmez le prochain contact pour ne pas l'oublier.</li>
                    }
                }
            </ul>

            @if (done().length) {
                <details class="text-sm">
                    <summary class="cursor-pointer text-muted-color">Suivis faits ({{ done().length }})</summary>
                    <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                        @for (f of done(); track f.id) {
                            <li class="text-muted-color"><i class="pi pi-check-circle mr-1 text-green-600" aria-hidden="true"></i>{{ f.reason }} · fait le {{ f.done_at | date: 'd MMM y' }}</li>
                        }
                    </ul>
                </details>
            }
        </section>
    `
})
export class ClientFollowUps implements OnInit {
    private readonly crm = inject(CrmService);

    readonly clientId = input.required<string>();
    /** Emitted when a follow-up is done: the client's history gained an entry. */
    readonly completed = output<void>();

    readonly open = signal<FollowUp[]>([]);
    readonly done = signal<FollowUp[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly formError = signal('');
    readonly actionError = signal('');
    readonly editing = signal<string | null>(null);
    readonly mode = signal<'done' | 'postpone'>('done');

    readonly today = localDate(0);
    readonly inDays = localDate;
    readonly icons = FOLLOW_UP_CHANNEL_ICONS;
    readonly channelOptions = selectOptions(FOLLOW_UP_CHANNEL_LABELS);

    reason = '';
    dueDate = localDate(1);
    channel: FollowUpChannel = '';
    summary = '';
    newDate = '';

    ngOnInit(): void {
        this.load();
    }

    channelLabel(channel: FollowUpChannel): string {
        return channel ? FOLLOW_UP_CHANNEL_LABELS[channel] : '';
    }

    relative(f: FollowUp): string | null {
        return relativeDay(f.due_date);
    }

    plan(): void {
        if (!this.reason.trim() || !this.dueDate || this.saving()) return;
        this.saving.set(true);
        this.formError.set('');
        this.crm.planFollowUp(this.clientId(), { due_date: this.dueDate, reason: this.reason.trim(), channel: this.channel ?? '' }).subscribe({
            next: () => {
                this.reason = '';
                this.dueDate = localDate(1);
                this.channel = '';
                this.saving.set(false);
                this.load();
            },
            error: (error) => {
                this.formError.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }

    start(f: FollowUp, mode: 'done' | 'postpone'): void {
        this.editing.set(f.id);
        this.mode.set(mode);
        this.summary = '';
        this.newDate = localDate(1);
        this.actionError.set('');
    }

    cancel(): void {
        this.editing.set(null);
        this.actionError.set('');
    }

    complete(f: FollowUp): void {
        this.run(this.crm.completeFollowUp(f.id, this.summary.trim()), () => this.completed.emit());
    }

    postpone(f: FollowUp): void {
        this.run(this.crm.postponeFollowUp(f.id, this.newDate));
    }

    private run(request: ReturnType<CrmService['completeFollowUp']>, after?: () => void): void {
        if (this.saving()) return;
        this.saving.set(true);
        this.actionError.set('');
        request.subscribe({
            next: () => {
                this.saving.set(false);
                this.editing.set(null);
                after?.();
                this.load();
            },
            error: (error) => {
                this.actionError.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }

    private load(): void {
        this.loading.set(true);
        this.crm.listClientFollowUps(this.clientId()).subscribe({
            next: (page) => {
                this.open.set(page.results.filter((f) => f.status === 'open'));
                this.done.set(page.results.filter((f) => f.status === 'done'));
                this.loading.set(false);
            },
            error: (error) => {
                this.formError.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }
}
