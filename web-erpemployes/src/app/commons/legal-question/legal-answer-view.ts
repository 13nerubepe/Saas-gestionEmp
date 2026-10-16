import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { LegalAnswer } from '@/app/core/agents/legal.service';

/** One agent answer: text, cited sources (expandable) and the disclaimer. */
@Component({
    selector: 'app-legal-answer-view',
    standalone: true,
    imports: [TagModule],
    template: `
        <div class="flex flex-col gap-4">
            <div class="rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm leading-6 dark:border-surface-700 dark:bg-surface-800" style="white-space: pre-line">{{ answer().answer }}</div>

            @if (answer().sources.length) {
                <div class="flex flex-col gap-2">
                    <span class="text-xs font-semibold uppercase text-surface-500">Sources</span>
                    @for (s of answer().sources; track s.rank) {
                        <details class="rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
                            <summary class="cursor-pointer font-medium">
                                <p-tag [value]="s.jurisdiction" severity="secondary" class="mr-2" />
                                {{ s.citation }}
                            </summary>
                            <p class="mb-0 mt-2 text-surface-600 dark:text-surface-300">{{ s.content }}</p>
                            @if (s.source_url) {
                                <a [href]="s.source_url" target="_blank" rel="noopener" class="mt-2 inline-block text-xs text-primary">Texte officiel</a>
                            }
                        </details>
                    }
                </div>
            }

            <p class="m-0 flex items-start gap-2 text-xs text-surface-500">
                <i class="pi pi-info-circle mt-0.5"></i>
                <span>{{ answer().disclaimer }}</span>
            </p>
        </div>
    `
})
export class LegalAnswerView {
    readonly answer = input.required<LegalAnswer>();
}
