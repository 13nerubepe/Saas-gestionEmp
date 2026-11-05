import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { HttpErrorResponse } from '@angular/common/http';
import { BillingService, Invoice } from '@/app/core/billing/billing.service';
import { displayStatus, formatMoney, INVOICE_STATUS_LABELS, INVOICE_STATUS_SEVERITY } from '@/app/core/billing/money';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';

/** US-14: one invoice, laid out like the document the client receives. */
@Component({
    selector: 'app-invoice-detail',
    standalone: true,
    imports: [DatePipe, RouterLink, ButtonModule, ConfirmDialogModule, SkeletonModule, TagModule],
    providers: [ConfirmationService],
    template: `
        <div class="mb-4 print:hidden">
            <a [routerLink]="['/', invoicesPath]" class="inline-flex min-h-11 items-center text-sm text-primary"><i class="pi pi-arrow-left mr-1 text-xs"></i>Toutes les factures</a>
        </div>

        @if (error()) {
            <div class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                <span><i class="pi pi-exclamation-circle mr-2"></i>{{ error() }}</span>
                @if (needsCompanyDetails()) {
                    <a [routerLink]="['/', profilePath]" class="font-semibold text-red-700 underline dark:text-red-300">Compléter mon entreprise</a>
                }
            </div>
        }

        @if (invoice(); as inv) {
            <!-- Actions -->
            <div class="mb-4 flex flex-wrap items-center gap-2 print:hidden">
                @if (inv.status === 'draft') {
                    <p-button label="Émettre la facture" icon="pi pi-send" [loading]="busy()" (onClick)="confirmIssue(inv)" />
                    <p-button label="Modifier" icon="pi pi-pencil" [outlined]="true" [routerLink]="['/', invoicesPath, inv.id, 'modifier']" />
                    <p-button label="Supprimer" icon="pi pi-trash" severity="danger" [text]="true" (onClick)="confirmDelete(inv)" />
                } @else {
                    <p-button label="Imprimer" icon="pi pi-print" [outlined]="true" (onClick)="print()" />
                }
            </div>

            <!-- Document -->
            <article class="card !mb-0 mx-auto flex max-w-4xl flex-col gap-6" aria-label="Facture">
                <header class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p class="!m-0 text-xs uppercase tracking-wide text-muted-color">Facture</p>
                        <h1 class="!m-0 !text-2xl !font-semibold">{{ inv.number || 'Brouillon' }}</h1>
                        @if (inv.issue_date) {
                            <p class="!m-0 mt-1 text-sm text-muted-color">Émise le {{ inv.issue_date | date: 'd MMMM y' }}</p>
                        }
                    </div>
                    <p-tag class="whitespace-nowrap" [value]="statusLabel()" [severity]="statusSeverity()" />
                </header>

                @if (inv.status === 'draft') {
                    <p class="!m-0 rounded-lg bg-surface-100 p-3 text-sm dark:bg-surface-800"><i class="pi pi-info-circle mr-2"></i>Brouillon : le numéro est attribué à l'émission. Une fois émise, la facture ne peut plus être modifiée.</p>
                }

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <p class="!m-0 text-xs uppercase tracking-wide text-muted-color">Émetteur</p>
                        @if (inv.status === 'issued') {
                            <p class="!m-0 font-semibold">{{ inv.seller_name }}</p>
                            <p class="!m-0 text-sm">NIU : {{ inv.seller_tax_id }}</p>
                        } @else {
                            <p class="!m-0 text-sm text-muted-color">Votre entreprise (figée à l'émission)</p>
                        }
                    </div>
                    <div>
                        <p class="!m-0 text-xs uppercase tracking-wide text-muted-color">Client</p>
                        <p class="!m-0 font-semibold">{{ inv.client_display_name }}</p>
                        @if (inv.client_address) {
                            <p class="!m-0 text-sm">{{ inv.client_address }}</p>
                        }
                        @if (inv.client_tax_id) {
                            <p class="!m-0 text-sm">NIU : {{ inv.client_tax_id }}</p>
                        }
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full min-w-[34rem] border-collapse text-sm">
                        <thead>
                            <tr class="border-b border-surface-200 text-left text-muted-color dark:border-surface-700">
                                <th class="py-2 pr-3 font-medium">Désignation</th>
                                <th class="px-3 py-2 text-right font-medium">Qté</th>
                                <th class="px-3 py-2 text-right font-medium">PU HT</th>
                                <th class="px-3 py-2 text-right font-medium">TVA</th>
                                <th class="py-2 pl-3 text-right font-medium">Total HT</th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (line of inv.lines; track $index) {
                                <tr class="border-b border-surface-100 dark:border-surface-800">
                                    <td class="py-2 pr-3">{{ line.description }}</td>
                                    <td class="px-3 py-2 text-right tabular-nums">{{ number(line.quantity) }}</td>
                                    <td class="px-3 py-2 text-right tabular-nums">{{ money(line.unit_price) }}</td>
                                    <td class="px-3 py-2 text-right tabular-nums">{{ number(line.tax_rate) }} %</td>
                                    <td class="py-2 pl-3 text-right tabular-nums">{{ money(line.subtotal) }}</td>
                                </tr>
                            } @empty {
                                <tr>
                                    <td colspan="5" class="py-4 text-center text-muted-color">Aucune ligne.</td>
                                </tr>
                            }
                        </tbody>
                    </table>
                </div>

                <dl class="m-0 ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
                    <div class="flex justify-between">
                        <dt class="text-muted-color">Total HT</dt>
                        <dd class="m-0 tabular-nums">{{ money(inv.subtotal) }}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-muted-color">TVA</dt>
                        <dd class="m-0 tabular-nums">{{ money(inv.tax_total) }}</dd>
                    </div>
                    <div class="flex justify-between border-t border-surface-200 pt-2 text-base font-semibold dark:border-surface-700">
                        <dt>Total TTC</dt>
                        <dd class="m-0 tabular-nums">{{ money(inv.total) }}</dd>
                    </div>
                </dl>

                <footer class="flex flex-col gap-1 text-sm">
                    @if (inv.due_date) {
                        <p class="!m-0" [class.text-red-600]="inv.is_overdue">
                            <strong>Échéance :</strong> {{ inv.due_date | date: 'd MMMM y' }}
                            @if (inv.is_overdue) {
                                (dépassée)
                            }
                        </p>
                    } @else {
                        <p class="!m-0"><strong>Échéance :</strong> à réception</p>
                    }
                    @if (inv.notes) {
                        <p class="!m-0 whitespace-pre-line text-muted-color">{{ inv.notes }}</p>
                    }
                </footer>
            </article>
        } @else if (!error()) {
            <div class="card !mb-0 mx-auto flex max-w-4xl flex-col gap-3" aria-busy="true"><p-skeleton height="3rem" /><p-skeleton height="10rem" /></div>
        }

        <p-confirmdialog />
    `
})
export class InvoiceDetail implements OnInit {
    private readonly billing = inject(BillingService);
    private readonly router = inject(Router);
    private readonly confirmation = inject(ConfirmationService);

