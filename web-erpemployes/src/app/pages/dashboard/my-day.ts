import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MyDay as MyDayData, PlanningService } from '@/app/core/planning/planning.service';
import { FOLLOW_UP_CHANNEL_ICONS, relativeDay } from '@/app/core/crm/crm-labels';
import { formatMoney } from '@/app/core/billing/money';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { FollowUp } from '@/app/core/crm/crm.service';

/**
 * US-06 "Ma journée": what to do today, each item one click from its action.
 * No data of its own: it reads the same figures as the other screens.
 */
@Component({
    selector: 'app-my-day',
    standalone: true,
    imports: [DatePipe, RouterLink, ButtonModule, SkeletonModule, TagModule],
    template: `
        <section class="flex flex-col gap-4" aria-labelledby="my-day-title">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="my-day-title" class="!m-0 !text-xl !font-semibold">Ma journée</h2>
                @if (day(); as d) {
                    <span class="inline-block text-sm text-muted-color first-letter:uppercase">{{ d.today | date: 'EEEE d MMMM' }}</span>
                }
            </div>

            @if (error()) {
                <div class="card !mb-0 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700 dark:text-red-300" role="alert">
                    <span><i class="pi pi-exclamation-circle mr-2"></i>{{ error() }}</span>
                    <p-button label="Réessayer" icon="pi pi-refresh" size="small" [text]="true" severity="danger" (onClick)="load()" />
                </div>
            } @else if (!day()) {
                <div class="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true"><p-skeleton height="10rem" borderRadius="0.75rem" /><p-skeleton height="10rem" borderRadius="0.75rem" /></div>
            } @else if (nothingToDo()) {
                <div class="card !mb-0 flex items-center gap-4">
                    <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-300" aria-hidden="true"><i class="pi pi-check !text-xl"></i></span>
                    <div>
                        <p class="!m-0 font-semibold">Rien d'urgent aujourd'hui.</p>
                        <p class="!m-0 text-sm text-muted-color">Aucun suivi prévu, aucune facture en retard, aucune alerte.</p>
                    </div>
                </div>
            } @else {
                @let d = day()!;
                <!-- Alerts -->
                @for (alert of d.alerts ?? []; track alert.code) {
                    @if (alert.code === 'cash_below_threshold') {
                        <a [routerLink]="['/', paths.cash]" class="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 no-underline dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
                            <i class="pi pi-exclamation-triangle text-xl" aria-hidden="true"></i>
                            <span class="flex-1"><strong>Trésorerie sous votre seuil</strong> : {{ money(alert.amount) }} pour un seuil de {{ money(alert.threshold) }}.</span>
                            <i class="pi pi-chevron-right" aria-hidden="true"></i>
                        </a>
                    } @else if (alert.code === 'draft_invoices') {
                        <a
                            [routerLink]="['/', paths.invoices]"
                            [queryParams]="{ filtre: 'draft' }"
                            class="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 no-underline dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                        >
                            <i class="pi pi-file-edit text-xl" aria-hidden="true"></i>
                            <span class="flex-1"
                                ><strong>{{ alert.count > 1 ? alert.count + ' factures en brouillon' : '1 facture en brouillon' }}</strong> : une facture non émise ne sera pas payée.</span
                            >
                            <i class="pi pi-chevron-right" aria-hidden="true"></i>
                        </a>
                    }
                }

                <div class="grid grid-cols-1 gap-4" [class.lg:grid-cols-2]="d.overdue_invoices !== null">
                    <!-- Follow-ups due today or late -->
                    <div class="card !mb-0 flex flex-col gap-3">
                        <div class="flex items-baseline justify-between gap-2">
                            <h3 class="!m-0 !text-base !font-semibold">À recontacter</h3>
                            <span class="text-sm text-muted-color">{{ d.follow_up_count }}</span>
                        </div>
                        <ul class="m-0 flex list-none flex-col gap-2 p-0">
                            @for (f of d.follow_ups; track f.id) {
                                <li>
                                    <a [routerLink]="['/', paths.clients, f.client_id]" class="flex items-center gap-3 rounded-lg border border-surface-200 p-3 text-color no-underline hover:border-primary dark:border-surface-700">
                                        <i [class]="icons[f.channel] + ' text-primary'" aria-hidden="true"></i>
                                        <span class="min-w-0 flex-1">
                                            <span class="block truncate font-medium">{{ f.reason }}</span>
                                            <span class="block truncate text-xs text-muted-color">{{ f.client_name }}</span>
                                        </span>
                                        <p-tag class="shrink-0 whitespace-nowrap" [value]="relative(f)" [severity]="f.is_overdue ? 'danger' : 'info'" />
                                    </a>
                                </li>
                            } @empty {
                                <li class="text-sm text-muted-color">Aucun suivi pour aujourd'hui.</li>
                            }
                        </ul>
                    </div>

                    <!-- Overdue invoices (founders only) -->
                    @if (d.overdue_invoices !== null) {
                        <div class="card !mb-0 flex flex-col gap-3">
                            <div class="flex items-baseline justify-between gap-2">
                                <h3 class="!m-0 !text-base !font-semibold">Factures en retard</h3>
                                @if (d.overdue_invoice_count) {
                                    <span class="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{{ money(d.overdue_total!) }}</span>
                                }
                            </div>
                            <ul class="m-0 flex list-none flex-col gap-2 p-0">
                                @for (inv of d.overdue_invoices; track inv.id) {
                                    <li class="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                                        <a [routerLink]="['/', paths.invoices, inv.id]" class="min-w-0 flex-1 text-color no-underline">
                                            <span class="block truncate font-medium">{{ inv.client_name }}</span>
                                            <span class="block text-xs text-muted-color"
                                                >{{ inv.number }} · <span class="text-red-600 dark:text-red-400">{{ inv.days_late }} j de retard</span></span
                                            >
                                        </a>
                                        <span class="shrink-0 text-sm font-semibold tabular-nums">{{ money(inv.balance_due) }}</span>
                                        <a pButton [routerLink]="['/', paths.invoices, inv.id]" [queryParams]="{ relancer: 1 }" size="small" [outlined]="true" [attr.aria-label]="'Relancer ' + inv.client_name"
                                            ><i pButtonIcon class="pi pi-send"></i><span pButtonLabel>Relancer</span></a
                                        >
                                    </li>
                                } @empty {
                                    <li class="text-sm text-muted-color">Aucune facture en retard.</li>
                                }
                            </ul>
                            @if ((d.overdue_invoice_count ?? 0) > d.overdue_invoices.length) {
                                <a [routerLink]="['/', paths.invoices]" [queryParams]="{ filtre: 'overdue' }" class="text-sm font-medium text-primary">Voir les {{ d.overdue_invoice_count }} factures en retard</a>
                            }
                        </div>
                    }
                </div>
            }
        </section>
    `
})
export class MyDay implements OnInit {
    private readonly planning = inject(PlanningService);

    readonly day = signal<MyDayData | null>(null);
    readonly error = signal('');
    readonly nothingToDo = computed(() => {
        const d = this.day();
        return !!d && d.follow_up_count === 0 && !d.overdue_invoice_count && !(d.alerts ?? []).length;
    });

    readonly icons = FOLLOW_UP_CHANNEL_ICONS;
    readonly paths = { cash: AppConstantRoute.Cash_PATH, invoices: AppConstantRoute.Invoices_PATH, clients: AppConstantRoute.Clients_PATH };

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.error.set('');
        this.planning.myDay().subscribe({
            next: (day) => this.day.set(day),
            error: (error) => this.error.set(apiErrorMessage(error))
        });
    }

    money(amount: string): string {
        return formatMoney(amount, this.day()?.currency ?? 'XAF');
    }

    relative(f: FollowUp): string {
        return relativeDay(f.due_date) ?? '';
    }
}
