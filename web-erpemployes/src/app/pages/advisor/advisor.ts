import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { AdvisorExchange, AdvisorService } from '@/app/core/advisor/advisor.service';
import { BillingService, FinancialSummary } from '@/app/core/billing/billing.service';
import { formatMoney } from '@/app/core/billing/money';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { EmptyState } from '@/app/commons/empty-state';
import { PageHeader } from '@/app/commons/page-header';
import { AdvisorAnswerView } from './advisor-answer-view';

/** Questions a founder asks most, one tap to fill the form. */
const SUGGESTED_QUESTIONS = [
    { icon: 'pi-wallet', text: 'Qui me doit de l’argent, et qui relancer en priorité ?' },
    { icon: 'pi-chart-line', text: 'Comment améliorer ma trésorerie ce mois-ci ?' },
    { icon: 'pi-shopping-cart', text: 'Où partent mes dépenses, et lesquelles réduire ?' },
    { icon: 'pi-megaphone', text: 'Quels prospects relancer cette semaine, et comment ?' },
    { icon: 'pi-heart', text: 'Quels clients risquent de partir, et comment les fidéliser ?' },
    { icon: 'pi-bullseye', text: 'Sur quel type de client concentrer ma prospection ?' }
];

interface AgingSegment {
    key: keyof FinancialSummary['aging'];
    label: string;
    color: string;
}

const AGING_SEGMENTS: AgingSegment[] = [
    { key: 'not_due', label: 'Pas encore dû', color: 'bg-emerald-500' },
    { key: 'days_1_30', label: '1 à 30 j de retard', color: 'bg-amber-400' },
    { key: 'days_31_60', label: '31 à 60 j', color: 'bg-orange-500' },
    { key: 'days_61_90', label: '61 à 90 j', color: 'bg-red-500' },
    { key: 'days_over_90', label: 'Plus de 90 j', color: 'bg-red-800' }
];

/**
 * M4/M5 advisor: the founder's figures computed by the application, who owes
 * money, and an AI advisor that answers from those figures only.
 */
