import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';

/** Current user: name and language (GET/PATCH /auth/me/), companies and roles. */
@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule, TagModule],
    template: `
        <div class="grid grid-cols-12 gap-6">
            <div class="col-span-12 lg:col-span-7">
                <div class="card !mb-0">
                    <h2 class="mb-1 mt-0 !text-xl font-semibold">Mon profil</h2>
                    <p class="mb-6 mt-0 text-sm text-surface-500">{{ auth.user()?.email }}</p>

                    <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-5">
                        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div class="flex flex-col gap-2">
                                <label for="first_name" class="text-sm font-semibold">Prénom</label>
                                <input pInputText id="first_name" formControlName="first_name" maxlength="150" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="last_name" class="text-sm font-semibold">Nom</label>
                                <input pInputText id="last_name" formControlName="last_name" maxlength="150" />
                            </div>
                        </div>

                        <div class="flex flex-col gap-2">
                            <label for="language" class="text-sm font-semibold">Langue</label>
                            <p-select inputId="language" formControlName="language" [options]="languages" optionLabel="label" optionValue="value" class="w-full sm:w-64" />
                            <small class="text-surface-500">Langue des réponses de l'assistant juridique.</small>
                        </div>

                        @if (errorMessage()) {
                            <p class="m-0 text-sm text-red-600" role="alert">{{ errorMessage() }}</p>
                        }
                        @if (saved()) {
                            <p class="m-0 text-sm text-green-600" role="status">Profil enregistré.</p>
                        }

                        <div>
                            <p-button type="submit" label="Enregistrer" icon="pi pi-check" [loading]="saving()" [disabled]="form.pristine" />
                        </div>
                    </form>
                </div>
            </div>

            <div class="col-span-12 lg:col-span-5">
                <div class="card !mb-0">
                    <h2 class="mb-4 mt-0 !text-xl font-semibold">Mes entreprises</h2>
                    @for (m of auth.user()?.memberships ?? []; track m.company_id) {
                        <div class="flex items-center justify-between border-b border-surface-200 py-3 last:border-0 dark:border-surface-700">
                            <div>
                                <div class="font-medium">{{ m.company_name }}</div>
                                <div class="text-xs text-surface-500">{{ m.country }}</div>
                            </div>
                            <p-tag [value]="m.role === 'founder' ? 'Fondateur' : 'Employé'" [severity]="m.role === 'founder' ? 'warn' : 'secondary'" />
                        </div>
                    } @empty {
                        <p class="m-0 text-sm text-surface-500">Aucune entreprise.</p>
                    }
                </div>
            </div>
        </div>
    `
})
export class Profile implements OnInit {
    private readonly fb = inject(FormBuilder);
    protected readonly auth = inject(AuthService);

    readonly saving = signal(false);
    readonly saved = signal(false);
    readonly errorMessage = signal('');

    languages = [
        { label: 'Français', value: 'fr' as const },
        { label: 'English', value: 'en' as const }
    ];

    form = this.fb.nonNullable.group({
        first_name: [''],
        last_name: [''],
        language: ['fr' as 'fr' | 'en']
    });

    ngOnInit(): void {
        const user = this.auth.user();
        if (user) {
            this.form.reset({ first_name: user.first_name, last_name: user.last_name, language: user.language });
        }
    }

    save(): void {
        this.saving.set(true);
        this.saved.set(false);
        this.errorMessage.set('');
        this.auth.updateProfile(this.form.getRawValue()).subscribe({
            next: (user) => {
                this.form.reset({ first_name: user.first_name, last_name: user.last_name, language: user.language });
                this.saving.set(false);
                this.saved.set(true);
            },
            error: (error) => {
                this.errorMessage.set(apiErrorMessage(error));
                this.saving.set(false);
            }
        });
    }
}
