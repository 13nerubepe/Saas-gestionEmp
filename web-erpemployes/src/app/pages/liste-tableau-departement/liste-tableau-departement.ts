import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DepartementService } from '@/app/core/departement/departement.service';
import { Departement } from '@/app/core/departement/departement.model';

@Component({
    selector: 'app-liste-tableau-departement',
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, ConfirmDialogModule, ToastModule],
    providers: [ConfirmationService, MessageService],
    templateUrl: './liste-tableau-departement.html',
    styleUrl: './liste-tableau-departement.scss'
})
export class ListeTableauDepartement {
    private readonly service = inject(DepartementService);
    private readonly confirmation = inject(ConfirmationService);
    private readonly messages = inject(MessageService);

    readonly departements = signal<Departement[]>([]);
    readonly loading = signal(false);
    readonly dialogVisible = signal(false);
    readonly modeEdition = signal(false);

    // Formulaire
    readonly form = signal<Partial<Departement>>({
        nom: '',
        entreprise: 'Sakai Group',
        effectif: 0
    });

    ngOnInit(): void {
        this.loadAll();
    }

    loadAll(): void {
        this.loading.set(true);
        this.service.getAll().subscribe({
            next: (data) => {
                this.departements.set(data);
                this.loading.set(false);
            },
            error: () => {
                this.messages.add({ severity: 'error', summary: 'Erreur', detail: 'Chargement impossible' });
                this.loading.set(false);
            }
        });
    }

    ouvrirNouveau(): void {
        this.form.set({ nom: '', entreprise: 'Sakai Group', effectif: 0 });
        this.modeEdition.set(false);
        this.dialogVisible.set(true);
    }

    ouvrirEdition(dept: Departement): void {
        this.form.set({ ...dept });
        this.modeEdition.set(true);
        this.dialogVisible.set(true);
    }

    enregistrer(): void {
        const data = this.form();
        if (!data.nom || data.nom.trim() === '') {
            this.messages.add({ severity: 'warn', summary: 'Attention', detail: 'Le nom est obligatoire' });
            return;
        }

        if (this.modeEdition() && data.id) {
            this.service.update(data.id, data).subscribe(() => {
                this.messages.add({ severity: 'success', summary: 'Succès', detail: 'Département modifié' });
                this.loadAll();
                this.dialogVisible.set(false);
            });
        } else {
            this.service.create(data as Omit<Departement, 'id'>).subscribe(() => {
                this.messages.add({ severity: 'success', summary: 'Succès', detail: 'Département créé' });
                this.loadAll();
                this.dialogVisible.set(false);
            });
        }
    }

    confirmerSuppression(dept: Departement): void {
        this.confirmation.confirm({
            message: `Voulez-vous vraiment supprimer "${dept.nom}" ?`,
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Oui, supprimer',
            rejectLabel: 'Annuler',
            accept: () => {
                this.service.delete(dept.id).subscribe(() => {
                    this.messages.add({ severity: 'success', summary: 'Supprimé', detail: `${dept.nom} a été supprimé` });
                    this.loadAll();
                });
            }
        });
    }
    updateForm(field: keyof Departement, value: any): void {
        this.form.update(current => ({ ...current, [field]: value }));
    }
}
