import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Client, ClientPayload, CrmService } from '@/app/core/crm/crm.service';
import { CLIENT_KIND_LABELS, CLIENT_STATUS_LABELS, selectOptions } from '@/app/core/crm/crm-labels';
import { apiErrorMessage } from '@/app/core/api-errors';

function emptyClient(): ClientPayload {
    // Cameroon first: the default country of a new client.
    return { name: '', kind: 'company', status: 'prospect', contact_name: '', email: '', phone: '', address: '', city: '', country: 'CM', tax_id: '', notes: '' };
}

/** US-03: create or edit a client record in a dialog. Pass `client` to edit. */
@Component({
    selector: 'app-client-form',
    standalone: true,
    imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TextareaModule],
    template: `
        <p-dialog [header]="client() ? 'Modifier le client' : 'Nouveau client'" [(visible)]="visible" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '640px': '95vw' }">
            <form class="grid grid-cols-12 gap-4" (ngSubmit)="save()">
                <div class="col-span-12 flex flex-col gap-2">
                    <label for="name" class="font-medium">Nom *</label>
                    <input pInputText id="name" name="name" [(ngModel)]="form.name" required autofocus />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="kind" class="font-medium">Type</label>
                    <p-select inputId="kind" name="kind" [(ngModel)]="form.kind" [options]="kindOptions" optionLabel="label" optionValue="value" />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="status" class="font-medium">Statut</label>
                    <p-select inputId="status" name="status" [(ngModel)]="form.status" [options]="statusOptions" optionLabel="label" optionValue="value" />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="contact_name" class="font-medium">Personne de contact</label>
                    <input pInputText id="contact_name" name="contact_name" [(ngModel)]="form.contact_name" />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="phone" class="font-medium">Téléphone</label>
                    <input pInputText id="phone" name="phone" type="tel" [(ngModel)]="form.phone" placeholder="+237 6XX XX XX XX" />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="email" class="font-medium">Email</label>
                    <input pInputText id="email" name="email" type="email" [(ngModel)]="form.email" />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="tax_id" class="font-medium">Identifiant fiscal (NIU)</label>
                    <input pInputText id="tax_id" name="tax_id" [(ngModel)]="form.tax_id" />
                </div>
                <div class="col-span-12 flex flex-col gap-2 sm:col-span-6">
                    <label for="address" class="font-medium">Adresse</label>
                    <input pInputText id="address" name="address" [(ngModel)]="form.address" />
                </div>
                <div class="col-span-8 flex flex-col gap-2 sm:col-span-4">
                    <label for="city" class="font-medium">Ville</label>
                    <input pInputText id="city" name="city" [(ngModel)]="form.city" />
                </div>
                <div class="col-span-4 flex flex-col gap-2 sm:col-span-2">
                    <label for="country" class="font-medium">Pays</label>
                    <input pInputText id="country" name="country" [(ngModel)]="form.country" maxlength="2" placeholder="CM" />
                </div>
                <div class="col-span-12 flex flex-col gap-2">
                    <label for="notes" class="font-medium">Notes</label>
                    <textarea pTextarea id="notes" name="notes" [(ngModel)]="form.notes" rows="3" [autoResize]="true"></textarea>
                </div>
                @if (error()) {
                    <p class="col-span-12 m-0 text-sm text-red-600" role="alert">{{ error() }}</p>
                }
            </form>
            <ng-template #footer>
                <p-button label="Annuler" [text]="true" (onClick)="visible.set(false)" />
                <!-- Outside the <form>: p-button does not forward the form attribute, so call save() directly. -->
                <p-button label="Enregistrer" (onClick)="save()" icon="pi pi-check" [loading]="saving()" [disabled]="!form.name.trim()" />
            </ng-template>
        </p-dialog>
    `
})
export class ClientForm {
    private readonly crm = inject(CrmService);

    readonly client = input<Client | null>(null);
    readonly visible = model(false);
    readonly saved = output<Client>();

    readonly saving = signal(false);
    readonly error = signal('');
    readonly kindOptions = selectOptions(CLIENT_KIND_LABELS);
    readonly statusOptions = selectOptions(CLIENT_STATUS_LABELS);

    form: ClientPayload = emptyClient();

    constructor() {
        // Reset the form each time the dialog opens.
        effect(() => {
            if (!this.visible()) return;
            const client = this.client();
            this.form = client ? { ...emptyClient(), ...pick(client) } : emptyClient();
            this.error.set('');
        });
    }

    save(): void {
        if (!this.form.name.trim() || this.saving()) return;
        this.saving.set(true);
        this.error.set('');
        const client = this.client();
        const request = client ? this.crm.updateClient(client.id, this.form) : this.crm.createClient(this.form);
        request.subscribe({
            next: (result) => {
                this.saving.set(false);
                this.visible.set(false);
                this.saved.emit(result);
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }
}

function pick(client: Client): ClientPayload {
    const { name, kind, status, contact_name, email, phone, address, city, country, tax_id, notes } = client;
    return { name, kind, status, contact_name, email, phone, address, city, country, tax_id, notes };
}