    /** Route parameter (withComponentInputBinding). */
    readonly id = input.required<string>();

    readonly invoice = signal<Invoice | null>(null);
    readonly error = signal('');
    readonly needsCompanyDetails = signal(false);
    readonly busy = signal(false);
    readonly statusLabel = computed(() => (this.invoice() ? INVOICE_STATUS_LABELS[displayStatus(this.invoice()!)] : ''));
    readonly statusSeverity = computed(() => (this.invoice() ? INVOICE_STATUS_SEVERITY[displayStatus(this.invoice()!)] : 'secondary'));

    readonly invoicesPath = AppConstantRoute.Invoices_PATH;
    readonly profilePath = AppConstantRoute.Profile_PATH;

    ngOnInit(): void {
        this.billing.getInvoice(this.id()).subscribe({
            next: (invoice) => this.invoice.set(invoice),
            // Another company's invoice is a 404, like an unknown one.
            error: (error) => this.error.set(error?.status === 404 ? 'Facture introuvable.' : apiErrorMessage(error))
        });
    }

    money(amount: string): string {
        return formatMoney(amount, this.invoice()!.currency);
    }

    number(value: string): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(Number(value));
    }

    print(): void {
        window.print();
    }

    confirmIssue(inv: Invoice): void {
        this.confirmation.confirm({
            header: 'Émettre la facture',
            message: `Émettre la facture de ${formatMoney(inv.total, inv.currency)} pour « ${inv.client_display_name} » ? Elle recevra son numéro et ne pourra plus être modifiée.`,
            icon: 'pi pi-send',
            acceptLabel: 'Émettre',
            rejectLabel: 'Annuler',
            rejectButtonProps: { text: true },
            accept: () => this.issue(inv)
        });
    }

    confirmDelete(inv: Invoice): void {
        this.confirmation.confirm({
            header: 'Supprimer le brouillon',
            message: 'Supprimer ce brouillon de facture ? Cette action est définitive.',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { text: true },
            accept: () =>
                this.billing.deleteInvoice(inv.id).subscribe({
                    next: () => this.router.navigate(['/', AppConstantRoute.Invoices_PATH]),
                    error: (error) => this.error.set(apiErrorMessage(error))
                })
        });
    }

    private issue(inv: Invoice): void {
        this.busy.set(true);
        this.error.set('');
        this.needsCompanyDetails.set(false);
        this.billing.issueInvoice(inv.id).subscribe({
            next: (issued) => {
                this.invoice.set(issued);
                this.busy.set(false);
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.needsCompanyDetails.set(error instanceof HttpErrorResponse && error.error?.code === 'seller_details_missing');
                this.busy.set(false);
            }
        });
    }
}
