import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { Conversation, ConversationDetail, LegalService } from '@/app/core/agents/legal.service';
import { AuthService } from '@/app/core/auth/auth.service';
import { apiErrorMessage } from '@/app/core/api-errors';
import { LegalAnswerView } from '@/app/commons/legal-question/legal-answer-view';
import { EXAMPLE_LEGAL_QUESTIONS } from '@/app/commons/legal-question/example-questions';
import { PageHeader } from '@/app/commons/page-header';

/** Legal assistant: conversation history, a conversation's exchanges, follow-up questions. */
@Component({
    selector: 'app-legal-assistant',
    standalone: true,
    imports: [DatePipe, FormsModule, ButtonModule, TextareaModule, LegalAnswerView, PageHeader],
    template: `
        <app-page-header title="Assistant juridique" subtitle="Des réponses fondées sur les textes applicables à votre entreprise, avec leurs sources.">
            @if (auth.isFounder() && selected()) {
                <p-button label="Nouvelle conversation" icon="pi pi-plus" [outlined]="true" (onClick)="startNew()" />
            }
        </app-page-header>

        <div class="grid grid-cols-12 gap-6">
            <!-- Conversations: under the question box on phones, on the left on wide screens. -->
            <div class="order-last col-span-12 lg:order-first lg:col-span-4">
                <div class="card !mb-0 flex flex-col gap-3">
                    <h2 class="!m-0 !text-lg font-semibold">Conversations</h2>

                    @if (listError()) {
                        <p class="m-0 text-sm text-red-600" role="alert">{{ listError() }}</p>
                    }

                    @for (c of conversations(); track c.id) {
                        <button
                            type="button"
                            class="flex min-h-[44px] flex-col gap-1 rounded-lg border p-3 text-left text-color transition-colors hover:border-primary"
                            [class]="c.id === selected()?.id ? 'border-primary bg-primary-50 dark:bg-primary-400/10' : 'border-surface-200 dark:border-surface-700'"
                            [attr.aria-current]="c.id === selected()?.id ? 'true' : null"
                            (click)="open(c.id)"
                        >
                            <span class="line-clamp-2 text-sm font-medium">{{ c.title }}</span>
                            <span class="text-xs text-muted-color">{{ c.created_at | date: 'd MMM y, HH:mm' }}</span>
                        </button>
                    } @empty {
                        @if (!loadingList()) {
                            <p class="m-0 text-sm text-muted-color">Aucune conversation pour l'instant. Vos questions et leurs réponses s'afficheront ici.</p>
                        }
                    }

                    @if (loadingList()) {
                        <p class="m-0 text-sm text-surface-500"><i class="pi pi-spin pi-spinner mr-2"></i>Chargement…</p>
                    } @else if (hasMore()) {
                        <p-button label="Charger plus" [text]="true" size="small" (onClick)="loadMore()" />
                    }
                </div>
            </div>

            <!-- Selected conversation -->
            <div class="col-span-12 lg:col-span-8">
                <div class="card !mb-0 flex flex-col gap-6">
                    <h2 class="!m-0 !text-lg font-semibold">{{ selected()?.title ?? 'Nouvelle conversation' }}</h2>

                    @if (!selected() && !loadingDetail() && auth.isFounder()) {
                        <div class="flex flex-col gap-3 rounded-xl bg-surface-50 p-4 text-sm dark:bg-surface-800">
                            <p class="!m-0 text-muted-color">L'assistant cherche les articles applicables à votre situation et cite ses sources. Par exemple :</p>
                            <div class="flex flex-wrap gap-2">
                                @for (example of examples; track example) {
                                    <button
                                        type="button"
                                        class="min-h-[44px] rounded-full border border-surface-200 bg-surface-0 px-3 py-2 text-left text-sm text-color transition-colors hover:border-primary hover:text-primary dark:border-surface-700 dark:bg-surface-900 sm:min-h-9 sm:py-1"
                                        (click)="question = example"
                                    >
                                        {{ example }}
                                    </button>
                                }
                            </div>
                        </div>
                    }

                    @if (loadingDetail()) {
                        <p class="m-0 text-sm text-surface-500"><i class="pi pi-spin pi-spinner mr-2"></i>Chargement…</p>
                    }

                    @for (exchange of selected()?.exchanges ?? []; track exchange.id) {
                        <div class="flex flex-col gap-3">
                            <div class="self-end rounded-xl bg-primary px-4 py-2 text-sm text-primary-contrast" style="max-width: 85%">{{ exchange.question }}</div>
                            <app-legal-answer-view [answer]="exchange" />
                        </div>
                    }

                    @if (auth.isFounder()) {
                        <form class="flex flex-col gap-3 border-t border-surface-200 pt-4 dark:border-surface-700" (ngSubmit)="ask()">
                            <textarea
                                pTextarea
                                name="question"
                                [(ngModel)]="question"
                                rows="3"
                                [autoResize]="true"
                                [placeholder]="selected() ? 'Question de suivi…' : 'Posez votre question juridique…'"
                                aria-label="Votre question juridique"
                                class="w-full"
                                [disabled]="asking()"
                            ></textarea>
                            @if (askError()) {
                                <p class="m-0 text-sm text-red-600" role="alert">{{ askError() }}</p>
                            }
                            <div class="flex justify-end">
                                <p-button type="submit" label="Envoyer" icon="pi pi-send" [loading]="asking()" [disabled]="question.trim().length < 3" />
                            </div>
                        </form>
                    } @else {
                        <p class="m-0 text-sm text-muted-color">L'assistant juridique est réservé aux fondateurs de l'entreprise.</p>
                    }
                </div>
            </div>
        </div>
    `
})
export class LegalAssistant implements OnInit {
    private readonly legal = inject(LegalService);
    protected readonly auth = inject(AuthService);

