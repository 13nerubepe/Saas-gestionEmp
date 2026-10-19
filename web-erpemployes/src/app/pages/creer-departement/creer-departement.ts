import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { DepartementService } from '@/app/core/departement/departement.service';
import { Departement } from '@/app/core/departement/departement.model';

@Component({
    selector: 'app-creer-departement',
    standalone: true,
        imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, SelectModule, TextareaModule],
    templateUrl: './creer-departement.html',
    styleUrl: './creer-departement.scss'
})
export class CreerDepartement {
    private readonly service = inject(DepartementService);
    private readonly router = inject(Router);

    // Le formulaire
    readonly departement = signal<Partial<Departement>>({
        nom: '',
        entreprise: 'Sakai Group',
        effectif: 0 // On garde l'effectif à 0 par défaut
    });

    readonly loading = signal(false);

    // Options pour le menu déroulant "Entreprise"
    readonly entreprises = [
        { label: 'Sakai Group', value: 'Sakai Group' },
        { label: 'Autre', value: 'Autre' }
    ];

    updateForm(field: keyof Departement, value: any): void {
        this.departement.update(current => ({ ...current, [field]: value }));
    }

    annuler(): void {
        this.router.navigate(['/liste-tableau']);
    }

    creer(): void {
        const data = this.departement();
        if (!data.nom || data.nom.trim() === '') {
            alert('Le nom est obligatoire');
            return;
        }

        this.loading.set(true);
        // On caste les données pour correspondre à ce qu'attend le service
        this.service.create(data as Omit<Departement, 'id'>).subscribe({
            next: () => {
                this.loading.set(false);
                // Une fois créé, on retourne à la liste
                this.router.navigate(['/liste-tableau']);
            },
            error: () => {
                this.loading.set(false);
                alert('Erreur lors de la création');
            }
        });
    }
}