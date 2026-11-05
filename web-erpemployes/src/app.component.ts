import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LayoutService } from '@/app/layout/service/layout.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent {
    // Created here so the saved light/dark theme also applies to the login page.
    private readonly layout = inject(LayoutService);
}
