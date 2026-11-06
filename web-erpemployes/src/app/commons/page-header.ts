import { Component, input } from '@angular/core';

/**
 * Shared page header: title, optional subtitle, and the page's main actions
 * projected on the right (stacked under the title on phones).
 *
 *   <app-page-header title="Clients" subtitle="…">
 *       <p-button label="Nouveau client" … />
 *   </app-page-header>
 */
@Component({
    selector: 'app-page-header',
    standalone: true,
    template: `
        <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
                <!-- !text-*: the Sakai typography sets h1 to 2.5rem outside Tailwind layers. -->
                <h1 class="!m-0 !text-2xl !font-semibold !leading-tight text-surface-900 dark:text-surface-0">{{ title() }}</h1>
                @if (subtitle()) {
                    <p class="m-0 mt-1 text-sm text-muted-color">{{ subtitle() }}</p>
                }
            </div>
            <div class="flex flex-wrap items-center gap-2 empty:hidden">
                <ng-content />
            </div>
        </header>
    `
})
export class PageHeader {
    readonly title = input.required<string>();
    readonly subtitle = input<string>('');
}
