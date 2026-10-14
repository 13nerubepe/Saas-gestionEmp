import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Button } from 'primeng/button';


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
    imports: [FormsModule, InputText, Select, Button],
    templateUrl: './created-entreprise.html',
    styleUrl: './created-entreprise.scss'
})
export class CreatedEntreprise {
    isSubmitting = false; entreprise: Entreprise = this.createEmptyEntreprise();
    formesJuridiques = [ { label: 'SARL', value: 'SARL' }, { label: 'SA', value: 'SA' },
        { label: 'SAS', value: 'SAS' }, { label: 'Entreprise individuelle', value: 'ENTREPRISE_INDIVIDUELLE' },
        { label: 'Association', value: 'ASSOCIATION' }, { label: 'Autre', value: 'AUTRE' } ];
    secteurs = [ { label: 'Technologie', value: 'TECHNOLOGIE' }, { label: 'Commerce', value: 'COMMERCE' },
        { label: 'Finance', value: 'FINANCE' }, { label: 'Santé', value: 'SANTE' }, { label: 'Éducation', value: 'EDUCATION' },
        { label: 'Industrie', value: 'INDUSTRIE' }, { label: 'Agriculture', value: 'AGRICULTURE' }, { label: 'BTP', value: 'BTP' },
        { label: 'Autre', value: 'AUTRE' } ];
    pays = [ { label: 'Cameroun', value: 'CM' }, { label: 'Côte d’Ivoire', value: 'CI' },
        { label: 'Sénégal', value: 'SN' }, { label: 'France', value: 'FR' }, { label: 'Autre', value: 'AUTRE' } ];
    constructor(private location: Location) {}
    private createEmptyEntreprise(): Entreprise { return { nom: '', sigle: '',
        formeJuridique: null, secteur: null, numeroIdentification: '',
        dateCreation: null, email: '', telephone: '', adresse: '', ville: '',
        pays: 'CM', siteWeb: '', nomResponsable: '', emailResponsable: '', telephoneResponsable: '' }; }
    createEntreprise(form: NgForm): void { if (form.invalid || this.isSubmitting) { form.control.markAllAsTouched(); return; }
        this.isSubmitting = true;
        const payload = { ...this.entreprise };
        // À remplacer par l'appel à ton service Angular/API.
        console.log('Données de l’entreprise :', payload);
        // Retirer ce bloc lorsque l'appel réel au backend sera intégré.
        this.isSubmitting = false; } resetForm(form: NgForm): void { this.entreprise = this.createEmptyEntreprise();
        form.resetForm(this.entreprise); }
    // goBack(): void { this.location.back(); }
}