@Component({
    selector: 'app-advisor',
    standalone: true,
    imports: [DatePipe, FormsModule, RouterLink, ButtonModule, SkeletonModule, TextareaModule, EmptyState, PageHeader, AdvisorAnswerView],
    template: `
        <app-page-header title="Conseiller financier" subtitle="Vos chiffres, qui vous doit de l'argent, et des conseils fondés sur vos propres données." />

        @if (summaryError()) {
            <div class="card !mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700 dark:text-red-300" role="alert">
                <span><i class="pi pi-exclamation-circle mr-2"></i>{{ summaryError() }}</span>
                <p-button label="Réessayer" icon="pi pi-refresh" size="small" [text]="true" severity="danger" (onClick)="loadSummary()" />
            </div>
        }

        @if (summary()?.cash?.below_threshold) {
            <a [routerLink]="['/', cashPath]" class="mb-6 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 no-underline dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
                <i class="pi pi-exclamation-triangle text-xl" aria-hidden="true"></i>
                <span><strong>Trésorerie sous votre seuil d'alerte</strong> : {{ money(summary()!.cash.balance) }}. Voir la trésorerie</span>
            </a>
        }

        <!-- Key figures -->
        <section class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 xl:gap-6" aria-label="Chiffres clés">
            @if (summary(); as s) {
                @for (kpi of kpis(); track kpi.label) {
                    <div class="card !mb-0 flex flex-col gap-1 !p-4 sm:!p-5">
                        <span class="text-xs font-medium uppercase tracking-wide text-muted-color">{{ kpi.label }}</span>
                        <span class="text-lg font-semibold tabular-nums sm:text-xl" [class.text-red-600]="kpi.alert" [class.dark:text-red-400]="kpi.alert">{{ kpi.value }}</span>
                        <span class="text-xs text-muted-color">{{ kpi.hint }}</span>
                    </div>
                }
            } @else if (!summaryError()) {
                @for (i of [1, 2, 3, 4, 5]; track i) {
                    <p-skeleton height="6rem" borderRadius="0.75rem" />
                }
            }
        </section>

        <div class="grid grid-cols-12 gap-6">
            <!-- Who owes money -->
            <section class="col-span-12 flex flex-col gap-6 xl:col-span-7" aria-labelledby="debtors-title">
                <div class="card !mb-0 flex flex-col gap-4">
                    <div class="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 id="debtors-title" class="!m-0 !text-lg font-semibold">Qui vous doit de l'argent</h2>
                        @if (summary(); as s) {
                            <span class="text-sm text-muted-color">{{ s.receivables_count }} {{ s.receivables_count > 1 ? 'clients' : 'client' }}</span>
                        }
                    </div>

                    @if (summary(); as s) {
                        @if (Number(s.outstanding) > 0) {
                            <!-- Aging: how late the unpaid money is -->
                            <div class="flex flex-col gap-2">
                                <div class="flex h-3 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700" role="img" [attr.aria-label]="agingLabel()">
                                    @for (seg of agingSegments; track seg.key) {
                                        @if (share(seg.key) > 0) {
                                            <div [class]="seg.color" [style.width.%]="share(seg.key)"></div>
                                        }
                                    }
                                </div>
                                <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs">
                                    @for (seg of agingSegments; track seg.key) {
                                        @if (share(seg.key) > 0) {
                                            <li class="flex items-center gap-1.5">
                                                <span class="inline-block h-2.5 w-2.5 rounded-full" [class]="seg.color" aria-hidden="true"></span>
                                                {{ seg.label }} : <strong class="tabular-nums">{{ money(s.aging[seg.key]) }}</strong>
                                            </li>
                                        }
                                    }
                                </ul>
                            </div>

                            <ul class="m-0 flex list-none flex-col gap-2 p-0">
                                @for (r of s.receivables; track r.client_id) {
                                    <li>
                                        <a
                                            [routerLink]="['/', clientsPath, r.client_id]"
                                            class="flex items-center justify-between gap-3 rounded-xl border border-surface-200 p-3 text-color no-underline transition-colors hover:border-primary dark:border-surface-700"
                                        >
                                            <div class="min-w-0">
                                                <div class="truncate font-semibold">{{ r.client_name }}</div>
                                                <div class="text-xs text-muted-color">
                                                    {{ r.invoice_count }} {{ r.invoice_count > 1 ? 'factures' : 'facture' }}
                                                    @if (r.max_days_late > 0) {
                                                        · <span class="font-medium text-red-600 dark:text-red-400">{{ r.max_days_late }} j de retard</span>
                                                    } @else {
                                                        · dans les délais
                                                    }
                                                </div>
                                            </div>
                                            <div class="shrink-0 text-right">
                                                <div class="font-semibold tabular-nums">{{ money(r.total_due) }}</div>
                                                @if (Number(r.overdue_due) > 0) {
                                                    <div class="text-xs tabular-nums text-red-600 dark:text-red-400">dont {{ money(r.overdue_due) }} en retard</div>
                                                }
                                            </div>
                                        </a>
                                    </li>
                                }
                            </ul>
                            @if (s.overdue_count > 0) {
                                <div>
                                    <a [routerLink]="['/', invoicesPath]" [queryParams]="{ filtre: 'overdue' }" class="text-sm font-medium text-primary"
                                        >{{ s.overdue_count > 1 ? 'Voir les ' + s.overdue_count + ' factures en retard' : 'Voir la facture en retard' }} <i class="pi pi-arrow-right text-xs"></i
                                    ></a>
                                </div>
                            }
                        } @else if (s.invoiced_this_year === '0.00' && s.draft_count === 0) {
                            <app-empty-state icon="pi-file" title="Pas encore de facture émise." text="Émettez vos factures dans l'application : le conseiller suivra qui vous doit quoi.">
                                <p-button label="Créer une facture" icon="pi pi-plus" [outlined]="true" [routerLink]="['/', invoicesPath, 'nouvelle']" />
                            </app-empty-state>
                        } @else {
                            <app-empty-state icon="pi-check-circle" title="Personne ne vous doit d'argent." text="Toutes vos factures émises sont réglées." />
                        }
                    } @else if (!summaryError()) {
                        <p-skeleton height="10rem" borderRadius="0.75rem" />
                    }
                </div>
            </section>

            <!-- Ask the advisor -->
            <section class="col-span-12 xl:col-span-5" aria-labelledby="ask-title">
                <div class="card !mb-0 flex flex-col gap-4">
                    <div class="flex items-start gap-3">
                        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-400/10" aria-hidden="true"><i class="pi pi-sparkles"></i></span>
                        <div>
                            <h2 id="ask-title" class="!m-0 !text-lg font-semibold">Demander au conseiller</h2>
                            <p class="!m-0 text-sm text-muted-color">Trésorerie, relances, prospection, fidélisation. Il répond à partir de vos factures, paiements et clients.</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        @for (q of suggestions; track q.text) {
                            <button
                                type="button"
                                class="flex min-h-11 items-center gap-2 rounded-full border border-surface-200 px-3 py-1.5 text-left text-sm transition-colors hover:border-primary hover:text-primary dark:border-surface-700"
                                (click)="question = q.text"
                            >
                                <i [class]="'pi ' + q.icon + ' text-xs'" aria-hidden="true"></i>{{ q.text }}
                            </button>
                        }
                    </div>

                    <form class="flex flex-col gap-3" (ngSubmit)="ask()">
                        <label for="advisor-question" class="sr-only">Votre question</label>
                        <textarea
                            pTextarea
                            id="advisor-question"
                            name="question"
                            [(ngModel)]="question"
                            rows="3"
                            [autoResize]="true"
                            maxlength="2000"
                            placeholder="Ex. : Combien vais-je encaisser ce mois-ci ?"
                            class="w-full"
                            [disabled]="asking()"
                        ></textarea>
                        @if (askError()) {
                            <p class="!m-0 text-sm text-red-600" role="alert">{{ askError() }}</p>
                        }
                        <div class="flex justify-end">
                            <p-button type="submit" label="Demander" icon="pi pi-send" [loading]="asking()" [disabled]="question.trim().length < 3" />
                        </div>
                    </form>

                    @if (asking()) {
                        <div class="flex flex-col gap-2" aria-busy="true" aria-label="Le conseiller analyse vos données"><p-skeleton height="1.5rem" width="8rem" /><p-skeleton height="6rem" /></div>
                    }

                    @for (exchange of exchanges(); track exchange.id; let first = $first) {
                        @if (first) {
                            <div class="flex flex-col gap-3 border-t border-surface-200 pt-4 dark:border-surface-700">
                                <div class="self-end rounded-xl bg-primary px-4 py-2 text-sm text-primary-contrast" style="max-width: 90%">{{ exchange.question }}</div>
                                <app-advisor-answer-view [exchange]="exchange" />
                            </div>
                        } @else {
                            @if ($index === 1) {
                                <!-- !text-sm: the Sakai typography sets h3 outside Tailwind layers. -->
                                <h3 class="!m-0 !mt-2 !text-sm !font-semibold text-muted-color">Questions précédentes</h3>
                            }
                            <details class="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                                <summary class="cursor-pointer text-sm">
                                    <span class="font-medium">{{ exchange.question }}</span>
                                    <span class="ml-1 text-xs text-muted-color">· {{ exchange.created_at | date: 'd MMM, HH:mm' }}</span>
                                </summary>
                                <div class="mt-3"><app-advisor-answer-view [exchange]="exchange" /></div>
                            </details>
                        }
                    }
                </div>
            </section>
        </div>
    `
})
export class Advisor implements OnInit {
    private readonly billing = inject(BillingService);
    private readonly advisor = inject(AdvisorService);

