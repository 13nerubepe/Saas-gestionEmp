import { Component } from '@angular/core';
import { NotificationsWidget } from '@/app/commons/notificationswidget';
import { StatsWidget } from '@/app/commons/statswidget';
import { RecentSalesWidget } from '@/app/commons/recentsaleswidget';
import { BestSellingWidget } from '@/app/commons/bestsellingwidget';
import { RevenueStreamWidget } from '@/app/commons/revenuestreamwidget';
import { MarketEvolutionWidget } from '@/app/commons/marketEvolution/market-evolution-widge';
import { AssistantAi } from '@/app/commons/assistant-ai/assistant-ai';
import {ProchainEvent} from "@/app/commons/prochain-event/prochain-event";

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget,  AssistantAi, ProchainEvent],
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
export class Dashboard {}
