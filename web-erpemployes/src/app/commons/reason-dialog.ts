import { Component, effect, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';

/**
 * Asks why an entry is cancelled (payment, cash movement, invoice) before the
 * correction is made. The reason stays in the books, so it is required.
 */
@Component({
    selector: 'app-reason-dialog',
    standalone: true,
    imports: [FormsModule, ButtonModule, DialogModule, TextareaModule],
    template: `
        <p-dialog [header]="header()" [(visible)]="visible" [modal]="true" [focusOnShow]="false" [style]="{ width: '30rem' }" [breakpoints]="{ '640px': '95vw' }">
            <div class="flex flex-col gap-3">
                <p class="!m-0 text-sm">{{ message() }}</p>
                <label for="cancel-reason" class="text-sm font-medium">Motif *</label>
                <textarea pTextarea id="cancel-reason" [(ngModel)]="reason" rows="2" [autoResize]="true" maxlength="255" placeholder="Ex. : saisi deux fois, transfert échoué…" class="w-full"></textarea>
                @if (error()) {
                    <p class="!m-0 text-sm text-red-600" role="alert">{{ error() }}</p>
                }
            </div>
            <ng-template #footer>
                <p-button label="Retour" [text]="true" (onClick)="visible.set(false)" />
                <p-button [label]="confirmLabel()" severity="danger" icon="pi pi-replay" [loading]="loading()" [disabled]="reason.trim().length < 3" (onClick)="confirmed.emit(reason.trim())" />
            </ng-template>
        </p-dialog>
    `
})
export class ReasonDialog {
    readonly header = input.required<string>();
    readonly message = input.required<string>();
    readonly confirmLabel = input('Annuler l’écriture');
    readonly loading = input(false);
    readonly error = input('');
    readonly visible = model(false);
    readonly confirmed = output<string>();

    reason = '';

    constructor() {
        effect(() => {
            if (this.visible()) this.reason = '';
        });
    }
}
