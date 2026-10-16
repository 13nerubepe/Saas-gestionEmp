import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StyleClassModule } from 'primeng/styleclass';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AuthService } from '@/app/core/auth/auth.service';
import { APP_NAME } from '@/app/constants';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()" title="Menu">
                <i class="pi pi-bars"></i>
            </button>
            <a class="layout-topbar-logo" routerLink="/">
                <i class="pi pi-briefcase text-3xl text-primary"></i>
                <span>{{ appName }}</span>
            </a>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()" [title]="layoutService.isDarkTheme() ? 'Mode clair' : 'Mode sombre'">
                    <i [ngClass]="{ 'pi ': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>
            </div>

            <button class="layout-topbar-menu-button layout-topbar-action" pStyleClass="@next" enterFromClass="hidden" enterActiveClass="animate-scalein" leaveToClass="hidden" leaveActiveClass="animate-fadeout" [hideOnOutsideClick]="true">
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button type="button" class="layout-topbar-action" routerLink="/profil" [title]="auth.user()?.email ?? ''">
                        <i class="pi pi-user"></i>
                        <span>Mon profil</span>
                    </button>
                    <button type="button" class="layout-topbar-action" title="Se déconnecter" (click)="auth.logout()">
                        <i class="pi pi-sign-out"></i>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </div>
        </div>
    </div>`
})
export class AppTopbar {
    readonly appName = APP_NAME;

    layoutService = inject(LayoutService);
    auth = inject(AuthService);

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({
            ...state,
            darkTheme: !state.darkTheme
        }));
    }
}
