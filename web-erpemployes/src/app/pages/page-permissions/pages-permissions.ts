import { TableModule } from 'primeng/table';
import { Component, signal } from '@angular/core';
import { IconField } from 'primeng/iconfield';
import { Avatar } from 'primeng/avatar';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { InputIcon } from 'primeng/inputicon';
import { User_Role } from '../../model';
import { NgClass } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { InputText } from 'primeng/inputtext';
import { Divider } from 'primeng/divider';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-page-permissions',
    imports: [TableModule, Button, IconField, InputIcon, Avatar, Tag, NgClass, Tooltip, InputText, Divider, Dialog, Select, FormsModule],
    templateUrl: './page-permissions.html',
    styleUrl: './pages-permissions.scss'
})
export class PagesPermissions {

    // Visibilité de la boîte de dialogue
    actionsVisible = false;

    // Utilisateur sélectionné
    selectedUser: User_Role | null = null;

    // Rôle sélectionné dans le formulaire
    selectedRole: User_Role['role'] | null = null;

    // Rôles disponibles dans l'interface
    readonly roles: User_Role['role'][] = [
        'Administrateur',
        'RH',
        'Manager',
        'Employé'
    ];


    // Données de démonstration en attendant l'API de gestion des utilisateurs
    readonly users = signal<User_Role[]>([
        {
            id: 1,
            name: 'Marie Dupont',
            email: 'marie.dupont@entreprise.cm',
            avatar: 'assets/avatars/1.jpg',
            role: 'Administrateur',
            status: 'Actif'
        },
        {
            id: 2,
            name: 'Jean Kamga',
            email: 'jean.kamga@entreprise.cm',
            avatar: 'assets/avatars/2.jpg',
            role: 'RH',
            status: 'Actif'
        },
        {
            id: 3,
            name: 'Sophie Martin',
            email: 'sophie.martin@entreprise.cm',
            avatar: 'assets/avatars/3.jpg',
            role: 'Manager',
            status: 'Actif'
        },
        {
            id: 4,
            name: 'Lucas Bernard',
            email: 'lucas.bernard@entreprise.cm',
            avatar: 'assets/avatars/4.jpg',
            role: 'Employé',
            status: 'Actif'
        },
        {
            id: 5,
            name: 'Admin Système',
            email: 'admin@entreprise.cm',
            avatar: 'assets/avatars/5.jpg',
            role: 'Administrateur',
            status: 'Actif'
        }
    ]);

    /**
     * Couleur du badge correspondant au rôle.
     */
    roleSeverity(
        role: User_Role['role']
    ): 'danger' | 'info' | 'warn' | 'secondary' {
        const map = {
            Administrateur: 'danger',
            RH: 'info',
            Manager: 'warn',
            Employé: 'secondary'
        } as const;

        return map[role];
    }

    /**
     * Ouvre la boîte de dialogue de création de rôle.
     * La création réelle nécessite un endpoint backend.
     */
    newRole(): void {
        this.newRoleName = '';
        this.newRoleDescription = '';
        this.createRoleVisible = true;

        console.info(
            'La création de rôle nécessite un endpoint backend.'
        );
    }

    /**
     * Ouvre les actions pour un utilisateur.
     */
    openActions(user: User_Role): void {
        this.selectedUser = { ...user };
        this.selectedRole = user.role;
        this.actionsVisible = true;
    }

    /**
     * Enregistre le rôle sélectionné localement.
     */
    saveRole(): void {
        if (!this.selectedUser || !this.selectedRole) {
            return;
        }

        const userId = this.selectedUser.id;
        const role = this.selectedRole;

        this.users.update(users =>
            users.map(user =>
                user.id === userId
                    ? { ...user, role }
                    : user
            )
        );
        this.selectedUser = {
            ...this.selectedUser,
            role
        };

        this.editVisible = false;
        this.selectedRole = null;

        // this.closeDialog();
    }

    /**
     * Active ou désactive le compte localement.
     */
    toggleStatus(): void {
        if (!this.selectedUser) {
            return;
        }

        const userId = this.selectedUser.id;

        const newStatus =
            this.selectedUser.status === 'Actif'
                ? 'Inactif'
                : 'Actif';

        this.users.update(list =>
            list.map(user =>
                user.id === userId
                    ? { ...user, status: newStatus }
                    : user
            )
        );

        this.selectedUser = {
            ...this.selectedUser,
            status: newStatus
        };

        this.statusVisible = false;

        // this.closeDialog();
    }

    /**
     * Supprime l'utilisateur de la liste locale.
     */
    deleteUser(): void {
        if (!this.selectedUser) {
            return;
        }

        const userId = this.selectedUser.id;

        this.users.update(users =>
            users.filter(user => user.id !== userId)
        );

        this.deleteVisible = false;
        this.selectedUser = null;
        this.selectedRole = null;

        // this.closeDialog();
    }

    /**
     * Ferme la boîte de dialogue et réinitialise la sélection.
     */
    private closeDialog(): void {
        this.actionsVisible = false;
        this.selectedUser = null;
        this.selectedRole = null;
    }


    // Contrôle de la boîte de dialogue de création
    createRoleVisible = false;

// Champs du nouveau rôle
    newRoleName = '';
    newRoleDescription = '';


// Enregistre le nouveau rôle localement
    createRole(): void {
        const name = this.newRoleName.trim();

        if (!name) {
            return;
        }

        const exists = this.roles.some(
            role => role.toLowerCase() === name.toLowerCase()
        );

        if (exists) {
            return;
        }

        // Le type actuel n'autorise que les quatre rôles définis.
        const allowedRoles: User_Role['role'][] = [
            'Administrateur',
            'RH',
            'Manager',
            'Employé'
        ];

        const matchingRole = allowedRoles.find(
            role => role.toLowerCase() === name.toLowerCase()
        );

        if (!matchingRole) {
            return;
        }

        this.createRoleVisible = false;
        this.newRoleName = '';
        this.newRoleDescription = '';
    }



    // Visibilité des dialogues
    editVisible = false;
    statusVisible = false;
    deleteVisible = false;


// Ouvre le dialogue de modification
    openEditDialog(): void {
        if (!this.selectedUser) return;

        this.selectedRole = this.selectedUser.role;
        this.actionsVisible = false;
        this.editVisible = true;
    }


// Ouvre le dialogue d'activation/désactivation
    openStatusDialog(): void {
        if (!this.selectedUser) return;

        this.actionsVisible = false;
        this.statusVisible = true;
    }


// Ouvre le dialogue de suppression
    openDeleteDialog(): void {
        if (!this.selectedUser) return;

        this.actionsVisible = false;
        this.deleteVisible = true;
    }



}
