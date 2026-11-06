import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { AuthService } from '@/app/core/auth/auth.service';
import { CompanyService } from '@/app/core/company/company.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { PageHeader } from '@/app/commons/page-header';

/** Current user: name and language (GET/PATCH /auth/me/), companies and roles. */
@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule, TagModule, PageHeader],
    template: `
        <app-page-header title="Mon profil" [subtitle]="auth.user()?.email ?? ''" />

        <div class="grid grid-cols-12 gap-6">
            <div class="col-span-12 lg:col-span-7">
                <div class="card !mb-0">
                    <h2 class="mb-5 mt-0 !text-lg font-semibold">Informations personnelles</h2>

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
                            <small class="text-muted-color">Langue des réponses de l'assistant juridique.</small>
                        </div>

                        @if (errorMessage()) {
                            <p class="m-0 text-sm text-red-600" role="alert">{{ errorMessage() }}</p>
                        }
                        @if (saved()) {
                            <p class="m-0 text-sm text-green-700 dark:text-green-400" role="status"><i class="pi pi-check-circle mr-1"></i>Profil enregistré.</p>
                        }

                        <div>
                            <p-button type="submit" label="Enregistrer" icon="pi pi-check" [loading]="saving()" [disabled]="form.pristine" />
                        </div>
                    </form>
                </div>
            </div>

            <div class="col-span-12 flex flex-col gap-6 lg:col-span-5">
                @if (auth.isFounder()) {
                    <div class="card !mb-0" id="entreprise">
                        <h2 class="mb-1 mt-0 !text-lg font-semibold">Mon entreprise</h2>
                        <p class="mb-5 mt-0 text-sm text-muted-color">Ces informations figurent sur vos factures. Le NIU est obligatoire pour en émettre.</p>
                        <form [formGroup]="companyForm" (ngSubmit)="saveCompany()" class="flex flex-col gap-4">
                            <div class="flex flex-col gap-2">
                                <label for="company_name" class="text-sm font-semibold">Raison sociale</label>
                                <input pInputText id="company_name" formControlName="name" maxlength="255" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="legal_form" class="text-sm font-semibold">Forme juridique</label>
                                <input pInputText id="legal_form" formControlName="legal_form" maxlength="100" placeholder="SARL, SA, Entreprise individuelle…" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="company_tax_id" class="text-sm font-semibold">NIU (numéro d'identifiant unique)</label>
                                <input pInputText id="company_tax_id" formControlName="tax_id" maxlength="100" placeholder="M0XXXXXXXXXXXX" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="company_trade_register" class="text-sm font-semibold">RCCM</label>
                                <input pInputText id="company_trade_register" formControlName="trade_register" maxlength="100" placeholder="RC/DLA/2024/B/1234" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="company_address" class="text-sm font-semibold">Adresse</label>
                                <input pInputText id="company_address" formControlName="address" maxlength="500" placeholder="Rue, quartier, ville" />
                            </div>
                            @if (companyError()) {
                                <p class="m-0 text-sm text-red-600" role="alert">{{ companyError() }}</p>
                            }
                            @if (companySaved()) {
                                <p class="m-0 text-sm text-green-700 dark:text-green-400" role="status"><i class="pi pi-check-circle mr-1"></i>Entreprise enregistrée.</p>
                            }
                            <div>
                                <p-button type="submit" label="Enregistrer" icon="pi pi-check" [loading]="companySaving()" [disabled]="companyForm.pristine" />
                            </div>
                        </form>
                    </div>
                }

                <div class="card !mb-0">
                    <h2 class="mb-4 mt-0 !text-lg font-semibold">Mes entreprises</h2>
                    @for (m of auth.user()?.memberships ?? []; track m.company_id) {
                        <div class="flex items-center justify-between border-b border-surface-200 py-3 last:border-0 dark:border-surface-700">
                            <div>
                                <div class="font-medium">{{ m.company_name }}</div>
                                <div class="text-xs text-muted-color">{{ m.country }}</div>
                            </div>
                            <p-tag [value]="m.role === 'founder' ? 'Fondateur' : 'Employé'" [severity]="m.role === 'founder' ? 'warn' : 'secondary'" />
                        </div>
                    } @empty {
                        <p class="m-0 text-sm text-muted-color">Aucune entreprise.</p>
                    }
                </div>
            </div>
        </div>
    `
})
export class Profile implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly company = inject(CompanyService);
    protected readonly auth = inject(AuthService);

    readonly saving = signal(false);
    readonly saved = signal(false);
    readonly errorMessage = signal('');
    readonly companySaving = signal(false);
    readonly companySaved = signal(false);
    readonly companyError = signal('');

    languages = [
        { label: 'Français', value: 'fr' as const },
        { label: 'English', value: 'en' as const }
    ];

    form = this.fb.nonNullable.group({
        first_name: [''],
        last_name: [''],
        language: ['fr' as 'fr' | 'en']
    });

    companyForm = this.fb.nonNullable.group({ name: [''], legal_form: [''], tax_id: [''], trade_register: [''], address: [''] });

    ngOnInit(): void {
        const user = this.auth.user();
        if (user) {
            this.form.reset({ first_name: user.first_name, last_name: user.last_name, language: user.language });
        }
        if (this.auth.isFounder()) {
            this.company.get().subscribe({
                next: (c) => this.companyForm.reset({ name: c.name, legal_form: c.legal_form, tax_id: c.tax_id, trade_register: c.trade_register, address: c.address }),
                error: (error) => this.companyError.set(apiErrorMessage(error))
            });
        }
    }

    saveCompany(): void {
        this.companySaving.set(true);
        this.companySaved.set(false);
        this.companyError.set('');
        const value = this.companyForm.getRawValue();
        this.company.update({ name: value.name.trim(), legal_form: value.legal_form.trim(), tax_id: value.tax_id.trim(), trade_register: value.trade_register.trim(), address: value.address.trim() }).subscribe({
            next: (c) => {
                this.companyForm.reset({ name: c.name, legal_form: c.legal_form, tax_id: c.tax_id, trade_register: c.trade_register, address: c.address });
                this.companySaving.set(false);
                this.companySaved.set(true);
            },
            error: (error) => {
                this.companyError.set(apiErrorMessage(error));
                this.companySaving.set(false);
            }
        });
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
