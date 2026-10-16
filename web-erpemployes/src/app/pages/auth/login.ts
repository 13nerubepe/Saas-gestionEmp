import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { APP_NAME } from '@/app/constants';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ButtonModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, ReactiveFormsModule],
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

    readonly appName = APP_NAME;
    currentYear = new Date().getFullYear();
    // Signals: the app runs without zone.js, so plain fields changed in an HTTP
    // callback would not refresh the view.
    readonly loading = signal(false);
    readonly errorMessage = signal('');

    loginForm = this.fb.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required]
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
