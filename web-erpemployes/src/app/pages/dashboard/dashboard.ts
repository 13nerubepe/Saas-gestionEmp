import { Component, inject, signal } from '@angular/core';
import { NotificationsWidget } from '@/app/commons/notificationswidget';
import { StatsWidget } from '@/app/commons/statswidget';
import { RecentSalesWidget } from '@/app/commons/recentsaleswidget';
import { BestSellingWidget } from '@/app/commons/bestsellingwidget';
import { RevenueStreamWidget } from '@/app/commons/revenuestreamwidget';
import { MarketEvolutionWidget } from '@/app/commons/marketEvolution/market-evolution-widge';
import { AssistantAi } from '@/app/commons/assistant-ai/assistant-ai';
import {ProchainEvent} from "@/app/commons/prochain-event/prochain-event";
import { LegalQuestion } from '@/app/commons/legal-question/legal-question';
import { AuthService } from '@/app/core/auth/auth.service';
import { User } from '@/app/core/auth/auth.models';
import { ActivitesRecentes } from '@/app/pages/activites-recentes/activites-recentes';

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget, AssistantAi, ProchainEvent, LegalQuestion, ActivitesRecentes],
    templateUrl: './dashboard.html'
    // template: `
    //     <div class="grid grid-cols-12 gap-8">
    //         <app-stats-widget class="contents" />
    //         <div class="col-span-12 xl:col-span-6">
    //             <app-recent-sales-widget />
    //             <app-best-selling-widget />
    //         </div>
    //         <div class="col-span-12 xl:col-span-6">
    //             <app-revenue-stream-widget />
    //             <app-notifications-widget />
    //         </div>
    //     </div>
    // `
})
export class Dashboard {
    private readonly authService = inject(AuthService);

    readonly users = signal<User[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(): void {
        this.loading.set(true);
        this.error.set(null);

        this.authService.getUsers().subscribe({
            next: (users) => {
                this.users.set(users);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Erreur lors du chargement des utilisateurs', err);
                this.error.set('Impossible de charger les utilisateurs.');
                this.loading.set(false);
            }
        });
    }
}
