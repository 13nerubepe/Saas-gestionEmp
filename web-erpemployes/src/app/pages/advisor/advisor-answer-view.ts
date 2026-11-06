import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { AdvisorExchange, AdvisorSource } from '@/app/core/advisor/advisor.service';
import { AppConstantRoute } from '@/app/constants';

const CONFIDENCE: Record<AdvisorExchange['confidence'], { label: string; severity: 'success' | 'warn' | 'danger' }> = {
    high: { label: 'Fiabilité élevée', severity: 'success' },
    medium: { label: 'Fiabilité moyenne', severity: 'warn' },
    low: { label: 'Fiabilité faible', severity: 'danger' }
};

/** One advisor answer: text, reliability, referral, the data it used, disclaimer. */
@Component({
    selector: 'app-advisor-answer-view',
    standalone: true,
    imports: [RouterLink, TagModule],
    template: `
        <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-center gap-2">
                <p-tag [value]="confidence().label" [severity]="confidence().severity" [rounded]="true" />
            </div>

            <div class="rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm leading-6 dark:border-surface-700 dark:bg-surface-800" style="white-space: pre-line">{{ exchange().answer }}</div>

            @if (exchange().referral) {
                <p class="!m-0 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" role="note">
                    <i class="pi pi-user mt-0.5" aria-hidden="true"></i><span>{{ exchange().referral_text }}</span>
                </p>
            }

            @if (exchange().sources.length) {
                <details class="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                    <summary class="cursor-pointer font-medium">Données utilisées ({{ exchange().sources.length }})</summary>
                    <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                        @for (s of exchange().sources; track s.number) {
                            <li class="flex gap-2">
                                <span class="shrink-0 text-xs font-semibold text-muted-color">[{{ s.number }}]</span>
                                <span class="text-surface-700 dark:text-surface-200">
                                    {{ s.text }}
                                    @if (link(s); as l) {
                                        <a [routerLink]="l" class="ml-1 whitespace-nowrap text-xs font-medium text-primary">{{ s.link_type === 'invoice' ? 'Voir la facture' : 'Voir le client' }}</a>
                                    }
                                </span>
                            </li>
                        }
                    </ul>
                </details>
            }

            <p class="!m-0 flex items-start gap-2 text-xs text-muted-color">
                <i class="pi pi-info-circle mt-0.5" aria-hidden="true"></i>
                <span>{{ exchange().disclaimer }}</span>
            </p>
        </div>
    `
})
export class AdvisorAnswerView {
    readonly exchange = input.required<AdvisorExchange>();
    readonly confidence = computed(() => CONFIDENCE[this.exchange().confidence]);

    link(source: AdvisorSource): string[] | null {
        if (!source.link_id) return null;
        if (source.link_type === 'client') return ['/', AppConstantRoute.Clients_PATH, source.link_id];
        if (source.link_type === 'invoice') return ['/', AppConstantRoute.Invoices_PATH, source.link_id];
        return null;
    }
}
