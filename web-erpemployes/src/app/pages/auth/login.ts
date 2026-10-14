import { Component, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, AppFloatingConfigurator, ReactiveFormsModule],
    templateUrl: './login.html'
})
export class Login {
    // email: string = '';
    //
    // password: string = '';
    //
    // checked: boolean = false;

    private readonly fb = inject(FormBuilder);
    private readonly router = inject(Router);

    currentYear = new Date().getFullYear();
    loading = false;
    errorMessage = '';

    loginForm = this.fb.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        remember: [false]
    });

    isInvalid(controlName: 'email' | 'password'): boolean {
        const control = this.loginForm.controls[controlName];

        return control.invalid && (control.touched || control.dirty);
    }

    onSubmit(): void {
        this.errorMessage = '';

        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }

        // À remplacer par l'appel à ton service d'authentification.
        this.errorMessage = 'Le service de connexion doit être configuré avec le backend.';
    }
}
