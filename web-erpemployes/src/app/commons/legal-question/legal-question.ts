import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { LegalAnswer, LegalService } from '@/app/core/agents/legal.service';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { LegalAnswerView } from './legal-answer-view';

/** US-02 on the dashboard: ask a legal question, get an answer with its sources and a disclaimer. */
@Component({
    selector: 'app-legal-question',
    standalone: true,
    imports: [FormsModule, RouterModule, ButtonModule, TextareaModule, LegalAnswerView],
    template: `
        <div class="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900 md:p-6">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300">
                        <i class="pi pi-briefcase text-xl"></i>
                    </div>
                    <div>
                        <h3 class="m-0 text-lg font-semibold text-surface-900 dark:text-surface-0">Question juridique</h3>
                        <p class="m-0 mt-1 text-xs text-surface-500">Réponse fondée sur les textes applicables à votre entreprise.</p>
                    </div>
                </div>
                <a routerLink="/assistant-juridique" class="text-sm font-medium text-primary">Historique</a>
            </div>

            @if (auth.isFounder()) {
                <form class="mt-5 flex flex-col gap-3" (ngSubmit)="ask()">
                    <textarea pTextarea name="question" [(ngModel)]="question" rows="3" [autoResize]="true" placeholder="Ex. : Combien de temps peut durer la période d'essai d'un salarié ?" class="w-full" [disabled]="loading()"></textarea>
                    <div class="flex justify-end">
                        <p-button type="submit" label="Poser la question" icon="pi pi-send" [loading]="loading()" [disabled]="question.trim().length < 3" />
                    </div>
                </form>
            } @else {
                <p class="mb-0 mt-5 text-sm text-surface-500">L'assistant juridique est réservé aux fondateurs de l'entreprise.</p>
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
