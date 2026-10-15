import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';

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
    private readonly route = inject(ActivatedRoute);
    private readonly auth = inject(AuthService);

    currentYear = new Date().getFullYear();
    // Signals: the app runs without zone.js, so plain fields changed in an HTTP
    // callback would not refresh the view.
    readonly loading = signal(false);
    readonly errorMessage = signal('');

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
        this.errorMessage.set('');

        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }

        this.loading.set(true);
        const { email, password } = this.loginForm.getRawValue();
        this.auth.login(email, password).subscribe({
            next: () => {
                // Back to the page that required the login, if any.
                const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
                this.router.navigateByUrl(returnUrl);
            },
            error: (error) => {
                this.loading.set(false);
                this.errorMessage.set(apiErrorMessage(error));
            }
        });
    }
}
