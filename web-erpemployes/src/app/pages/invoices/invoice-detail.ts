import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { HttpErrorResponse } from '@angular/common/http';
import { BillingService, Invoice, PaymentMethod } from '@/app/core/billing/billing.service';
import { AdvisorService, ReminderChannel, ReminderTone } from '@/app/core/advisor/advisor.service';
import { CrmService } from '@/app/core/crm/crm.service';
import { displayStatus, formatMoney, INVOICE_STATUS_LABELS, INVOICE_STATUS_SEVERITY } from '@/app/core/billing/money';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';

/** US-14: one invoice, laid out like the document the client receives. */
@Component({
    selector: 'app-invoice-detail',
    standalone: true,
    imports: [DatePipe, FormsModule, RouterLink, ButtonModule, ConfirmDialogModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, SelectButtonModule, SkeletonModule, TagModule, TextareaModule],
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
                    @if (inv.status === 'issued') {
                        <p-button label="Enregistrer un paiement" icon="pi pi-wallet" (onClick)="openPayment(inv)" />
                        <p-button label="Rédiger une relance" icon="pi pi-sparkles" [outlined]="true" (onClick)="openReminder(inv)" />
                    }
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
                        @if (inv.status !== 'draft') {
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
                    @if (inv.status !== 'draft') {
                        <div class="flex justify-between">
                            <dt class="text-muted-color">Déjà payé</dt>
                            <dd class="m-0 tabular-nums">{{ money(inv.amount_paid) }}</dd>
                        </div>
                        <div class="flex justify-between font-semibold" [class.text-red-600]="inv.is_overdue">
                            <dt>Reste à payer</dt>
                            <dd class="m-0 tabular-nums">{{ money(inv.balance_due) }}</dd>
                        </div>
                    }
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

            <!-- Payments received (not printed: the totals above show what is paid) -->
            @if (inv.status !== 'draft') {
                <section class="card !mb-0 mx-auto mt-6 flex max-w-4xl flex-col gap-3 print:hidden" aria-labelledby="payments-title">
                    <h2 id="payments-title" class="!m-0 !text-lg font-semibold">Paiements reçus</h2>
                    @for (p of inv.payments; track p.id) {
                        <div class="flex items-center justify-between gap-3 border-b border-surface-100 pb-2 text-sm last:border-0 dark:border-surface-800">
                            <div>
                                <div class="font-medium">{{ methodLabel(p.method) }}</div>
                                <div class="text-xs text-muted-color">
                                    {{ p.paid_on | date: 'd MMMM y' }}
                                    @if (p.reference) {
                                        · réf. {{ p.reference }}
                                    }
                                </div>
                            </div>
                            <span class="font-semibold tabular-nums">{{ money(p.amount) }}</span>
                        </div>
                    } @empty {
                        <p class="!m-0 text-sm text-muted-color">Aucun paiement enregistré pour l'instant.</p>
                    }
                </section>
            }

            <!-- Record a payment -->
            <!-- focusOnShow off: PrimeNG focusing the number field during a render pass trips a dev-mode check (NG0100). -->
            <p-dialog header="Enregistrer un paiement" [focusOnShow]="false" [(visible)]="paymentVisible" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '640px': '95vw' }">
                <form id="payment-form" class="flex flex-col gap-4" (ngSubmit)="savePayment(inv)">
                    <p class="!m-0 text-sm text-muted-color">
                        Reste à payer : <strong class="text-color">{{ money(paymentBalance) }}</strong>
                    </p>
                    <div class="flex flex-col gap-2">
                        <label for="payment_amount" class="font-medium">Montant reçu ({{ inv.currency }})</label>
                        <p-inputnumber inputId="payment_amount" name="amount" [(ngModel)]="paymentAmount" [min]="0" [max]="paymentBalance" locale="fr-FR" inputStyleClass="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="payment_date" class="font-medium">Date du paiement</label>
                        <input pInputText id="payment_date" name="paid_on" type="date" [(ngModel)]="paymentDate" [max]="today" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="payment_method" class="font-medium">Moyen de paiement</label>
                        <p-select inputId="payment_method" name="method" [(ngModel)]="paymentMethod" [options]="paymentMethods()" optionLabel="label" optionValue="code" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="payment_reference" class="font-medium">Référence (facultatif)</label>
                        <input pInputText id="payment_reference" name="reference" [(ngModel)]="paymentReference" maxlength="100" placeholder="N° de transaction Mobile Money, de chèque…" />
                    </div>
                    @if (paymentError()) {
                        <p class="!m-0 text-sm text-red-600" role="alert">{{ paymentError() }}</p>
                    }
                </form>
                <ng-template #footer>
                    <p-button label="Annuler" [text]="true" (onClick)="paymentVisible = false" />
                    <p-button label="Enregistrer" icon="pi pi-check" [loading]="busy()" [disabled]="!canSavePayment(inv)" (onClick)="savePayment(inv)" />
                </ng-template>
            </p-dialog>

            <!-- Payment reminder drafted by the advisor agent, sent by the founder -->
            <p-dialog header="Relance de paiement" [(visible)]="reminderVisible" [modal]="true" [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '95vw' }">
                <div class="flex flex-col gap-4">
                    <div class="flex flex-wrap gap-4">
                        <div class="flex flex-col gap-2">
                            <span class="text-sm font-medium" id="channel-label">Canal</span>
                            <p-selectbutton [options]="channelOptions" [(ngModel)]="reminderChannel" optionLabel="label" optionValue="value" [allowEmpty]="false" ariaLabelledBy="channel-label" size="small" />
                        </div>
                        <div class="flex flex-col gap-2">
                            <span class="text-sm font-medium" id="tone-label">Ton</span>
                            <p-selectbutton [options]="toneOptions" [(ngModel)]="reminderTone" optionLabel="label" optionValue="value" [allowEmpty]="false" ariaLabelledBy="tone-label" size="small" />
                        </div>
                    </div>
                    <div>
                        <p-button [label]="reminderText ? 'Rédiger à nouveau' : 'Rédiger la relance'" icon="pi pi-sparkles" [outlined]="!!reminderText" [loading]="drafting()" (onClick)="draftReminder(inv)" />
                    </div>
                    @if (reminderError()) {
                        <p class="!m-0 text-sm text-red-600" role="alert">{{ reminderError() }}</p>
                    }
                    @if (reminderText || drafted()) {
                        @if (reminderChannel === 'email') {
                            <div class="flex flex-col gap-2">
                                <label for="reminder_subject" class="text-sm font-medium">Objet</label>
                                <input pInputText id="reminder_subject" [(ngModel)]="reminderSubject" />
                            </div>
                        }
                        <div class="flex flex-col gap-2">
                            <label for="reminder_message" class="text-sm font-medium">Message (modifiable)</label>
                            <textarea pTextarea id="reminder_message" [(ngModel)]="reminderText" rows="8" [autoResize]="true" class="w-full"></textarea>
                        </div>
                        <p class="!m-0 flex items-start gap-2 text-xs text-muted-color"><i class="pi pi-info-circle mt-0.5" aria-hidden="true"></i>Brouillon rédigé par l'assistant à partir de la facture. Relisez-le : rien n'est envoyé sans vous.</p>
                        <div class="flex flex-wrap gap-2">
                            @if (reminderChannel === 'whatsapp') {
                                <a pButton [href]="whatsappUrl()" target="_blank" rel="noopener" severity="success"><i pButtonIcon class="pi pi-whatsapp"></i><span pButtonLabel>Ouvrir WhatsApp</span></a>
                            } @else {
                                <a pButton [href]="mailtoUrl()"><i pButtonIcon class="pi pi-envelope"></i><span pButtonLabel>Ouvrir l'email</span></a>
                            }
                            <p-button [label]="copied() ? 'Copié' : 'Copier'" [icon]="copied() ? 'pi pi-check' : 'pi pi-copy'" [outlined]="true" (onClick)="copyReminder()" />
                        </div>
                    }
                </div>
            </p-dialog>
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
    private readonly advisor = inject(AdvisorService);
    private readonly crm = inject(CrmService);

    /** Route parameter (withComponentInputBinding). */
    readonly id = input.required<string>();

    readonly invoice = signal<Invoice | null>(null);
    readonly error = signal('');
    readonly needsCompanyDetails = signal(false);
    readonly busy = signal(false);
    readonly paymentMethods = signal<PaymentMethod[]>([]);
    readonly paymentError = signal('');
    readonly drafting = signal(false);
    readonly drafted = signal(false);
    readonly reminderError = signal('');
    readonly copied = signal(false);

    readonly today = localDate(0);
    readonly channelOptions: { label: string; value: ReminderChannel }[] = [
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Email', value: 'email' }
    ];
    readonly toneOptions: { label: string; value: ReminderTone }[] = [
        { label: 'Cordial', value: 'friendly' },
        { label: 'Ferme', value: 'firm' }
    ];

    paymentVisible = false;
    paymentAmount: number | null = null;
    paymentBalance = 0;
    paymentDate = localDate(0);
    paymentMethod = '';
    paymentReference = '';

    reminderVisible = false;
    reminderChannel: ReminderChannel = 'whatsapp';
    reminderTone: ReminderTone = 'friendly';
    reminderSubject = '';
    reminderText = '';
    private clientPhone = '';
    private clientEmail = '';
    readonly statusLabel = computed(() => (this.invoice() ? INVOICE_STATUS_LABELS[displayStatus(this.invoice()!)] : ''));
    readonly statusSeverity = computed(() => (this.invoice() ? INVOICE_STATUS_SEVERITY[displayStatus(this.invoice()!)] : 'secondary'));

    readonly invoicesPath = AppConstantRoute.Invoices_PATH;
    readonly profilePath = AppConstantRoute.Profile_PATH;

    ngOnInit(): void {
        this.billing.getRules().subscribe({
            next: (rules) => {
                this.paymentMethods.set(rules.payment_methods);
                this.paymentMethod ||= rules.payment_methods[0]?.code ?? '';
            },
            error: () => undefined // Only needed to record a payment.
        });
        this.billing.getInvoice(this.id()).subscribe({
            next: (invoice) => this.invoice.set(invoice),
            // Another company's invoice is a 404, like an unknown one.
            error: (error) => this.error.set(error?.status === 404 ? 'Facture introuvable.' : apiErrorMessage(error))
        });
    }

    money(amount: string | number): string {
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

    methodLabel(code: string): string {
        return this.paymentMethods().find((m) => m.code === code)?.label ?? code;
    }

    canSavePayment(inv: Invoice): boolean {
        return !!this.paymentAmount && this.paymentAmount > 0 && this.paymentAmount <= this.paymentBalance && !!this.paymentDate && !!this.paymentMethod;
    }

    openPayment(inv: Invoice): void {
        // Fixed while the dialog is open: the balance changes once the payment is saved.
        this.paymentBalance = Number(inv.balance_due);
        this.paymentAmount = this.paymentBalance;
        this.paymentDate = localDate(0);
        this.paymentReference = '';
        this.paymentError.set('');
        this.paymentVisible = true;
    }

    savePayment(inv: Invoice): void {
        if (!this.canSavePayment(inv) || this.busy()) return;
        this.busy.set(true);
        this.paymentError.set('');
        this.billing.recordPayment(inv.id, { amount: String(this.paymentAmount), paid_on: this.paymentDate, method: this.paymentMethod, reference: this.paymentReference.trim() }).subscribe({
            next: (updated) => {
                this.invoice.set(updated);
                this.paymentVisible = false;
                this.busy.set(false);
            },
            error: (error) => {
                this.paymentError.set(apiErrorMessage(error));
                this.busy.set(false);
            }
        });
    }

    openReminder(inv: Invoice): void {
        this.reminderError.set('');
        this.copied.set(false);
        this.reminderVisible = true;
        this.crm.getClient(inv.client_id).subscribe({
            next: (client) => {
                this.clientPhone = client.phone;
                this.clientEmail = client.email;
            },
            error: () => undefined // Without contact details the founder picks the recipient.
        });
    }

    draftReminder(inv: Invoice): void {
        if (this.drafting()) return;
        this.drafting.set(true);
        this.reminderError.set('');
        this.copied.set(false);
        this.advisor.draftReminder(inv.id, this.reminderChannel, this.reminderTone).subscribe({
            next: (draft) => {
                this.reminderText = draft.answer;
                this.reminderSubject = draft.subject;
                this.drafted.set(true);
                this.drafting.set(false);
            },
            error: (error) => {
                this.reminderError.set(apiErrorMessage(error));
                this.drafting.set(false);
            }
        });
    }

    /** wa.me needs an international number; otherwise WhatsApp asks for the contact. */
    whatsappUrl(): string {
        const digits = this.clientPhone.replace(/\D/g, '').replace(/^00/, '');
        const international = this.clientPhone.trim().startsWith('+') || this.clientPhone.trim().startsWith('00');
        const target = international && digits.length >= 8 ? digits : '';
        return `https://wa.me/${target}?text=${encodeURIComponent(this.reminderText)}`;
    }

    mailtoUrl(): string {
        return `mailto:${this.clientEmail}?subject=${encodeURIComponent(this.reminderSubject)}&body=${encodeURIComponent(this.reminderText)}`;
    }

    copyReminder(): void {
        const text = this.reminderChannel === 'email' && this.reminderSubject ? `${this.reminderSubject}\n\n${this.reminderText}` : this.reminderText;
        navigator.clipboard?.writeText(text).then(
            () => this.copied.set(true),
            () => this.reminderError.set('Copie impossible : sélectionnez le texte et copiez-le.')
        );
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

/** yyyy-mm-dd in local time, `days` from today. */
function localDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
