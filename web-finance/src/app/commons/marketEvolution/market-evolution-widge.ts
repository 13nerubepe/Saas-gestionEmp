import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';

@Component({
    standalone: true,
    selector: 'app-market-evolution-widget',
    imports: [CommonModule, ChartModule, SelectButtonModule, FormsModule],
    templateUrl: './market-evolution-widget.html'
})
export class MarketEvolutionWidget {
    selectedPeriod = '1M';

    periods = [
        { label: '1J', value: '1D' },
        { label: '1S', value: '1W' },
        { label: '1M', value: '1M' },
        { label: '6M', value: '6M' },
        { label: '1A', value: '1Y' }
    ];

    chartData = {
        labels: ['01', '05', '10', '15', '20', '25', '30'],
        datasets: [
            {
                label: 'Indice du marché',
                data: [102, 105, 103, 108, 112, 110, 116],
                fill: true,
                tension: 0.4
            }
        ]
    };

    chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: false
            }
        }
    };

    onPeriodChange() {
        console.log('Période sélectionnée :', this.selectedPeriod);

        // Plus tard :
        // appel API pour récupérer les données
        // this.marketService.getEvolution(this.selectedPeriod)
    }
}
