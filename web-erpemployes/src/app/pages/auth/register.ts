import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {finalize, switchMap} from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { AuthService } from '@/app/core/auth/auth.service';
import {AccessRequestPayload, AccessRequestResponse, Country} from "@/app/model";
import {Textarea} from "primeng/textarea";

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule, ButtonModule, InputTextModule, PasswordModule, SelectModule, Textarea],
    templateUrl: '/register.html'
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

    readonly activitySectors = [
        { label: 'Technologies et informatique', value: 'technology' },
        { label: 'Commerce et distribution', value: 'commerce' },
        { label: 'Finance et assurance', value: 'finance' },
        { label: 'Santé et pharmacie', value: 'health' },
        { label: 'Éducation et formation', value: 'education' },
        { label: 'Agriculture et élevage', value: 'agriculture' },
        { label: 'Industrie et fabrication', value: 'industry' },
        { label: 'Bâtiment et travaux publics', value: 'construction' },
        { label: 'Transport et logistique', value: 'transport' },
        { label: 'Conseil et services', value: 'services' },
        { label: 'Hôtellerie et restauration', value: 'hospitality' },
        { label: 'Autre', value: 'other' }
    ];

    readonly form = this.fb.nonNullable.group({
        first_name: ['', [Validators.required, Validators.maxLength(100)]],

        last_name: ['', [Validators.required, Validators.maxLength(100)]],

        email: ['', [Validators.required, Validators.email]],

        phone: ['', [Validators.required, Validators.maxLength(30)]],

        position: ['', Validators.required],

        company_name: ['', [Validators.required, Validators.maxLength(150)]],

        country: ['CM', Validators.required],

        city: ['', [Validators.required, Validators.maxLength(100)]],

        reason: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],

        activity_sector: ['', Validators.required],

        company_phone: ['', [Validators.required, Validators.maxLength(30)]],

        company_address: ['', [Validators.required, Validators.maxLength(255)]],
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
        this.successMessage.set('');

        const payload: AccessRequestPayload = this.form.getRawValue();

        this.authService.submitRequest(payload)
            .pipe(
                finalize(() => this.loading.set(false))
            )
            .subscribe({
                next: (response: AccessRequestResponse) => {
                    this.successMessage.set(
                        response?.message ??
                        'Votre demande a été envoyée avec succès à l’administration.'
                    );

                    this.form.reset({
                        first_name: '',
                        last_name: '',
                        email: '',
                        phone: '',
                        position: '',
                        company_name: '',
                        country: 'CM',
                        city: '',
                        reason: '',
                        activity_sector: '',
                        company_phone: '',
                        company_address: ''
                    });

                    this.selectedLogo = null;
                    this.logoPreview.set(null);
                    this.currentStep.set(1);
                },
                error: (error) => {
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

    // onSubmit(): void {
    //     if (this.loading()) {
    //         return;
    //     }
    //
    //     if (this.form.invalid) {
    //         this.form.markAllAsTouched();
    //         return;
    //     }
    //
    //     this.loading.set(true);
    //     this.errorMessage.set('');
    //
    //     const payload: AccessRequestPayload = this.form.getRawValue();
    //
    //     this.authService.submitRequest(payload).subscribe({
    //         next: () => {
    //             this.loading.set(false);
    //
    //             this.form.reset({
    //                 first_name: '',
    //                 last_name: '',
    //                 email: '',
    //                 phone: '',
    //                 position: '',
    //                 company_name: '',
    //                 country: 'CM',
    //                 city: '',
    //                 reason: ''
    //             });
    //
    //             alert('Votre demande a été envoyée à l’administration avec succès.');
    //         },
    //
    //         error: (error) => {
    //             this.loading.set(false);
    //
    //             const detail = error?.error?.detail;
    //             const message = error?.error?.message;
    //
    //             this.errorMessage.set(typeof detail === 'string' ? detail : typeof message === 'string' ? message : 'Impossible d’envoyer votre demande. Veuillez réessayer.');
    //         }
    //     });
    // }

    // Étape actuellement affichée
    readonly currentStep = signal<1 | 2>(1);

    // Vérifier les informations personnelles avant de continuer
    goToStep2(): void {
        const personalFields = ['first_name', 'last_name', 'email', 'phone', 'position'] as const;

        personalFields.forEach((field) => {
            this.form.controls[field].markAsTouched();
        });

        const personalInfoValid = personalFields.every((field) => this.form.controls[field].valid);

        if (!personalInfoValid) {
            return;
        }

        this.errorMessage.set('');
        this.currentStep.set(2);
    }

    // Revenir à la première étape sans perdre les informations saisies
    goToStep1(): void {
        this.errorMessage.set('');
        this.currentStep.set(1);
    }



    readonly logoPreview = signal<string | null>(null);
    readonly logoError = signal('');

    private selectedLogo: File | null = null;

    onLogoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        this.logoError.set('');

        if (!file) {
            return;
        }

        const allowedTypes = [
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/svg+xml'
        ];

        if (!allowedTypes.includes(file.type)) {
            this.logoError.set('Veuillez sélectionner une image PNG, JPG, WEBP ou SVG.');
            input.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            this.logoError.set('Le logo ne doit pas dépasser 2 Mo.');
            input.value = '';
            return;
        }

        // Évite de prévisualiser du SVG fourni par un utilisateur.
        // Le fichier reste accepté, mais seul le PNG/JPG/WEBP est prévisualisé.
        this.selectedLogo = file;

        if (file.type === 'image/svg+xml') {
            this.logoPreview.set(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            this.logoPreview.set(
                typeof reader.result === 'string' ? reader.result : null
            );
        };

        reader.onerror = () => {
            this.logoPreview.set(null);
            this.logoError.set('Impossible de lire ce fichier image.');
        };

        reader.readAsDataURL(file);
    }

    removeLogo(): void {
        this.selectedLogo = null;
        this.logoPreview.set(null);
        this.logoError.set('');

        const input = document.getElementById('company_logo') as HTMLInputElement | null;

        if (input) {
            input.value = '';
        }
    }


}
