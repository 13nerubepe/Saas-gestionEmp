import { Component } from '@angular/core';
import { Button, ButtonDirective } from 'primeng/button';
import { DataView } from 'primeng/dataview';
import { NgClass, NgForOf, NgIf, NgOptimizedImage } from '@angular/common';
import { OrderList } from 'primeng/orderlist';
import { PickList } from 'primeng/picklist';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { Product, ProductService } from '@/app/pages/service/product.service';
import { RssService } from '@/app/pages/service/rss-service';
import { Actualite } from '@/app/commons/models/model';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { TranslateService } from '@/app/pages/service/translate-service';

@Component({
    selector: 'app-actualites',
    imports: [Button, NgForOf, SelectButton, FormsModule, NgClass, IconField, InputIcon, InputText, Tag, DataView, NgOptimizedImage, ButtonDirective],
    templateUrl: './actualites.html',
    styleUrl: './actualites.scss'
})
export class ActualitesComponent {
    // listeActualites: Actualite[] = [];

    // MENU
    menuActualites = [
        { label: 'Toutes', value: 'toutes' },
        { label: 'Économie', value: 'economie' },
        { label: 'Finance', value: 'finance' },
        { label: 'Politique', value: 'politique' },
        { label: 'Société', value: 'societe' }
    ];
    layout: 'list' | 'grid' = 'list';
    options = ['list', 'grid'];

    selectMenu(value: string) {
        this.selectedMenuActualite = value;
    }

    categoryClass(category: string): string {
        const map: Record<string, string> = {
            'Marchés':      'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
            'NVDA':         'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
            'Crypto':       'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
            'Économie':     'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
            'Géopolitique': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
            'Actions':      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
        };
        return map[category] ?? 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300';
    }

    searchTerm = '';

    selectedMenuActualite = 'toutes';

    listeActualites: Actualite[] = [
        {
            id: 1,

            title: 'Les marchés financiers poursuivent leur progression',

            description: 'Les principaux marchés financiers enregistrent une nouvelle progression dans un contexte économique marqué par plusieurs indicateurs favorables.',

            category: 'Finance',

            source: 'Financial Times',

            date: '06 Oct. 2026',

            image: 'assets/images/actualites/finance.jpg',

            featured: true
        },

        {
            id: 2,

            title: 'Les perspectives économiques du Cameroun',

            description: 'Les dernières projections économiques présentent les principales tendances et perspectives pour les prochains mois.',

            category: 'Économie',

            source: 'Ecofin',

            date: '05 Oct. 2026',

            image: 'assets/images/actualites/economie.jpg',

            featured: false
        },

        {
            id: 3,

            title: 'Nouvelles orientations de la politique budgétaire',

            description: 'De nouvelles orientations sont annoncées concernant la gestion des finances publiques et la programmation budgétaire.',

            category: 'Politique',

            source: 'MINFI',

            date: '04 Oct. 2026',

            image: 'assets/images/actualites/politique.jpg',

            featured: false
        },

        {
            id: 4,

            title: 'Les entreprises accélèrent leur transformation numérique',

            description: 'La transformation numérique devient un levier stratégique pour améliorer la productivité et la compétitivité des entreprises.',

            category: 'Économie',

            source: 'Business Africa',

            date: '03 Oct. 2026',

            image: 'assets/images/actualites/business.jpg',

            featured: false
        }
    ];

    get filteredActualites(): Actualite[] {
        return this.listeActualites.filter((actualite) => {
            const matchCategory = this.selectedMenuActualite === 'toutes' || actualite.category.toLowerCase() === this.selectedMenuActualite.toLowerCase();

            const search = this.searchTerm.trim().toLowerCase();

            const matchSearch = !search || actualite.title.toLowerCase().includes(search) || actualite.description.toLowerCase().includes(search) || actualite.source.toLowerCase().includes(search);

            return matchCategory && matchSearch;
        });
    }

    openArticle(actualite: Actualite): void {
        // if (actualite.url) {
        //
        //     window.open(
        //         actualite.url,
        //         '_blank'
        //     );
        // }
    }

    constructor(
        private actualiteService: RssService,
        private translateService: TranslateService
    ) {}

    ngOnInit() {
        // this.actualiteService.getProductsSmall().then((data) => (this.products = data.slice(0, 6)));
        //
        // this.sourceCities = [
        //     { name: 'San Francisco', code: 'SF' },
        //     { name: 'London', code: 'LDN' },
        //     { name: 'Paris', code: 'PRS' },
        //     { name: 'Istanbul', code: 'IST' },
        //     { name: 'Berlin', code: 'BRL' },
        //     { name: 'Barcelona', code: 'BRC' },
        //     { name: 'Rome', code: 'RM' }
        // ];
        //
        // this.targetCities = [];
        //
        // this.orderCities = [
        //     { name: 'San Francisco', code: 'SF' },
        //     { name: 'London', code: 'LDN' },
        //     { name: 'Paris', code: 'PRS' },
        //     { name: 'Istanbul', code: 'IST' },
        //     { name: 'Berlin', code: 'BRL' },
        //     { name: 'Barcelona', code: 'BRC' },
        //     { name: 'Rome', code: 'RM' }
        // ];
    }

    getSeverity(product: Product) {
        switch (product.inventoryStatus) {
            case 'INSTOCK':
                return 'success';

            case 'LOWSTOCK':
                return 'warn';

            case 'OUTOFSTOCK':
                return 'danger';

            default:
                return 'info';
        }
    }
}
