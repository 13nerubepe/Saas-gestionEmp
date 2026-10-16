import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@/app/core/auth/auth.models';

@Component({
    standalone: true,
    selector: 'app-stats-widget',
    imports: [CommonModule],
    templateUrl: 'statswidget.html',
//     template: `
//         <div class="col-span-12 lg:col-span-6 xl:col-span-3">
//             <div class="card mb-0">
//                 <div class="flex justify-between mb-4">
//                     <div>
//                         <span class="block text-muted-color font-medium mb-4">Employer</span>
//                         <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">152</div>
//                     </div>
//                     <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
//                         <i class="pi pi-shopping-cart text-blue-500 text-xl!"></i>
//                     </div>
//                 </div>
//                 <span class="text-primary font-medium">+1,23%</span>
// <!--                <span class="text-muted-color">since last visit</span>-->
//             </div>
//         </div>
//         <div class="col-span-12 lg:col-span-6 xl:col-span-3">
//             <div class="card mb-0">
//                 <div class="flex justify-between mb-4">
//                     <div>
//                         <span class="block text-muted-color font-medium mb-4">BTC</span>
//                         <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">$2.100</div>
//                     </div>
//                     <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
//                         <i class="pi pi-dollar text-orange-500 text-xl!"></i>
//                     </div>
//                 </div>
//                 <span class="text-primary font-medium">+52% </span>
// <!--                <span class="text-muted-color">since last week</span>-->
//             </div>
//         </div>
//         <div class="col-span-12 lg:col-span-6 xl:col-span-3">
//             <div class="card mb-0">
//                 <div class="flex justify-between mb-4">
//                     <div>
//                         <span class="block text-muted-color font-medium mb-4">ETH</span>
//                         <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">28441</div>
//                     </div>
//                     <div class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
//                         <i class="pi pi-users text-cyan-500 text-xl!"></i>
//                     </div>
//                 </div>
//                 <span class="text-primary font-medium">+52%</span>
// <!--                <span class="text-muted-color">newly registered</span>-->
//             </div>
//         </div>
//         <div class="col-span-12 lg:col-span-6 xl:col-span-3">
//             <div class="card mb-0">
//                 <div class="flex justify-between mb-4">
//                     <div>
//                         <span class="block text-muted-color font-medium mb-4">Portefeuille</span>
//                         <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">152</div>
//                     </div>
//                     <div class="flex items-center justify-center bg-purple-100 dark:bg-purple-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
//                         <i class="pi pi-comment text-purple-500 text-xl!"></i>
//                     </div>
//                 </div>
//                 <span class="text-primary font-medium">+85% </span>
// <!--                <span class="text-muted-color">responded</span>-->
//             </div>
//         </div>`
})
export class StatsWidget {
    users = input<User[]>([]);

    kpis = computed(() => {
        const list = this.users();
        const total = list.length;

        return [
            {
                label: 'Employés',
                value: total,
                sub: 'Total',
                subLabel: 'des comptes',
                icon: 'pi-users',
                color: 'text-blue-500',
                bg: 'bg-blue-100 dark:bg-blue-400/10'
            },
            {
                label: 'Comptes renseignés',
                value: list.filter(u => u.first_name && u.last_name).length,
                sub: total
                    ? `${Math.round(
                        (list.filter(u => u.first_name && u.last_name).length / total) * 100
                    )}%`
                    : '0%',
                subLabel: 'des utilisateurs',
                icon: 'pi-check-circle',
                color: 'text-green-500',
                bg: 'bg-green-100 dark:bg-green-400/10'
            },
            {
                label: 'Langue française',
                value: list.filter(u => u.language === 'fr').length,
                sub: total
                    ? `${Math.round(
                        (list.filter(u => u.language === 'fr').length / total) * 100
                    )}%`
                    : '0%',
                subLabel: 'des utilisateurs',
                icon: 'pi-globe',
                color: 'text-orange-500',
                bg: 'bg-orange-100 dark:bg-orange-400/10'
            },
            {
                label: 'Langue anglaise',
                value: list.filter(u => u.language === 'en').length,
                sub: total
                    ? `${Math.round(
                        (list.filter(u => u.language === 'en').length / total) * 100
                    )}%`
                    : '0%',
                subLabel: 'des utilisateurs',
                icon: 'pi-language',
                color: 'text-purple-500',
                bg: 'bg-purple-100 dark:bg-purple-400/10'
            }
        ];
    });
}
