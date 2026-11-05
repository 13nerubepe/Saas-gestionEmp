import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { BillingService, Invoice, InvoiceFilters } from '@/app/core/billing/billing.service';
import { displayStatus, formatMoney, INVOICE_STATUS_LABELS, INVOICE_STATUS_SEVERITY } from '@/app/core/billing/money';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { EmptyState } from '@/app/commons/empty-state';
import { mediaQuery, NARROW_SCREEN } from '@/app/commons/media';
import { PageHeader } from '@/app/commons/page-header';

type Filter = 'all' | 'draft' | 'issued' | 'overdue';

const FILTERS: Record<Filter, InvoiceFilters> = {
    all: {},
    draft: { status: 'draft' },
    issued: { status: 'issued' },
    overdue: { overdue: true }
};

/** US-14: the company's invoices, filtered by status. A table on wide screens, cards on phones. */
@Component({
    selector: 'app-invoices',
    standalone: true,
    imports: [DatePipe, FormsModule, RouterLink, ButtonModule, SelectButtonModule, SkeletonModule, TableModule, TagModule, EmptyState, PageHeader],
    template: `
        <app-page-header title="Factures" [subtitle]="subtitle()">
            <p-button label="Nouvelle facture" icon="pi pi-plus" [routerLink]="['/', invoicesPath, 'nouvelle']" />
        </app-page-header>

        <div class="card !mb-0 flex flex-col gap-4">
            <!-- Scrolls sideways on narrow phones instead of wrapping onto two rows. -->
            <div class="-mx-1 overflow-x-auto px-1">
                <p-selectbutton size="small" [options]="filterOptions" [(ngModel)]="filter" optionLabel="label" optionValue="value" [allowEmpty]="false" (onChange)="loadPage(1)" aria-label="Filtrer les factures" />
            </div>

            @if (error()) {
                <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                    <span><i class="pi pi-exclamation-circle mr-2"></i>{{ error() }}</span>
                    <p-button label="Réessayer" icon="pi pi-refresh" size="small" [text]="true" severity="danger" (onClick)="loadPage(page)" />
                </div>
            }

            @if (loading() && invoices().length === 0) {
                <div class="flex flex-col gap-3" aria-busy="true" aria-label="Chargement des factures">
                    @for (i of [1, 2, 3]; track i) {
                        <p-skeleton height="4rem" borderRadius="0.75rem" />
                    }
                </div>
            } @else if (invoices().length === 0) {
                @if (!error()) {
                    @if (filter === 'all') {
                        <app-empty-state icon="pi-file" title="Aucune facture pour l'instant." text="Créez une facture pour un client : elle reste un brouillon modifiable jusqu'à son émission.">
                            <p-button label="Créer une facture" icon="pi pi-plus" [outlined]="true" [routerLink]="['/', invoicesPath, 'nouvelle']" />
                        </app-empty-state>
                    } @else if (filter === 'overdue') {
                        <app-empty-state icon="pi-check-circle" title="Aucune facture en retard." text="Toutes vos factures émises sont dans les délais." />
                    } @else {
                        <app-empty-state icon="pi-filter" title="Aucune facture dans cette catégorie." />
                    }
                }
            } @else if (narrow()) {
                <ul class="m-0 flex list-none flex-col gap-3 p-0" [class.opacity-60]="loading()">
                    @for (invoice of invoices(); track invoice.id) {
                        <li>
                            <a
                                [routerLink]="['/', invoicesPath, invoice.id]"
                                class="flex flex-col gap-2 rounded-xl border border-surface-200 p-4 text-color no-underline transition-colors hover:border-primary active:bg-surface-50 dark:border-surface-700 dark:active:bg-surface-800"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <div class="truncate font-semibold text-surface-900 dark:text-surface-0">{{ invoice.client_display_name }}</div>
                                        <div class="text-xs text-muted-color">{{ invoice.number || 'Brouillon' }}</div>
                                    </div>
                                    <p-tag class="shrink-0 whitespace-nowrap" [value]="statusLabel(invoice)" [severity]="statusSeverity(invoice)" />
                                </div>
                                <div class="flex items-end justify-between gap-3">
                                    <span class="text-xs text-muted-color">
                                        @if (invoice.due_date) {
                                            Échéance le {{ invoice.due_date | date: 'd MMM y' }}
                                        }
                                    </span>
                                    <span class="font-semibold tabular-nums">{{ money(invoice) }}</span>
                                </div>
                            </a>
                        </li>
                    }
                </ul>
            } @else {
                <p-table [value]="invoices()" dataKey="id" [tableStyle]="{ 'min-width': '44rem' }" [class.opacity-60]="loading()">
                    <ng-template #header>
                        <tr>
                            <th>Numéro</th>
                            <th>Client</th>
                            <th>Statut</th>
                            <th>Échéance</th>
                            <th class="text-right">Montant TTC</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-invoice>
                        <tr class="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800" tabindex="0" [attr.aria-label]="'Ouvrir la facture ' + (invoice.number || 'brouillon')" (click)="open(invoice)" (keydown.enter)="open(invoice)">
                            <td class="font-medium">{{ invoice.number || '—' }}</td>
                            <td>{{ invoice.client_display_name }}</td>
                            <td><p-tag class="whitespace-nowrap" [value]="statusLabel(invoice)" [severity]="statusSeverity(invoice)" /></td>
                            <td>{{ invoice.due_date ? (invoice.due_date | date: 'd MMM y') : '—' }}</td>
                            <td class="text-right font-semibold tabular-nums">{{ money(invoice) }}</td>
                        </tr>
                    </ng-template>
                </p-table>
            }

            @if (hasMore() && !loading()) {
                <p-button label="Charger plus" [text]="true" size="small" (onClick)="loadPage(page + 1)" />
            }
        </div>
    `
})
export class Invoices implements OnInit {
    private readonly billing = inject(BillingService);
    private readonly router = inject(Router);

