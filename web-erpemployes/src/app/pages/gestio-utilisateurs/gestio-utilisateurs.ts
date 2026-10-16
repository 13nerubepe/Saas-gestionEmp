import { Component, signal, ViewChild } from '@angular/core';
import {Avatar} from "primeng/avatar";
import {Button} from "primeng/button";
import {Dialog} from "primeng/dialog";
import {Divider} from "primeng/divider";
import {IconField} from "primeng/iconfield";
import {InputIcon} from "primeng/inputicon";
import {InputText} from "primeng/inputtext";
import {Select} from "primeng/select";
import { Table, TableModule } from 'primeng/table';
import {Tag} from "primeng/tag";
import {Tooltip} from "primeng/tooltip";
import { NgClass } from '@angular/common';
import { User_Role } from '@/app/model';
import { SelectButton } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-gestio-utilisateurs',
    imports: [Avatar, Button, Dialog, Divider, IconField, InputIcon, InputText, Select, TableModule, Tag, Tooltip, NgClass, SelectButton, FormsModule],
    templateUrl: './gestio-utilisateurs.html',
    styleUrl: './gestio-utilisateurs.scss'
})
export class GestioUtilisateurs {
    @ViewChild('dt') dt!: Table;

    isLoad: boolean = false;


    selectedFilter: string | null = null;



    roles = ['Admin', 'Manager', 'Utilisateur']; // tes rôles

    users = signal<User_Role[]>([
        { id: 1, name: 'Marie Dupont', email: 'marie.dupont@entreprise.cm', avatar: 'assets/avatars/1.jpg', role: 'Administrateur', status: 'Actif' },
        { id: 2, name: 'Jean Kamga', email: 'jean.kamga@entreprise.cm', avatar: 'assets/avatars/2.jpg', role: 'RH', status: 'Actif' },
        { id: 3, name: 'Sophie Martin', email: 'sophie.martin@entreprise.cm', avatar: 'assets/avatars/3.jpg', role: 'Manager', status: 'Actif' },
        { id: 4, name: 'Lucas Bernard', email: 'lucas.bernard@entreprise.cm', avatar: 'assets/avatars/4.jpg', role: 'Employé', status: 'Actif' },
        { id: 5, name: 'Admin Système', email: 'admin@entreprise.cm', avatar: 'assets/avatars/5.jpg', role: 'Administrateur', status: 'Actif' }
    ]);

    roleSeverity(role: User_Role['role']): 'danger' | 'info' | 'warn' | 'secondary' {
        const map = { Administrateur: 'danger', RH: 'info', Manager: 'warn', Employé: 'secondary' } as const;
        return map[role];
    }
    filterByRole(role: string | null) {
        this.dt.filter(role, 'role', 'equals');
    }
    roleFilterOptions = [
        { label: 'Tous', value: null },
        ...this.roles.map((r) => ({ label: r, value: r })),
    ];
}
