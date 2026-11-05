import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { BillingService, Invoice, InvoicePayload, InvoicingRules } from '@/app/core/billing/billing.service';
import { formatMoney, lineTotals } from '@/app/core/billing/money';
import { CrmService } from '@/app/core/crm/crm.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { AppConstantRoute } from '@/app/constants';
import { PageHeader } from '@/app/commons/page-header';

interface EditableLine {
    description: string;
    quantity: number | null;
    unit_price: number | null;
    tax_rate_code: string;
}

interface ClientOption {
    id: string;
    name: string;
}

/** yyyy-mm-dd of today + `days`, in local time, for <input type="date">. */
function inDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * US-14: create or edit a draft invoice. Routes: factures/nouvelle (optional
 * ?client=<id>) and factures/<id>/modifier. Amounts are previewed as the
 * founder types; the API recomputes them on save.
 */
@Component({
    selector: 'app-invoice-editor',
    standalone: true,
    imports: [FormsModule, RouterLink, ButtonModule, InputNumberModule, InputTextModule, SelectModule, SkeletonModule, TextareaModule, PageHeader],
    template: `
        <app-page-header [title]="id() ? 'Modifier le brouillon' : 'Nouvelle facture'" subtitle="Un brouillon reste modifiable jusqu'à son émission.">
            <p-button label="Annuler" [text]="true" [routerLink]="id() ? ['/', invoicesPath, id()] : ['/', invoicesPath]" />
        </app-page-header>

        @if (loadError()) {
            <div class="card !mb-0 text-sm text-red-700 dark:text-red-300" role="alert"><i class="pi pi-exclamation-circle mr-2"></i>{{ loadError() }}</div>
        } @else if (!rules()) {
            <div class="card !mb-0 flex flex-col gap-3" aria-busy="true"><p-skeleton height="3rem" /><p-skeleton height="8rem" /></div>
        } @else {
            <form class="grid grid-cols-12 gap-6" (ngSubmit)="save()">
                <div class="col-span-12 flex flex-col gap-6 lg:col-span-8">
                    <div class="card !mb-0 grid grid-cols-12 gap-4">
                        <div class="col-span-12 flex flex-col gap-2 md:col-span-6">
                            <label for="client" class="font-medium">Client *</label>
                            <p-select
                                inputId="client"
                                name="client"
                                [(ngModel)]="clientId"
                                [options]="clientOptions()"
                                optionLabel="name"
                                optionValue="id"
                                [filter]="true"
                                filterPlaceholder="Rechercher un client"
                                [resetFilterOnHide]="true"
                                (onFilter)="searchClients($event.filter)"
                                placeholder="Choisir un client"
                                emptyMessage="Aucun client. Créez d'abord sa fiche."
                                emptyFilterMessage="Aucun client trouvé"
                                class="w-full"
                            />
                        </div>
                        <div class="col-span-12 flex flex-col gap-2 md:col-span-6">
                            <label for="due_date" class="font-medium">Échéance</label>
                            <input pInputText id="due_date" name="due_date" type="date" [(ngModel)]="dueDate" />
                            <div class="flex flex-wrap gap-1">
                                @for (shortcut of dueShortcuts; track shortcut.label) {
                                    <p-button [label]="shortcut.label" size="small" [text]="true" (onClick)="dueDate = shortcut.days === null ? '' : inDays(shortcut.days)" />
                                }
                            </div>
                            <small class="text-muted-color">{{ dueDate ? '' : "Sans date : payable à réception, à la date d'émission." }}</small>
                        </div>
                    </div>

                    <div class="card !mb-0 flex flex-col gap-4">
                        <h2 class="!m-0 !text-lg font-semibold">Lignes</h2>

                        @for (line of lines; track $index; let i = $index) {
                            <fieldset class="m-0 grid grid-cols-12 gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
                                <legend class="sr-only">Ligne {{ i + 1 }}</legend>
                                <div class="col-span-12 flex flex-col gap-1">
                                    <label [for]="'description-' + i" class="text-sm font-medium">Désignation</label>
                                    <input pInputText [id]="'description-' + i" [name]="'description-' + i" [(ngModel)]="line.description" placeholder="Ex. : Livraison de pain, novembre" maxlength="500" />
                                </div>
                                <div class="col-span-4 flex flex-col gap-1 sm:col-span-2">
                                    <label [for]="'quantity-' + i" class="text-sm font-medium">Qté</label>
                                    <p-inputnumber [inputId]="'quantity-' + i" [name]="'quantity-' + i" [(ngModel)]="line.quantity" [min]="0" [maxFractionDigits]="3" locale="fr-FR" inputStyleClass="w-full" />
                                </div>
                                <div class="col-span-8 flex flex-col gap-1 sm:col-span-4">
                                    <label [for]="'unit_price-' + i" class="text-sm font-medium">Prix unitaire HT ({{ rules()!.currency }})</label>
                                    <p-inputnumber [inputId]="'unit_price-' + i" [name]="'unit_price-' + i" [(ngModel)]="line.unit_price" [min]="0" [maxFractionDigits]="rules()!.currency_decimals" locale="fr-FR" inputStyleClass="w-full" />
                                </div>
                                <div class="col-span-12 flex flex-col gap-1 sm:col-span-6">
                                    <label [for]="'tax-' + i" class="text-sm font-medium">TVA</label>
                                    <p-select [inputId]="'tax-' + i" [name]="'tax-' + i" [(ngModel)]="line.tax_rate_code" [options]="rules()!.tax_rates" optionLabel="label" optionValue="code" class="w-full" />
                                </div>
                                <div class="col-span-12 flex items-center justify-between gap-3">
                                    <span class="text-sm text-muted-color"
                                        >Total HT : <strong class="tabular-nums text-color">{{ money(totalsOf(line).subtotal) }}</strong></span
                                    >
                                    <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" [ariaLabel]="'Supprimer la ligne ' + (i + 1)" (onClick)="removeLine(i)" />
                                </div>
                            </fieldset>
                        }

                        <div>
                            <p-button label="Ajouter une ligne" icon="pi pi-plus" [outlined]="true" size="small" (onClick)="addLine()" />
                        </div>
                    </div>

                    <div class="card !mb-0 flex flex-col gap-2">
                        <label for="notes" class="font-medium">Notes</label>
                        <textarea pTextarea id="notes" name="notes" [(ngModel)]="notes" rows="2" [autoResize]="true" placeholder="Conditions de paiement, référence de commande… (imprimé sur la facture)"></textarea>
                    </div>
                </div>

                <!-- Totals stay visible next to the lines on wide screens, after them on phones. -->
                <div class="col-span-12 lg:col-span-4">
                    <div class="card !mb-0 flex flex-col gap-3 lg:sticky lg:top-24">
                        <h2 class="!m-0 !text-lg font-semibold">Total</h2>
                        <dl class="m-0 flex flex-col gap-2 text-sm">
                            <div class="flex justify-between">
                                <dt class="text-muted-color">Total HT</dt>
                                <dd class="m-0 tabular-nums">{{ money(totals().subtotal) }}</dd>
                            </div>
                            <div class="flex justify-between">
                                <dt class="text-muted-color">TVA</dt>
                                <dd class="m-0 tabular-nums">{{ money(totals().tax) }}</dd>
                            </div>
                            <div class="flex justify-between border-t border-surface-200 pt-2 text-base font-semibold dark:border-surface-700">
                                <dt>Total TTC</dt>
                                <dd class="m-0 tabular-nums">{{ money(totals().subtotal + totals().tax) }}</dd>
                            </div>
                        </dl>
                        @if (saveError()) {
                            <p class="m-0 text-sm text-red-600" role="alert">{{ saveError() }}</p>
                        }
                        <p-button type="submit" label="Enregistrer le brouillon" icon="pi pi-check" [loading]="saving()" [disabled]="!canSave()" styleClass="w-full" />
                        @if (!canSave()) {
                            <small class="text-muted-color">Choisissez un client et complétez chaque ligne (désignation, quantité, prix).</small>
                        }
                    </div>
                </div>
            </form>
        }
    `
})
export class InvoiceEditor implements OnInit {
    private readonly billing = inject(BillingService);
    private readonly crm = inject(CrmService);
    private readonly router = inject(Router);

