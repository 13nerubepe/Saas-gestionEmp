import { Component, inject, signal } from '@angular/core';
import {ButtonDirective} from "primeng/button";
import {Checkbox} from "primeng/checkbox";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {InputText} from "primeng/inputtext";
import {Password} from "primeng/password";
import {RouterLink} from "@angular/router";

function signal(initialValue: string) {

}

@Component({
    selector: 'app-reinitialisation',
    imports: [ButtonDirective, Checkbox, FormsModule, InputText, Password, ReactiveFormsModule, RouterLink],
    templateUrl: './reinitialisation.html',
    styleUrl: './reinitialisation.scss'
})
export class Reinitialisation {
    private readonly fb = inject(FormBuilder);

    readonly loading = signal(false);
    // readonly successMessage = signal('');
    // readonly errorMessage = signal('');

    readonly resetForm = this.fb.nonNullable.group({
        email: ['', [Validators.required, Validators.email]]
    });

    isInvalid(controlName: 'email'): boolean {
        const control = this.resetForm.controls[controlName];

        return control.invalid &&
            (control.touched || control.dirty);
    }

    onSubmit(): void {
        // this.successMessage.set('');
        // this.errorMessage.set('');

        if (this.resetForm.invalid) {
            this.resetForm.markAllAsTouched();
            return;
        }

        // TODO : appeler le service AuthService pour demander
        // l'envoi du lien de réinitialisation au backend.
        // Ne pas afficher de succès avant la réponse du serveur.
    }
}