    readonly invoices = signal<Invoice[]>([]);
    readonly count = signal<number | null>(null);
    readonly loading = signal(false);
    readonly hasMore = signal(false);
    readonly error = signal('');
    readonly narrow = mediaQuery(NARROW_SCREEN);
    readonly subtitle = computed(() => {
        const count = this.count();
        if (count === null) return 'Brouillons, factures émises et impayés';
        return count === 1 ? '1 facture' : `${count} factures`;
    });

    readonly invoicesPath = AppConstantRoute.Invoices_PATH;
    readonly filterOptions: { label: string; value: Filter }[] = [
        { label: 'Toutes', value: 'all' },
        { label: 'Brouillons', value: 'draft' },
        { label: 'Émises', value: 'issued' },
        { label: 'En retard', value: 'overdue' }
    ];

    filter: Filter = 'all';
    page = 1;

    ngOnInit(): void {
        this.loadPage(1);
    }

    // Typed helpers: p-table rows are untyped in the template.
    statusLabel(invoice: Invoice): string {
        return INVOICE_STATUS_LABELS[displayStatus(invoice)];
    }

    statusSeverity(invoice: Invoice) {
        return INVOICE_STATUS_SEVERITY[displayStatus(invoice)];
    }

    money(invoice: Invoice): string {
        return formatMoney(invoice.total, invoice.currency);
    }

    open(invoice: Invoice): void {
        this.router.navigate(['/', AppConstantRoute.Invoices_PATH, invoice.id]);
    }

    loadPage(page: number): void {
        this.loading.set(true);
        this.error.set('');
        if (page === 1) this.invoices.set([]);
        this.billing.listInvoices(page, FILTERS[this.filter]).subscribe({
            next: (result) => {
                this.page = page;
                this.invoices.update((list) => (page === 1 ? result.results : [...list, ...result.results]));
                this.count.set(result.count);
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
