import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Button } from 'primeng/button';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';

@Component({
    selector: 'app-created-user',
    imports: [Button, Password, FormsModule, Select, InputText],
    templateUrl: './created-user.html',
    styleUrl: './created-user.scss'
})
export class CreatedUser {
    user = { nom: '', prenom: '', email: '', role: '', password: '' };
    roles = [
        { label: 'Administrateur', value: 'ADMIN' },
        { label: 'Responsable RH', value: 'RH' },
        { label: 'Employé', value: 'EMPLOYEE' }
    ];
    successMessage = '';
    createUser(form: NgForm): void {
        if (form.invalid) {
            return;
        }
        // Démonstration uniquement : aucun utilisateur n'est enregistré.
        console.log('Utilisateur à créer :', { ...this.user, password: '[masqué]' });
        this.successMessage = 'Formulaire validé. Connectez le service API pour enregistrer l’utilisateur.';
    }
    resetForm(form: NgForm): void {
        form.resetForm({ nom: '', prenom: '', email: '', role: '', password: '' });
        this.successMessage = '';
    }
}
