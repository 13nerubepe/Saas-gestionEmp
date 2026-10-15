import { Component, output } from '@angular/core';
import { Tag } from 'primeng/tag';

@Component({
    selector: 'app-assistant-ai',
    imports: [Tag],
    templateUrl: './assistant-ai.html',
    styleUrl: './assistant-ai.scss'
})
export class AssistantAi {

    actionSelected = output<string>();
    onAction(action: string): void { this.actionSelected.emit(action); }
}
