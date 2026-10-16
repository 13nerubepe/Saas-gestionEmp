import { Component } from '@angular/core';
import { APP_NAME } from '@/app/constants';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">© {{ year }} {{ appName }}</div>`
})
export class AppFooter {
    readonly appName = APP_NAME;
    readonly year = new Date().getFullYear();
}
