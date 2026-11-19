import { Component, ElementRef, inject, model, output, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ClientImportResult, CrmService } from '@/app/core/crm/crm.service';
import { apiErrorMessage } from '@/app/core/api-errors';

/** A ready-to-fill template: semicolons, as Excel in French saves CSV. */
const TEMPLATE = '\ufeffNom;Statut;Type;Contact;Téléphone;Email;Ville;Pays;NIU;Notes\n' + 'Boulangerie du Port;prospect;entreprise;Jean Mbarga;+237 600 00 00 00;contact@exemple.cm;Douala;CM;;Rencontré au salon\n';

/**
 * US-23: import contacts from a CSV (Excel, Google Contacts, phone export).
 * Two steps: check (nothing is created), then import what is valid.
 */
@Component({
    selector: 'app-client-import',
    standalone: true,
    imports: [ButtonModule, DialogModule],
    template: `
        <p-dialog header="Importer des contacts" [(visible)]="visible" [modal]="true" [focusOnShow]="false" [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '95vw' }" (onHide)="reset()">
            <div class="flex flex-col gap-4 text-sm">
                <p class="!m-0">
                    Fichier CSV avec une colonne <strong>Nom</strong> (obligatoire) et, si vous les avez : Statut (prospect, client, inactif), Type (entreprise, particulier), Contact, Téléphone, Email, Ville, Pays, NIU, Notes. Les contacts déjà
                    présents (même nom ou même téléphone) sont ignorés. Les exports Google Contacts et « Texte Unicode » d'Excel sont aussi acceptés.
                </p>
                <div>
                    <a [href]="templateUrl" download="modele-contacts.csv" class="font-medium text-primary"><i class="pi pi-download mr-1"></i>Télécharger un modèle</a>
                </div>

                <label class="flex flex-col gap-2">
                    <span class="font-medium">Votre fichier</span>
                    <input #fileInput type="file" accept=".csv,.txt,text/csv,text/plain" (change)="pick($event)" class="text-sm" />
                </label>

                @if (error()) {
                    <p class="!m-0 text-red-600" role="alert">{{ error() }}</p>
                }

                @if (result(); as r) {
                    <div class="flex flex-col gap-2 rounded-lg bg-surface-100 p-3 dark:bg-surface-800" role="status">
                        @if (r.dry_run) {
                            <p class="!m-0">
                                @if (r.new_count) {
                                    <strong>{{ r.new_count }}</strong> {{ r.new_count > 1 ? 'nouveaux contacts seront créés' : 'nouveau contact sera créé' }} sur {{ r.rows }} {{ r.rows > 1 ? 'lignes' : 'ligne' }}.
                                } @else {
                                    Aucun nouveau contact à créer sur {{ r.rows }} {{ r.rows > 1 ? 'lignes' : 'ligne' }}.
                                }
                            </p>
                        } @else {
                            <p class="!m-0 font-semibold text-green-700 dark:text-green-400"><i class="pi pi-check-circle mr-1"></i>{{ r.new_count }} {{ r.new_count > 1 ? 'contacts importés' : 'contact importé' }}.</p>
                        }
                        @if (r.dry_run && r.preview.length) {
                            <p class="!m-0 text-muted-color">{{ r.preview.join(', ') }}{{ r.new_count > r.preview.length ? '…' : '' }}</p>
                        }
                        @if (r.skipped.length) {
                            <p class="!m-0">{{ r.skipped.length }} déjà {{ r.skipped.length > 1 ? 'présents, ignorés' : 'présent, ignoré' }} : {{ names(r.skipped) }}</p>
                        }
                        @if (r.errors.length) {
                            <details>
                                <summary class="cursor-pointer text-red-700 dark:text-red-300">{{ r.errors.length }} {{ r.errors.length > 1 ? 'lignes refusées' : 'ligne refusée' }}</summary>
                                <ul class="m-0 mt-1 list-none p-0">
                                    @for (e of r.errors; track e.line) {
                                        <li>Ligne {{ e.line }}{{ e.name ? ' (' + e.name + ')' : '' }} : {{ (e.messages ?? []).join(' ') }}</li>
                                    }
                                </ul>
                            </details>
                        }
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Fermer" [text]="true" (onClick)="visible.set(false)" />
                @if (!result() || result()!.dry_run) {
                    @if (result()?.dry_run && result()!.new_count > 0) {
                        <p-button [label]="'Importer ' + result()!.new_count + (result()!.new_count > 1 ? ' contacts' : ' contact')" icon="pi pi-upload" [loading]="busy()" (onClick)="run(false)" />
                    } @else {
                        <p-button label="Vérifier le fichier" icon="pi pi-search" [loading]="busy()" [disabled]="!file" (onClick)="run(true)" />
                    }
                }
            </ng-template>
        </p-dialog>
    `
})
export class ClientImport {
    private readonly crm = inject(CrmService);

    readonly visible = model(false);
    readonly imported = output<void>();

    readonly result = signal<ClientImportResult | null>(null);
    readonly error = signal('');
    readonly busy = signal(false);
    readonly templateUrl = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }));

    file: File | null = null;
    private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

    pick(event: Event): void {
        this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
        this.result.set(null);
        this.error.set('');
    }

    names(lines: { name?: string }[]): string {
        return (
            lines
                .map((l) => l.name ?? '')
                .filter(Boolean)
                .slice(0, 5)
                .join(', ') + (lines.length > 5 ? '…' : '')
        );
    }

    run(dryRun: boolean): void {
        if (!this.file || this.busy()) return;
        this.busy.set(true);
        this.error.set('');
        this.crm.importClients(this.file, dryRun).subscribe({
            next: (result) => {
                this.result.set(result);
                this.busy.set(false);
                if (!dryRun) this.imported.emit();
            },
            error: (error) => {
                this.error.set(apiErrorMessage(error));
                this.busy.set(false);
            }
        });
    }

    reset(): void {
        this.file = null;
        // Clear the native input too: choosing the same file again must fire "change".
        const input = this.fileInput()?.nativeElement;
        if (input) input.value = '';
        this.result.set(null);
        this.error.set('');
    }
}
