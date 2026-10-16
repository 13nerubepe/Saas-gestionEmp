import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Button } from 'primeng/button';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { FileUpload } from 'primeng/fileupload';
import { Message } from 'primeng/message';
import { Breadcrumb } from 'primeng/breadcrumb';


// interface

interface Entreprise { nom: string; sigle: string;
    formeJuridique: string | null; secteur: string | null;
    numeroIdentification: string; dateCreation: Date | null;
    email: string;
    telephone: string;
    adresse: string; ville: string; pays: string | null;
    siteWeb: string;
    nomResponsable: string; emailResponsable: string;
    telephoneResponsable: string; }


@Component({
    selector: 'app-created-entreprise',
    imports: [FormsModule, InputText, Select, Button, FileUpload, Message, Breadcrumb, ReactiveFormsModule],
    templateUrl: './created-entreprise.html',
    styleUrl: './created-entreprise.scss'
})
export class CreatedEntreprise {
    private fb = inject(FormBuilder);
    private router = inject(Router);

    saving = signal(false);
    logo = signal<File | null>(null);

    home: MenuItem = { icon: 'pi pi-home', routerLink: '/' };
    breadcrumb: MenuItem[] = [{ label: 'Entreprise', routerLink: '/entreprise' }, { label: 'Créer une entreprise' }];

    sectors = ['Technologie', 'Finance', 'Santé', 'Éducation', 'Commerce', 'Industrie', 'Agriculture', 'Services', 'Autre'];
    countries = ['Cameroun', "Côte d'Ivoire", 'Sénégal', 'Gabon', 'Congo', 'France', 'Canada', 'Autre'];

    form = this.fb.nonNullable.group({
        name: ['', [Validators.required, Validators.minLength(2)]],
        sector: ['', Validators.required],
        address: ['', Validators.required],
        city: ['', Validators.required],
        country: ['', Validators.required],
        phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s]{8,18}$/)]]
    });

    invalid(controlName: keyof typeof this.form.controls): boolean {
        const c = this.form.controls[controlName];
        return c.invalid && (c.dirty || c.touched);
    }

    onLogoSelect(event: { currentFiles: File[] }) {
        this.logo.set(event.currentFiles[0] ?? null);
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.saving.set(true);

        const payload = new FormData();
        Object.entries(this.form.getRawValue()).forEach(([k, v]) => payload.append(k, v));
        if (this.logo()) payload.append('logo', this.logo()!);

        // TODO : appeler ton service, ex. this.companyService.create(payload).subscribe(...)
        // puis : this.router.navigate(['/entreprise']);
    }

    cancel() {
        this.router.navigate(['/entreprise']);
    }

    // isSubmitting = false; entreprise: Entreprise = this.createEmptyEntreprise();
    // formesJuridiques = [ { label: 'SARL', value: 'SARL' }, { label: 'SA', value: 'SA' },
    //     { label: 'SAS', value: 'SAS' }, { label: 'Entreprise individuelle', value: 'ENTREPRISE_INDIVIDUELLE' },
    //     { label: 'Association', value: 'ASSOCIATION' }, { label: 'Autre', value: 'AUTRE' } ];
    // secteurs = [ { label: 'Technologie', value: 'TECHNOLOGIE' }, { label: 'Commerce', value: 'COMMERCE' },
    //     { label: 'Finance', value: 'FINANCE' }, { label: 'Santé', value: 'SANTE' }, { label: 'Éducation', value: 'EDUCATION' },
    //     { label: 'Industrie', value: 'INDUSTRIE' }, { label: 'Agriculture', value: 'AGRICULTURE' }, { label: 'BTP', value: 'BTP' },
    //     { label: 'Autre', value: 'AUTRE' } ];
    // pays = [ { label: 'Cameroun', value: 'CM' }, { label: 'Côte d’Ivoire', value: 'CI' },
    //     { label: 'Sénégal', value: 'SN' }, { label: 'France', value: 'FR' }, { label: 'Autre', value: 'AUTRE' } ];
    // constructor(private location: Location) {}
    // private createEmptyEntreprise(): Entreprise { return { nom: '', sigle: '',
    //     formeJuridique: null, secteur: null, numeroIdentification: '',
    //     dateCreation: null, email: '', telephone: '', adresse: '', ville: '',
    //     pays: 'CM', siteWeb: '', nomResponsable: '', emailResponsable: '', telephoneResponsable: '' }; }
    // createEntreprise(form: NgForm): void { if (form.invalid || this.isSubmitting) { form.control.markAllAsTouched(); return; }
    //     this.isSubmitting = true;
    //     const payload = { ...this.entreprise };
    //     // À remplacer par l'appel à ton service Angular/API.
    //     console.log('Données de l’entreprise :', payload);
    //     // Retirer ce bloc lorsque l'appel réel au backend sera intégré.
    //     this.isSubmitting = false; } resetForm(form: NgForm): void { this.entreprise = this.createEmptyEntreprise();
    //     form.resetForm(this.entreprise); }
    // // goBack(): void { this.location.back(); }
}
