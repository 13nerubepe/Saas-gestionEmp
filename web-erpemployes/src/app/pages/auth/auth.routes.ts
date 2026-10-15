import { Routes } from '@angular/router';
import { guestGuard } from '@/app/core/auth/auth.guard';
import { Access } from './access';
import { Login } from './login';
import { Error } from './error';
import { Register } from './register';

export default [
    { path: 'access', component: Access },
    { path: 'error', component: Error },
    { path: 'login', component: Login, canActivate: [guestGuard] },
    { path: 'register', component: Register, canActivate: [guestGuard] }
] as Routes;
