import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AppConstantRoute } from '@/app/constants';
import { AuthService } from '@/app/core/auth/auth.service';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model(); track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `
})
export class AppMenu {
    private readonly auth = inject(AuthService);

    // Only the delivered features. Invoices are for founders: the API refuses employees.
    readonly model = computed<MenuItem[]>(() => [
        {
            label: 'Menu',
            items: [
                { label: 'Tableau de bord', icon: 'pi pi-fw pi-home', routerLink: ['/'] },
                { label: 'Assistant juridique', icon: 'pi pi-fw pi-briefcase', routerLink: ['/' + AppConstantRoute.Legal_Assistant_PATH] },
                { label: 'Clients', icon: 'pi pi-fw pi-users', routerLink: ['/' + AppConstantRoute.Clients_PATH] },
                ...(this.auth.isFounder()
                    ? [
                          { label: 'Factures', icon: 'pi pi-fw pi-file', routerLink: ['/' + AppConstantRoute.Invoices_PATH] },
                          { label: 'Conseiller financier', icon: 'pi pi-fw pi-sparkles', routerLink: ['/' + AppConstantRoute.Advisor_PATH] }
                      ]
                    : []),
                { label: 'Mon profil', icon: 'pi pi-fw pi-user', routerLink: ['/' + AppConstantRoute.Profile_PATH] }
            ]
        }
    ]);
}
