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
    actionsVisible = false;
    selectedUser: any = null;
    selectedRole = '';
    roles = ['Admin', 'Manager', 'Utilisateur']; // adapte à tes rôles

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

    newRole() {
        // TODO : ouvrir le dialog de création de rôle
    }

    openActions(user: User_Role) {
        this.selectedUser = { ...user };
        this.selectedRole = user.role;
        this.actionsVisible = true;
    }

    saveRole() {
        // this.users.update((list) => list.map((u) => (u.id === this.selectedUser.id ? { ...u, role: this.selectedRole } : u)));
        this.actionsVisible = false;
    }

    toggleStatus() {
        const newStatus = this.selectedUser.status === 'Actif' ? 'Inactif' : 'Actif';
        this.users.update((list) => list.map((u) => (u.id === this.selectedUser.id ? { ...u, status: newStatus } : u)));
        this.actionsVisible = false;
    }

    deleteUser() {
        this.users.update((list) => list.filter((u) => u.id !== this.selectedUser.id));
        this.actionsVisible = false;
    }
}
