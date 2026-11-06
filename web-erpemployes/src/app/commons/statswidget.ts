import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LegalService } from '@/app/core/agents/legal.service';
import { CrmService } from '@/app/core/crm/crm.service';
import { AppConstantRoute } from '@/app/constants';

interface Shortcut {
    label: string;
    hint: string;
    icon: string;
    color: string;
    link: string;
    queryParams?: Record<string, string>;
}

/**
 * Dashboard shortcuts to the founder's daily tasks. Counts come from the API
 * (page `count` of the clients and conversations lists); nothing is invented.
 */
@Component({
    standalone: true,
    selector: 'app-stats-widget',
    imports: [RouterModule],
    template: `
        <nav aria-label="Raccourcis" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            @for (s of shortcuts(); track s.label) {
                <a
                    [routerLink]="s.link"
                    [queryParams]="s.queryParams"
                    class="group flex min-h-16 items-center gap-3 rounded-xl border border-surface-200 bg-surface-0 p-4 text-color no-underline transition-colors hover:border-primary dark:border-surface-700 dark:bg-surface-900"
                >
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" [class]="s.color" aria-hidden="true">
                        <i [class]="'pi ' + s.icon + ' !text-xl'"></i>
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col">
                        <span class="font-semibold text-surface-900 dark:text-surface-0">{{ s.label }}</span>
                        <span class="truncate text-sm text-muted-color">{{ s.hint }}</span>
                    </span>
                    <i class="pi pi-chevron-right text-sm text-muted-color transition-transform group-hover:translate-x-0.5" aria-hidden="true"></i>
                </a>
            }
        </nav>
    `
})
export class StatsWidget implements OnInit {
    private readonly legal = inject(LegalService);
    private readonly crm = inject(CrmService);

    private readonly clientCount = signal<number | null>(null);
    private readonly conversationCount = signal<number | null>(null);

    readonly shortcuts = computed<Shortcut[]>(() => {
        const clients = this.clientCount();
        const conversations = this.conversationCount();
        return [
            {
                label: 'Clients',
                hint: clients === null ? 'Fiches et historique des échanges' : plural(clients, 'fiche client', 'fiches clients'),
                icon: 'pi-users',
                color: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300',
                link: '/' + AppConstantRoute.Clients_PATH
            },
            {
                label: 'Nouveau client',
                hint: 'Ajouter un client ou un prospect',
                icon: 'pi-user-plus',
                color: 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-300',
                link: '/' + AppConstantRoute.Clients_PATH,
                queryParams: { nouveau: '1' }
            },
            {
                label: 'Assistant juridique',
                hint: conversations === null ? 'Questions et réponses sourcées' : plural(conversations, 'conversation', 'conversations'),
                icon: 'pi-briefcase',
                color: 'bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300',
                link: '/' + AppConstantRoute.Legal_Assistant_PATH
            }
        ];
    });

    ngOnInit(): void {
        // A failed count just leaves the generic hint: the shortcut still works.
        this.crm.listClients(1).subscribe({ next: (page) => this.clientCount.set(page.count), error: () => undefined });
        this.legal.listConversations().subscribe({ next: (page) => this.conversationCount.set(page.count), error: () => undefined });
    }
}

function plural(count: number, one: string, many: string): string {
    return count === 0 ? `Aucune ${one}` : `${count} ${count > 1 ? many : one}`;
}