    readonly summary = signal<FinancialSummary | null>(null);
    readonly summaryError = signal('');
    readonly exchanges = signal<AdvisorExchange[]>([]);
    readonly asking = signal(false);
    readonly askError = signal('');

    readonly suggestions = SUGGESTED_QUESTIONS;
    readonly agingSegments = AGING_SEGMENTS;
    readonly clientsPath = AppConstantRoute.Clients_PATH;
    readonly invoicesPath = AppConstantRoute.Invoices_PATH;
    readonly cashPath = AppConstantRoute.Cash_PATH;
    readonly Number = Number;

    question = '';

    readonly kpis = computed(() => {
        const s = this.summary();
        if (!s) return [];
        return [
            { label: 'Trésorerie', value: this.money(s.cash.balance), hint: s.cash.alert_threshold ? `seuil ${this.money(s.cash.alert_threshold)}` : 'paiements + entrées − sorties', alert: s.cash.below_threshold || Number(s.cash.balance) < 0 },
            { label: 'Reste à encaisser', value: this.money(s.outstanding), hint: `${s.open_count} ${s.open_count > 1 ? 'factures ouvertes' : 'facture ouverte'}`, alert: false },
            { label: 'En retard', value: this.money(s.overdue), hint: `${s.overdue_count} ${s.overdue_count > 1 ? 'factures' : 'facture'}`, alert: Number(s.overdue) > 0 },
            { label: 'Encaissé ce mois', value: this.money(s.collected_this_month), hint: `${this.money(s.collected_this_year)} cette année`, alert: false },
            { label: 'Facturé ce mois', value: this.money(s.invoiced_this_month), hint: `${this.money(s.invoiced_this_year)} cette année`, alert: false }
        ];
    });

    readonly agingLabel = computed(() => {
        const s = this.summary();
        if (!s) return '';
        return AGING_SEGMENTS.map((seg) => `${seg.label} : ${this.money(s.aging[seg.key])}`).join(', ');
    });

    ngOnInit(): void {
        this.loadSummary();
        this.advisor.history().subscribe({
            next: (page) => this.exchanges.set(page.results),
            error: () => undefined // History is a convenience: the page works without it.
        });
    }

    loadSummary(): void {
        this.summaryError.set('');
        this.billing.getSummary().subscribe({
            next: (summary) => this.summary.set(summary),
            error: (error) => this.summaryError.set(apiErrorMessage(error))
        });
    }

    money(amount: string): string {
        return formatMoney(amount, this.summary()?.currency ?? 'XAF');
    }

    /** Percentage of the outstanding amount in one aging bucket. */
    share(key: AgingSegment['key']): number {
        const s = this.summary();
        const total = s ? Number(s.outstanding) : 0;
        return total > 0 ? (Number(s!.aging[key]) / total) * 100 : 0;
    }

    ask(): void {
        const question = this.question.trim();
        if (question.length < 3 || this.asking()) return;
        this.asking.set(true);
        this.askError.set('');
        this.advisor.ask(question).subscribe({
            next: (exchange) => {
                this.exchanges.update((list) => [exchange, ...list]);
                this.question = '';
                this.asking.set(false);
            },
            error: (error) => {
                this.askError.set(apiErrorMessage(error));
                this.asking.set(false);
            }
        });
    }
}
