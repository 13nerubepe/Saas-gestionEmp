import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { DepartementService } from '@/app/core/departement/departement.service';
import { Departement } from '@/app/core/departement/departement.model';

@Component({
    selector: 'app-dashboard-departements',
    standalone: true,
    imports: [CommonModule, ChartModule],
    templateUrl: './dashboard-departements.html',
    styleUrl: './dashboard-departements.scss'
})
export class DashboardDepartements implements OnInit {
    private readonly service = inject(DepartementService);

    readonly departements = signal<Departement[]>([]);

    readonly totalEmployes = computed(() => this.departements().reduce((sum, d) => sum + d.effectif, 0));
    readonly totalDepartements = computed(() => this.departements().length);
    readonly tauxOccupation = 98;

    chartData: any;
    chartOptions: any;
    barData: any;
    barOptions: any;

    couleurs = ['#6366f1', '#ec4899', '#06b6d4', '#8b5cf6', '#f59e0b'];

    ngOnInit(): void {
        this.service.getAll().subscribe(data => {
            this.departements.set(data);
            this.initCharts();
        });
    }

    initCharts(): void {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');

        // 1. Graphique en donut
        this.chartData = {
            labels: this.departements().map(d => d.nom),
            datasets: [
                {
                    data: this.departements().map(d => d.effectif),
                    backgroundColor: this.couleurs,
                    hoverBackgroundColor: this.couleurs,
                    borderWidth: 0
                }
            ]
        };

        this.chartOptions = {
            cutout: '75%',
            plugins: { legend: { display: false } }
        };

        // 2. Graphique en barres horizontales
        this.barData = {
            labels: this.departements().map(d => d.nom),
            datasets: [
                {
                    data: this.departements().map(d => d.effectif),
                    backgroundColor: '#6366f1',
                    borderRadius: 4,
                    barThickness: 15
                }
            ]
        };

        this.barOptions = {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false, max: 20 },
                y: { ticks: { color: textColor, font: { size: 12 } }, grid: { display: false } }
            }
        };
    }

    getPourcentage(effectif: number): string {
        const total = this.totalEmployes();
        if (total === 0) return '0%';
        return Math.round((effectif / total) * 100) + '%';
    }

    getCouleur(index: number): string {
        return this.couleurs[index % this.couleurs.length];
    }
}