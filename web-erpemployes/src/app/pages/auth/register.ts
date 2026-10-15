import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule, ButtonModule, InputTextModule, PasswordModule, SelectModule],
    template: `
        <div class="flex min-h-screen items-center justify-center bg-surface-100 p-4 dark:bg-surface-950 md:p-8">
            <div class="w-full max-w-lg rounded-3xl border border-surface-200 bg-white p-6 shadow-xl dark:border-surface-700 dark:bg-surface-900 sm:p-10">
                <h2 class="m-0 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-0">Créer votre espace</h2>
                <p class="mb-8 mt-3 text-sm text-surface-500 dark:text-surface-400">Un compte fondateur et votre entreprise, en une étape.</p>

                @if (errorMessage()) {
                    <div class="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                        <i class="pi pi-exclamation-circle mt-0.5"></i>
                        <span>{{ errorMessage() }}</span>
                    </div>
                }

                <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
                    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div class="flex flex-col gap-2">
                            <label for="first_name" class="text-sm font-semibold">Prénom</label>
                            <input pInputText id="first_name" formControlName="first_name" autocomplete="given-name" />
                        </div>
                        <div class="flex flex-col gap-2">
                            <label for="last_name" class="text-sm font-semibold">Nom</label>
                            <input pInputText id="last_name" formControlName="last_name" autocomplete="family-name" />
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="email" class="text-sm font-semibold">Adresse e-mail</label>
                        <input pInputText id="email" type="email" formControlName="email" autocomplete="username" placeholder="nom@entreprise.com" [invalid]="isInvalid('email')" />
                        @if (isInvalid('email')) {
                            <small class="text-red-500">Saisissez une adresse e-mail valide.</small>
                        }
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="password" class="text-sm font-semibold">Mot de passe</label>
                        <p-password formControlName="password" inputId="password" autocomplete="new-password" [toggleMask]="true" [feedback]="false" [fluid]="true" [invalid]="isInvalid('password')" />
                        <small class="text-surface-500">8 caractères minimum, pas uniquement des chiffres.</small>
                    </div>

                    <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
                        <div class="flex flex-col gap-2 sm:col-span-2">
                            <label for="company_name" class="text-sm font-semibold">Entreprise</label>
                            <input pInputText id="company_name" formControlName="company_name" autocomplete="organization" [invalid]="isInvalid('company_name')" />
                        </div>
                        <div class="flex flex-col gap-2">
                            <label for="country" class="text-sm font-semibold">Pays</label>
                            <p-select inputId="country" formControlName="country" [options]="countries" optionLabel="label" optionValue="value" [fluid]="true" />
                        </div>
                    </div>

                    <button pButton type="submit" class="!mt-2 !w-full !justify-center !rounded-xl !py-3 !font-semibold" [disabled]="loading()">
                        @if (loading()) {
                            <i class="pi pi-spin pi-spinner"></i>
                            <span>Création en cours...</span>
                        } @else {
                            <span>Créer mon compte</span>
                        }
                    </button>
                </form>

                <p class="mb-0 mt-6 text-center text-sm text-surface-500">
                    Déjà inscrit ?
                    <a routerLink="/auth/login" class="font-medium text-primary">Se connecter</a>
                </p>
            </div>
        </div>
    `
})
export class Register {
    private readonly fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    readonly loading = signal(false);
    readonly errorMessage = signal('');

    countries = [
        { label: 'Cameroun', value: 'CM' },
        { label: "Côte d'Ivoire", value: 'CI' },
        { label: 'Sénégal', value: 'SN' },
        { label: 'Gabon', value: 'GA' },
        { label: 'France', value: 'FR' }
    ];

    form = this.fb.nonNullable.group({
        first_name: [''],
        last_name: [''],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        company_name: ['', Validators.required],
        country: ['CM', Validators.required]
    });

    isInvalid(name: 'email' | 'password' | 'company_name'): boolean {
        const control = this.form.controls[name];
        return control.invalid && (control.touched || control.dirty);
    }

    onSubmit(): void {
        this.errorMessage.set('');
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.loading.set(true);
        const payload = this.form.getRawValue();
        this.auth
            .register(payload)
            .pipe(switchMap(() => this.auth.login(payload.email, payload.password)))
            .subscribe({
                next: () => this.router.navigateByUrl('/'),
                error: (error) => {
                    this.loading.set(false);
                    this.errorMessage.set(apiErrorMessage(error));
                }
            });
    }
}
