import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { BillingService, CashDirection, CashMovement, CashPosition, PaymentMethod } from '@/app/core/billing/billing.service';
import { CASH_CATEGORIES_BY_DIRECTION, CASH_CATEGORY_LABELS, formatMoney } from '@/app/core/billing/money';
import { CompanyService } from '@/app/core/company/company.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { EmptyState } from '@/app/commons/empty-state';
import { PageHeader } from '@/app/commons/page-header';
import { ReasonDialog } from '@/app/commons/reason-dialog';

type Filter = 'all' | CashDirection;

/** yyyy-mm-dd of today in local time, for <input type="date">. */
function today(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * M4 cash: the balance (invoice payments plus money in, minus money out), an
 * alert when it falls under the founder's threshold, and the movements
 * entered by hand. Nothing is deleted: a mistake is reversed.
 */
@Component({
    selector: 'app-cash',
    standalone: true,
    imports: [DatePipe, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, SelectButtonModule, SkeletonModule, EmptyState, PageHeader, ReasonDialog],
    template: `
        <app-page-header title="Trésorerie" subtitle="L'argent réellement disponible : paiements reçus, autres entrées et dépenses.">
            <p-button label="Nouvelle dépense" icon="pi pi-minus" severity="secondary" [outlined]="true" (onClick)="openMovement('out')" />
            <p-button label="Nouvelle entrée" icon="pi pi-plus" (onClick)="openMovement('in')" />
        </app-page-header>

        @if (error()) {
            <div class="card !mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700 dark:text-red-300" role="alert">
                <span><i class="pi pi-exclamation-circle mr-2"></i>{{ error() }}</span>
                <p-button label="Réessayer" icon="pi pi-refresh" size="small" [text]="true" severity="danger" (onClick)="refresh()" />
            </div>
        }

        @if (cash(); as c) {
            @if (c.below_threshold) {
                <div class="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
                    <i class="pi pi-exclamation-triangle text-xl" aria-hidden="true"></i>
                    <span>
                        <strong>Trésorerie sous votre seuil d'alerte.</strong>
                        Solde {{ money(c.balance) }} pour un seuil de {{ money(c.alert_threshold!) }}. Relancez vos impayés et reportez les dépenses non urgentes.
                    </span>
                </div>
            }

            <section class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-6" aria-label="Position de trésorerie">
                <div class="card !mb-0 flex flex-col gap-1 !p-5">
                    <span class="text-xs font-medium uppercase tracking-wide text-muted-color">Solde de trésorerie</span>
                    <span class="text-2xl font-semibold tabular-nums" [class.text-red-600]="Number(c.balance) < 0 || c.below_threshold">{{ money(c.balance) }}</span>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-color">
                        @if (editingThreshold) {
                            <p-inputnumber [(ngModel)]="thresholdValue" [min]="0" locale="fr-FR" placeholder="Seuil" ariaLabel="Seuil d'alerte" inputStyleClass="w-32 !py-1 text-sm" />
                            <p-button label="OK" size="small" [loading]="savingThreshold()" (onClick)="saveThreshold()" />
                            <p-button label="Retirer" size="small" [text]="true" (onClick)="thresholdValue = null; saveThreshold()" />
                        } @else {
                            <span>{{ c.alert_threshold ? 'Seuil d’alerte : ' + money(c.alert_threshold) : 'Aucun seuil d’alerte' }}</span>
                            <button type="button" class="min-h-11 font-medium text-primary" (click)="editThreshold(c)">{{ c.alert_threshold ? 'Modifier' : 'Définir' }}</button>
                        }
                    </div>
                </div>
                <div class="card !mb-0 flex flex-col gap-1 !p-5">
                    <span class="text-xs font-medium uppercase tracking-wide text-muted-color">Entrées ce mois</span>
                    <span class="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{{ money(c.in_this_month) }}</span>
                    <span class="text-xs text-muted-color">dont paiements de factures : {{ money(c.payments_this_month) }}</span>
                </div>
                <div class="card !mb-0 flex flex-col gap-2 !p-5">
                    <span class="text-xs font-medium uppercase tracking-wide text-muted-color">Sorties ce mois</span>
                    <span class="text-2xl font-semibold tabular-nums">{{ money(c.out_this_month) }}</span>
                    @for (e of c.expenses_this_month.slice(0, 4); track e.category) {
                        <div class="flex flex-col gap-0.5">
                            <div class="flex justify-between text-xs">
                                <span>{{ categoryLabel(e.category) }}</span
                                ><span class="tabular-nums">{{ money(e.total) }}</span>
                            </div>
                            <div class="h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700"><div class="h-full rounded-full bg-primary" [style.width.%]="expenseShare(e.total, c)"></div></div>
                        </div>
                    }
                </div>
            </section>
        } @else if (!error()) {
            <section class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-6">
                @for (i of [1, 2, 3]; track i) {
                    <p-skeleton height="7rem" borderRadius="0.75rem" />
                }
            </section>
        }

        <div class="card !mb-0 flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="!m-0 !text-lg font-semibold">Mouvements saisis</h2>
                <p-selectbutton [options]="filterOptions" [(ngModel)]="filter" optionLabel="label" optionValue="value" [allowEmpty]="false" size="small" (onChange)="loadPage(1)" ariaLabel="Filtrer les mouvements" />
            </div>
            <p class="!m-0 text-xs text-muted-color">Les paiements de factures sont comptés automatiquement : saisissez ici le reste (dépenses, ventes sans facture, apports, solde de départ).</p>

            @if (loading() && movements().length === 0) {
                <p-skeleton height="8rem" borderRadius="0.75rem" />
            } @else if (movements().length === 0) {
                <app-empty-state icon="pi-wallet" title="Aucun mouvement saisi." text="Commencez par votre solde de départ (caisse, Mobile Money, banque), puis notez vos dépenses au fil de l'eau.">
                    <p-button label="Saisir le solde de départ" icon="pi pi-plus" [outlined]="true" (onClick)="openMovement('in', 'opening_balance')" />
                </app-empty-state>
            } @else {
                <ul class="m-0 flex list-none flex-col p-0" [class.opacity-60]="loading()">
                    @for (m of movements(); track m.id) {
                        <li class="flex items-center justify-between gap-3 border-b border-surface-100 py-3 last:border-0 dark:border-surface-800">
                            <div class="flex min-w-0 items-center gap-3">
                                <span
                                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                                    [class]="m.direction === 'in' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200'"
                                    aria-hidden="true"
                                >
                                    <i [class]="m.direction === 'in' ? 'pi pi-arrow-down-left' : 'pi pi-arrow-up-right'"></i>
                                </span>
                                <div class="min-w-0">
                                    <div class="truncate font-medium" [class.line-through]="m.is_reversed" [class.text-muted-color]="m.is_reversed">{{ m.reversal_of ? 'Annulation · ' : '' }}{{ m.label }}</div>
                                    <div class="text-xs text-muted-color">
                                        {{ categoryLabel(m.category) }} · {{ methodLabel(m.method) }} · {{ m.occurred_on | date: 'd MMM y' }}
                                        @if (m.reason) {
                                            · motif : {{ m.reason }}
                                        }
                                        @if (m.is_reversed) {
                                            · annulé
                                        }
                                    </div>
                                </div>
                            </div>
                            <div class="flex shrink-0 items-center gap-1">
                                <span class="font-semibold tabular-nums" [class.text-emerald-700]="effect(m) > 0" [class.line-through]="m.is_reversed">{{ effect(m) > 0 ? '+' : '−' }}{{ money(Math.abs(effect(m))) }}</span>
                                @if (!m.reversal_of && !m.is_reversed) {
                                    <p-button icon="pi pi-replay" [text]="true" severity="danger" size="small" [ariaLabel]="'Annuler le mouvement ' + m.label" (onClick)="askReversal(m)" />
                                }
                            </div>
                        </li>
                    }
                </ul>
                @if (hasMore() && !loading()) {
                    <p-button label="Charger plus" [text]="true" size="small" (onClick)="loadPage(page + 1)" />
                }
            }
        </div>

        <!-- New movement -->
        <p-dialog [header]="draft.direction === 'in' ? 'Nouvelle entrée d’argent' : 'Nouvelle dépense'" [(visible)]="movementVisible" [modal]="true" [focusOnShow]="false" [style]="{ width: '30rem' }" [breakpoints]="{ '640px': '95vw' }">
            <form class="flex flex-col gap-4" (ngSubmit)="saveMovement()">
                <div class="flex flex-col gap-2">
                    <label for="cash_label" class="font-medium">Libellé *</label>
                    <input pInputText id="cash_label" name="label" [(ngModel)]="draft.label" maxlength="255" [placeholder]="draft.direction === 'in' ? 'Ex. : Vente au comptoir' : 'Ex. : Loyer de novembre'" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="cash_category" class="font-medium">Catégorie</label>
                    <p-select inputId="cash_category" name="category" [(ngModel)]="draft.category" [options]="categoryOptions()" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-2">
                        <label for="cash_amount" class="font-medium">Montant</label>
                        <p-inputnumber inputId="cash_amount" name="amount" [(ngModel)]="draft.amount" [min]="0" locale="fr-FR" inputStyleClass="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="cash_date" class="font-medium">Date</label>
                        <input pInputText id="cash_date" name="occurred_on" type="date" [(ngModel)]="draft.occurred_on" [max]="todayValue" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="cash_method" class="font-medium">Moyen</label>
                    <p-select inputId="cash_method" name="method" [(ngModel)]="draft.method" [options]="methods()" optionLabel="label" optionValue="code" class="w-full" />
                </div>
                @if (movementError()) {
                    <p class="!m-0 text-sm text-red-600" role="alert">{{ movementError() }}</p>
                }
            </form>
            <ng-template #footer>
                <p-button label="Annuler" [text]="true" (onClick)="movementVisible = false" />
                <p-button label="Enregistrer" icon="pi pi-check" [loading]="saving()" [disabled]="!canSave()" (onClick)="saveMovement()" />
            </ng-template>
        </p-dialog>

        <app-reason-dialog
            header="Annuler un mouvement"
            message="Le mouvement reste dans l'historique : une écriture d'annulation du même montant est ajoutée."
            confirmLabel="Annuler le mouvement"
            [(visible)]="reversalVisible"
            [loading]="saving()"
            [error]="movementError()"
            (confirmed)="reverse($event)"
        />
    `
})
export class Cash implements OnInit {
    private readonly billing = inject(BillingService);
    private readonly company = inject(CompanyService);

    readonly cash = signal<CashPosition | null>(null);
    readonly currency = signal('XAF');
    readonly movements = signal<CashMovement[]>([]);
    readonly methods = signal<PaymentMethod[]>([]);
    readonly loading = signal(false);
    readonly hasMore = signal(false);
    readonly saving = signal(false);
    readonly savingThreshold = signal(false);
    readonly error = signal('');
    readonly movementError = signal('');
    /** Bumped when the draft direction changes, so the category options follow. */
    private readonly direction = signal<CashDirection>('out');
    readonly categoryOptions = computed(() => CASH_CATEGORIES_BY_DIRECTION[this.direction()].map((value) => ({ value, label: CASH_CATEGORY_LABELS[value] })));

    readonly Number = Number;
    readonly Math = Math;
    readonly todayValue = today();
    readonly filterOptions: { label: string; value: Filter }[] = [
        { label: 'Tous', value: 'all' },
        { label: 'Entrées', value: 'in' },
        { label: 'Sorties', value: 'out' }
    ];

    filter: Filter = 'all';
    page = 1;
    movementVisible = false;
    reversalVisible = false;
    editingThreshold = false;
    thresholdValue: number | null = null;
    draft = { direction: 'out' as CashDirection, category: 'supplies', label: '', amount: null as number | null, occurred_on: today(), method: 'cash' };
    private reversalTarget: CashMovement | null = null;

    ngOnInit(): void {
        this.billing.getRules().subscribe({
            next: (rules) => {
                this.methods.set(rules.payment_methods);
                this.currency.set(rules.currency);
            },
            error: () => undefined
        });
        this.refresh();
    }

    refresh(): void {
        this.error.set('');
        this.billing.getSummary().subscribe({
            next: (summary) => {
                this.currency.set(summary.currency);
                this.cash.set(summary.cash);
            },
            error: (error) => this.error.set(apiErrorMessage(error))
        });
        this.loadPage(1);
    }

    loadPage(page: number): void {
        this.loading.set(true);
        this.billing.listCashMovements(page, this.filter === 'all' ? undefined : this.filter).subscribe({
            next: (result) => {
                this.page = page;
                this.movements.update((list) => (page === 1 ? result.results : [...list, ...result.results]));
                this.hasMore.set(result.next !== null);
                this.loading.set(false);
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }

    money(amount: string | number): string {
        return formatMoney(amount, this.currency());
    }

    /** What the movement does to the cash: positive in, negative out (a reversal flips it). */
    effect(m: CashMovement): number {
        return (m.direction === 'in' ? 1 : -1) * Number(m.amount);
    }

    categoryLabel(code: string): string {
        return CASH_CATEGORY_LABELS[code] ?? code;
    }

    methodLabel(code: string): string {
        return this.methods().find((m) => m.code === code)?.label ?? code;
    }

    expenseShare(total: string, c: CashPosition): number {
        const out = Number(c.out_this_month);
        return out > 0 ? (Number(total) / out) * 100 : 0;
    }

    openMovement(direction: CashDirection, category?: string): void {
        this.direction.set(direction);
        this.draft = { direction, category: category ?? CASH_CATEGORIES_BY_DIRECTION[direction][0], label: '', amount: null, occurred_on: today(), method: this.methods()[0]?.code ?? 'cash' };
        if (category === 'opening_balance') this.draft.label = 'Solde de départ';
        this.movementError.set('');
        this.movementVisible = true;
    }

    canSave(): boolean {
        return !!this.draft.label.trim() && !!this.draft.amount && this.draft.amount > 0 && !!this.draft.occurred_on && !!this.draft.method;
    }

    saveMovement(): void {
        if (!this.canSave() || this.saving()) return;
        this.saving.set(true);
        this.movementError.set('');
        const d = this.draft;
        this.billing.recordCashMovement({ direction: d.direction, category: d.category as CashMovement['category'], amount: String(d.amount), occurred_on: d.occurred_on, method: d.method, label: d.label.trim() }).subscribe({
            next: () => {
                this.movementVisible = false;
                this.saving.set(false);
                this.refresh();
            },
            error: (error) => {
                this.movementError.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }

    askReversal(movement: CashMovement): void {
        this.reversalTarget = movement;
        this.movementError.set('');
        this.reversalVisible = true;
    }

    reverse(reason: string): void {
        if (!this.reversalTarget) return;
        this.saving.set(true);
        this.billing.reverseCashMovement(this.reversalTarget.id, reason).subscribe({
            next: () => {
                this.reversalVisible = false;
                this.saving.set(false);
                this.refresh();
            },
            error: (error) => {
                this.movementError.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }

    editThreshold(c: CashPosition): void {
        this.thresholdValue = c.alert_threshold === null ? null : Number(c.alert_threshold);
        this.editingThreshold = true;
    }

    saveThreshold(): void {
        this.savingThreshold.set(true);
        this.company.update({ cash_alert_threshold: this.thresholdValue === null ? null : String(this.thresholdValue) }).subscribe({
            next: () => {
                this.editingThreshold = false;
                this.savingThreshold.set(false);
                this.refresh();
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.savingThreshold.set(false);
            }
        });
    }
}
