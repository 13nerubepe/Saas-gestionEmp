import { Component, input } from '@angular/core';

/**
 * Empty list placeholder: an icon, what is missing, what to do next.
 * Put the call to action (a button) as content.
 */
@Component({
    selector: 'app-empty-state',
    standalone: true,
    template: `
        <div class="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-400/10" aria-hidden="true">
                <i [class]="'pi ' + icon() + ' !text-2xl'"></i>
            </span>
            <!-- !m-0: the Sakai typography gives every p a bottom margin outside Tailwind layers. -->
            <p class="!m-0 font-semibold text-surface-900 dark:text-surface-0">{{ title() }}</p>
            @if (text()) {
                <p class="!m-0 max-w-sm text-sm text-muted-color">{{ text() }}</p>
            }
            <div class="mt-1 flex flex-wrap justify-center gap-2 empty:hidden">
                <ng-content />
            </div>
        </div>
    `
})
export class EmptyState {
    readonly icon = input('pi-inbox');
    readonly title = input.required<string>();
    readonly text = input('');
}
