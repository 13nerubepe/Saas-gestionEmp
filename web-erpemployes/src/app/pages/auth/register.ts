import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { AuthService } from '@/app/core/auth/auth.service';
import {AccessRequestPayload, Country} from "@/app/model";

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule, ButtonModule, InputTextModule, PasswordModule, SelectModule],
    templateUrl: './app/pages/register/register.html',
})
export class Register {
    readonly successMessage = signal<string>('');

    private readonly fb = inject(FormBuilder);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    readonly loading = signal(false);
    readonly errorMessage = signal('');

    readonly positions: Country[] = [
        { label: 'Fondateur / Fondateur(trice)', value: 'founder' },
        { label: 'Directeur général', value: 'director' },
        { label: 'Responsable des ressources humaines', value: 'hr_manager' },
        { label: 'Responsable administratif', value: 'admin_manager' },
        { label: 'Autre', value: 'other' }
    ];

    readonly countries: Country[] = [
        { label: 'Cameroun', value: 'CM' },
        { label: 'Côte d’Ivoire', value: 'CI' },
        { label: 'Sénégal', value: 'SN' },
        { label: 'Gabon', value: 'GA' },
        { label: 'Tchad', value: 'TD' },
        { label: 'France', value: 'FR' },
        { label: 'Bénin', value: 'BJ' },
        { label: 'Togo', value: 'TG' },
        { label: 'Congo', value: 'CG' },
        { label: 'République démocratique du Congo', value: 'CD' }
    ];

    readonly form = this.fb.nonNullable.group({
        first_name: ['', [
            Validators.required,
            Validators.maxLength(100)
        ]],

        last_name: ['', [
            Validators.required,
            Validators.maxLength(100)
        ]],

        email: ['', [
            Validators.required,
            Validators.email
        ]],

        phone: ['', [
            Validators.required,
            Validators.maxLength(30)
        ]],

        position: ['', Validators.required],

        company_name: ['', [
            Validators.required,
            Validators.maxLength(150)
        ]],

        country: ['CM', Validators.required],

        city: ['', [
            Validators.required,
            Validators.maxLength(100)
        ]],

        reason: ['', [
            Validators.required,
            Validators.minLength(20),
            Validators.maxLength(2000)
        ]]
    });

    isInvalid(controlName: string): boolean {
        const control = this.form.get(controlName);
        return !!control && control.invalid && (control.dirty || control.touched);
    }

    onSubmit(): void {
        if (this.loading()) {
            return;
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        this.errorMessage.set('');

        const payload: AccessRequestPayload = this.form.getRawValue();

        this.authService.submitRequest(payload).subscribe({
            next: () => {
                this.loading.set(false);

                this.form.reset({
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone: '',
                    position: '',
                    company_name: '',
                    country: 'CM',
                    city: '',
                    reason: ''
                });

                alert(
                    'Votre demande a été envoyée à l’administration avec succès.'
                );
            },

            error: (error) => {
                this.loading.set(false);

                const detail = error?.error?.detail;
                const message = error?.error?.message;

                this.errorMessage.set(
                    typeof detail === 'string'
                        ? detail
                        : typeof message === 'string'
                            ? message
                            : 'Impossible d’envoyer votre demande. Veuillez réessayer.'
                );
            }
        });
    }


}