    /** Route parameter when editing a draft. */
    readonly id = input<string>();
    /** ?client=<id> when started from a client record. */
    readonly client = input<string>();

    readonly rules = signal<InvoicingRules | null>(null);
    readonly clientOptions = signal<ClientOption[]>([]);
    readonly saving = signal(false);
    readonly saveError = signal('');
    readonly loadError = signal('');

    readonly invoicesPath = AppConstantRoute.Invoices_PATH;
    readonly inDays = inDays;
    readonly dueShortcuts = [
        { label: 'À réception', days: null },
        { label: '15 jours', days: 15 },
        { label: '30 jours', days: 30 }
    ];

    clientId: string | null = null;
    dueDate = '';
    notes = '';
    lines: EditableLine[] = [];
    private searchTimer?: ReturnType<typeof setTimeout>;
    private pinned: ClientOption | null = null;

    ngOnInit(): void {
        this.billing.getRules().subscribe({
            next: (rules) => {
                this.rules.set(rules);
                if (!this.id() && this.lines.length === 0) this.addLine();
            },
            error: (error) => this.loadError.set(apiErrorMessage(error))
        });

        const id = this.id();
        if (id) {
            this.billing.getInvoice(id).subscribe({
                next: (invoice) => this.fill(invoice),
                error: (error) => this.loadError.set(error?.status === 404 ? 'Facture introuvable.' : apiErrorMessage(error))
            });
        } else if (this.client()) {
            this.crm.getClient(this.client()!).subscribe({
                next: (client) => {
                    this.pin({ id: client.id, name: client.name });
                    this.clientId = client.id;
                },
                error: () => undefined // Unknown client: the founder just picks one.
            });
        }
        this.searchClients('');
    }

