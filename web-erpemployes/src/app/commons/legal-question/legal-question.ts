import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { LegalAnswer, LegalService } from '@/app/core/agents/legal.service';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { LegalAnswerView } from './legal-answer-view';
import { EXAMPLE_LEGAL_QUESTIONS } from './example-questions';

/** US-02 on the dashboard: ask a legal question, get an answer with its sources and a disclaimer. */
@Component({
    selector: 'app-legal-question',
    standalone: true,
    imports: [FormsModule, RouterModule, ButtonModule, TextareaModule, LegalAnswerView],
    template: `
        <div class="card !mb-0">
            <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300" aria-hidden="true">
                        <i class="pi pi-briefcase !text-xl"></i>
                    </div>
                    <div class="min-w-0">
                        <!-- !text-*: the Sakai typography sizes h2 outside Tailwind layers. -->
                        <h2 class="!m-0 !text-lg !font-semibold !leading-snug text-surface-900 dark:text-surface-0">Question juridique</h2>
                        <p class="m-0 text-sm text-muted-color">Réponse fondée sur les textes applicables à votre entreprise, avec ses sources.</p>
                    </div>
                </div>
                <a routerLink="/assistant-juridique" class="inline-flex min-h-[44px] shrink-0 items-center text-sm font-medium text-primary">Historique</a>
            </div>

            @if (auth.isFounder()) {
                <form class="mt-4 flex flex-col gap-3" (ngSubmit)="ask()">
                    <textarea
                        pTextarea
                        name="question"
                        [(ngModel)]="question"
                        rows="3"
                        [autoResize]="true"
                        placeholder="Décrivez votre situation ou posez votre question…"
                        aria-label="Votre question juridique"
                        class="w-full"
                        [disabled]="loading()"
                    ></textarea>
                    @if (!question.trim() && !answer()) {
                        <div class="flex flex-wrap gap-2" aria-label="Exemples de questions">
                            @for (example of examples; track example) {
                                <button
                                    type="button"
                                    class="min-h-[44px] rounded-full border border-surface-200 px-3 py-2 text-left text-sm text-color transition-colors hover:border-primary hover:text-primary dark:border-surface-700 sm:min-h-9 sm:py-1"
                                    (click)="question = example"
                                >
                                    {{ example }}
                                </button>
                            }
                        </div>
                    }
                    <div class="flex justify-end">
                        <p-button type="submit" label="Poser la question" icon="pi pi-send" [loading]="loading()" [disabled]="question.trim().length < 3" />
                    </div>
                </form>
            } @else {
                <p class="mb-0 mt-4 text-sm text-muted-color">L'assistant juridique est réservé aux fondateurs de l'entreprise.</p>
            }

            @if (errorMessage()) {
                <div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
                    {{ errorMessage() }}
                </div>
            }

            @if (answer(); as a) {
                <div class="mt-5">
                    <app-legal-answer-view [answer]="a" />
                </div>
            }
        </div>
    `
})
export class LegalQuestion {
    private readonly legal = inject(LegalService);
    protected readonly auth = inject(AuthService);

    question = '';
    readonly examples = EXAMPLE_LEGAL_QUESTIONS;
    readonly loading = signal(false);
    readonly answer = signal<LegalAnswer | null>(null);
    readonly errorMessage = signal('');

    ask(): void {
        const question = this.question.trim();
        if (question.length < 3 || this.loading()) return;

        this.loading.set(true);
        this.errorMessage.set('');
        // Follow-up questions stay in the same conversation.
        this.legal.ask(question, this.answer()?.conversation_id).subscribe({
            next: (answer) => {
                this.answer.set(answer);
                this.question = '';
                this.loading.set(false);
            },
            error: (error) => {
                this.errorMessage.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }
}