    readonly conversations = signal<Conversation[]>([]);
    readonly selected = signal<ConversationDetail | null>(null);
    readonly loadingList = signal(false);
    readonly loadingDetail = signal(false);
    readonly asking = signal(false);
    readonly hasMore = signal(false);
    readonly listError = signal('');
    readonly askError = signal('');

    question = '';
    readonly examples = EXAMPLE_LEGAL_QUESTIONS;
    private page = 1;

    ngOnInit(): void {
        this.loadPage(1);
    }

    loadMore(): void {
        this.loadPage(this.page + 1);
    }

    open(id: string): void {
        this.loadingDetail.set(true);
        this.askError.set('');
        this.legal.getConversation(id).subscribe({
            next: (conversation) => {
                this.selected.set(conversation);
                this.loadingDetail.set(false);
            },
            error: (error) => {
                this.listError.set(apiErrorMessage(error));
                this.loadingDetail.set(false);
            }
        });
    }

    startNew(): void {
        this.selected.set(null);
        this.question = '';
        this.askError.set('');
    }

    ask(): void {
        const question = this.question.trim();
        if (question.length < 3 || this.asking()) return;

        this.asking.set(true);
        this.askError.set('');
        const current = this.selected();
        this.legal.ask(question, current?.id).subscribe({
            next: (answer) => {
                this.question = '';
                this.asking.set(false);
                if (current) {
                    this.selected.set({ ...current, exchanges: [...current.exchanges, answer] });
                } else {
                    // A new conversation: show it and put it at the top of the list.
                    this.selected.set({ id: answer.conversation_id, title: answer.question, created_at: answer.created_at, exchanges: [answer] });
                    this.conversations.update((list) => [{ id: answer.conversation_id, title: answer.question, created_at: answer.created_at }, ...list]);
                }
            },
            error: (error) => {
                this.askError.set(apiErrorMessage(error));
                this.asking.set(false);
            }
        });
    }

    private loadPage(page: number): void {
        this.loadingList.set(true);
        this.listError.set('');
        this.legal.listConversations(page).subscribe({
            next: (result) => {
                this.page = page;
                this.conversations.update((list) => (page === 1 ? result.results : [...list, ...result.results]));
                this.hasMore.set(result.next !== null);
                this.loadingList.set(false);
            },
            error: (error) => {
                this.listError.set(apiErrorMessage(error));
                this.loadingList.set(false);
            }
        });
    }
}
