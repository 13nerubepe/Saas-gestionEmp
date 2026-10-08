import { Component } from '@angular/core';
import { Actif, Periode } from '@/app/commons/models/model';
import { NgClass } from '@angular/common';
import { UIChart } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';

@Component({
    selector: 'app-comparaison-actif',
    imports: [NgClass, UIChart, TableModule, Button, SelectButton, FormsModule, MultiSelect],
    templateUrl: './comparaison-actif.html',
    styleUrl: './comparaison-actif.scss'
})
export class ComparaisonActifComponent {
    actifs: Actif[] = [
        { symbol: 'BTC', name: 'Bitcoin', type: 'Crypto', price: 68432.17, currency: '$', var24h: 2.45, volatility30: 32.4, color: '#f59e0b', drift: 0.012 },
        { symbol: 'ETH', name: 'Ethereum', type: 'Crypto', price: 3245.12, currency: '$', var24h: 1.76, volatility30: 28.7, color: '#3b82f6', drift: 0.007 },
        { symbol: 'AAPL', name: 'Apple', type: 'Action', price: 170.21, currency: '$', var24h: 1.56, volatility30: 18.4, color: '#10b981', drift: 0.004 },
        { symbol: 'NVDA', name: 'NVIDIA', type: 'Action', price: 124.36, currency: '$', var24h: 5.21, volatility30: 41.2, color: '#8b5cf6', drift: 0.015 },
        { symbol: 'TSLA', name: 'Tesla', type: 'Action', price: 178.22, currency: '$', var24h: -1.23, volatility30: 45.9, color: '#ef4444', drift: -0.002 },
        { symbol: 'GOLD', name: 'Or', type: 'Matière première', price: 2338.45, currency: '$', var24h: 0.64, volatility30: 12.1, color: '#eab308', drift: 0.003 }
    ];

    periodes: Periode[] = [
        { label: '1J', value: '1J', points: 24 },
        { label: '7J', value: '7J', points: 7 },
        { label: '1M', value: '1M', points: 30 },
        { label: '3M', value: '3M', points: 90 },
        { label: '1A', value: '1A', points: 52 }
    ];

    selection: Actif[] = [];
    periode = '7J';

    Math = Math;
    chartData: any;
    chartOptions: any;

    ngOnInit() {
        this.selection = this.actifs.slice(0, 3);
        this.comparer();
    }

    /** Reconstruit le graphique (base 100) à partir de la sélection et de la période. */
    comparer() {
        const p = this.periodes.find((x) => x.value === this.periode)!;
        const labels = Array.from({ length: p.points }, (_, i) => this.label(i, p));

        this.chartData = {
            labels,
            datasets: this.selection.map((a) => ({
                label: a.symbol,
                data: this.serie(a, p.points),
                borderColor: a.color,
                backgroundColor: a.color,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.35
            }))
        };

        const text = getComputedStyle(document.documentElement).getPropertyValue('--p-text-muted-color') || '#64748b';
        const grid = getComputedStyle(document.documentElement).getPropertyValue('--p-content-border-color') || '#e2e8f0';

        this.chartOptions = {
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, color: text } },
                tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label} : ${c.parsed.y.toFixed(1)}` } }
            },
            scales: {
                x: { ticks: { color: text, maxTicksLimit: 8 }, grid: { display: false } },
                y: { ticks: { color: text }, grid: { color: grid } }
            }
        };
    }

    changerPeriode(value: string) {
        this.periode = value;
        this.comparer();
    }

    /** Performance sur la période = dernier point - 100 */
    perf(a: Actif): number {
        const ds = this.chartData?.datasets?.find((d: any) => d.label === a.symbol);
        return ds ? +(ds.data[ds.data.length - 1] - 100).toFixed(2) : 0;
    }

    get meilleur(): Actif | undefined {
        return [...this.selection].sort((a, b) => this.perf(b) - this.perf(a))[0];
    }

    get plusVolatil(): Actif | undefined {
        return [...this.selection].sort((a, b) => b.volatility30 - a.volatility30)[0];
    }

    get maxPerf(): number {
        return Math.max(1, ...this.selection.map((a) => Math.abs(this.perf(a))));
    }

    retirer(a: Actif) {
        if (this.selection.length > 2) {
            this.selection = this.selection.filter((x) => x.symbol !== a.symbol);
            this.comparer();
        }
    }

    // ---------- Données de démonstration (à remplacer par ton API) ----------
    private serie(a: Actif, n: number): number[] {
        let seed = [...a.symbol].reduce((s, c) => s + c.charCodeAt(0), 0) * (n + 7);
        const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5;
        const vol = a.volatility30 / 1000;
        const out = [100];
        for (let i = 1; i < n; i++) {
            out.push(+(out[i - 1] * (1 + a.drift * (n > 30 ? 0.4 : 1) + rand() * vol * 3)).toFixed(2));
        }
        return out;
    }

    private label(i: number, p: Periode): string {
        if (p.value === '1J') return `${i}h`;
        if (p.value === '1A') return `S${i + 1}`;
        const d = new Date();
        d.setDate(d.getDate() - (p.points - 1 - i));
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
}