    searchClients(query: string): void {
        clearTimeout(this.searchTimer);
        // Short pause so a fast typist sends one request, not one per letter.
        this.searchTimer = setTimeout(() => {
            this.crm.listClients(1, query ?? '').subscribe({
                next: (page) => this.setOptions(page.results.map((c) => ({ id: c.id, name: c.name }))),
                error: () => undefined
            });
        }, 250);
    }

    addLine(): void {
        this.lines = [...this.lines, { description: '', quantity: 1, unit_price: null, tax_rate_code: this.rules()?.default_tax_rate ?? '' }];
    }

    removeLine(index: number): void {
        this.lines = this.lines.filter((_, i) => i !== index);
    }

    totalsOf(line: EditableLine) {
        const rules = this.rules()!;
        const rate = Number(rules.tax_rates.find((r) => r.code === line.tax_rate_code)?.rate ?? 0);
        return lineTotals(line.quantity ?? 0, line.unit_price ?? 0, rate, rules.currency_decimals);
    }

    totals(): { subtotal: number; tax: number } {
        return this.lines.reduce(
            (sum, line) => {
                const t = this.totalsOf(line);
                return { subtotal: sum.subtotal + t.subtotal, tax: sum.tax + t.tax };
            },
            { subtotal: 0, tax: 0 }
        );
    }

    money(amount: number): string {
        const rules = this.rules()!;
        return formatMoney(amount, rules.currency, rules.currency_decimals);
    }

    canSave(): boolean {
        return !!this.clientId && this.lines.every((l) => l.description.trim() && (l.quantity ?? 0) > 0 && l.unit_price !== null && l.unit_price >= 0);
    }

    save(): void {
        if (!this.canSave() || this.saving()) return;
        const payload: InvoicePayload = {
            client: this.clientId!,
            due_date: this.dueDate || null,
            notes: this.notes.trim(),
            lines: this.lines.map((l) => ({ description: l.description.trim(), quantity: String(l.quantity), unit_price: String(l.unit_price), tax_rate_code: l.tax_rate_code }))
        };
        const id = this.id();
        this.saving.set(true);
        this.saveError.set('');
        (id ? this.billing.updateInvoice(id, payload) : this.billing.createInvoice(payload)).subscribe({
            next: (invoice) => this.router.navigate(['/', AppConstantRoute.Invoices_PATH, invoice.id]),
            error: (error) => {
                this.saveError.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }

    private fill(invoice: Invoice): void {
        if (invoice.status !== 'draft') {
            // Issued invoices are frozen: show them instead.
            this.router.navigate(['/', AppConstantRoute.Invoices_PATH, invoice.id]);
            return;
        }
        this.pin({ id: invoice.client_id, name: invoice.client_display_name });
        this.clientId = invoice.client_id;
        this.dueDate = invoice.due_date ?? '';
        this.notes = invoice.notes;
        this.lines = invoice.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price), tax_rate_code: l.tax_rate_code }));
    }

    /** Keep the chosen client in the options even when a search does not return it. */
    private pin(option: ClientOption): void {
        this.pinned = option;
        this.setOptions(this.clientOptions());
    }

    private setOptions(options: ClientOption[]): void {
        const pinned = this.pinned;
        this.clientOptions.set(pinned && !options.some((o) => o.id === pinned.id) ? [pinned, ...options] : options);
    }
}
