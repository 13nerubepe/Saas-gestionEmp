import { Component } from '@angular/core';
import { NotificationsWidget } from '@/app/commons/notificationswidget';
import { StatsWidget } from '@/app/commons/statswidget';
import { RecentSalesWidget } from '@/app/commons/recentsaleswidget';
import { BestSellingWidget } from '@/app/commons/bestsellingwidget';
import { RevenueStreamWidget } from '@/app/commons/revenuestreamwidget';
import { MarketEvolutionWidget } from '@/app/commons/marketEvolution/market-evolution-widge';

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget, RecentSalesWidget, BestSellingWidget, RevenueStreamWidget, NotificationsWidget, MarketEvolutionWidget],
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
