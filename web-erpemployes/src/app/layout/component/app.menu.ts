import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AppConstantRoute } from '@/app/constants';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `
})
export class AppMenu {
    // Only the delivered features (US-01 sign-in, US-02 legal assistant).
    model: MenuItem[] = [
        {
            label: 'Menu',
            items: [
                { label: 'Tableau de bord', icon: 'pi pi-fw pi-home', routerLink: ['/'] },
                { label: 'Assistant juridique', icon: 'pi pi-fw pi-briefcase', routerLink: ['/' + AppConstantRoute.Legal_Assistant_PATH] },
                { label: 'Mon profil', icon: 'pi pi-fw pi-user', routerLink: ['/' + AppConstantRoute.Profile_PATH] }
            ]
        }
    ];
}
