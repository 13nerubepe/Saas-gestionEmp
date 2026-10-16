import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@/app/core/auth/auth.service';
import { LegalService } from '@/app/core/agents/legal.service';

interface Stat {
    label: string;
    value: string;
    hint: string;
    icon: string;
    color: string;
    link?: string;
}

/** Dashboard header cards, from /auth/me/ and the legal conversations. */
@Component({
    standalone: true,
    selector: 'app-stats-widget',
    imports: [RouterModule],
    template: `
        @for (stat of stats(); track stat.label) {
            <div class="col-span-12 lg:col-span-6 xl:col-span-3">
                <div class="card mb-0 h-full">
                    <div class="mb-4 flex justify-between">
                        <div class="min-w-0">
                            <span class="mb-4 block font-medium text-muted-color">{{ stat.label }}</span>
                            <div class="truncate text-xl font-medium text-surface-900 dark:text-surface-0">{{ stat.value }}</div>
                        </div>
                        <div class="flex shrink-0 items-center justify-center rounded-border" [class]="stat.color" style="width: 2.5rem; height: 2.5rem">
                            <i [class]="'pi ' + stat.icon + ' text-xl'"></i>
                        </div>
                    </div>
                    @if (stat.link) {
                        <a [routerLink]="stat.link" class="text-sm font-medium text-primary">{{ stat.hint }}</a>
                    } @else {
                        <span class="text-sm text-muted-color">{{ stat.hint }}</span>
                    }
                </div>
            </div>
        }
    `
})
export class StatsWidget implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly legal = inject(LegalService);

    private readonly conversationCount = signal<number | null>(null);

    readonly stats = computed<Stat[]>(() => {
        const user = this.auth.user();
        const membership = this.auth.activeMembership();
        const count = this.conversationCount();
        const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
        return [
            {
                label: 'Entreprise',
                value: membership?.company_name ?? '—',
                hint: membership ? `Pays : ${membership.country}` : 'Aucune entreprise',
                icon: 'pi-building',
                color: 'bg-blue-100 text-blue-500 dark:bg-blue-400/10'
            },
            {
                label: 'Mon rôle',
                value: membership?.role === 'founder' ? 'Fondateur' : membership ? 'Employé' : '—',
                hint: fullName || user?.email || '',
                icon: 'pi-id-card',
                color: 'bg-orange-100 text-orange-500 dark:bg-orange-400/10',
                link: '/profil'
            },
            {
                label: 'Questions juridiques',
                value: count === null ? '…' : String(count),
                hint: "Voir l'historique",
                icon: 'pi-briefcase',
                color: 'bg-cyan-100 text-cyan-500 dark:bg-cyan-400/10',
                link: '/assistant-juridique'
            },
            {
                label: 'Langue des réponses',
                value: user?.language === 'en' ? 'English' : 'Français',
                hint: 'Modifier',
                icon: 'pi-language',
                color: 'bg-purple-100 text-purple-500 dark:bg-purple-400/10',
                link: '/profil'
            }
        ];
    });

    ngOnInit(): void {
        this.legal.listConversations().subscribe({
            next: (page) => this.conversationCount.set(page.count),
            error: () => this.conversationCount.set(null)
        });
    }
}
