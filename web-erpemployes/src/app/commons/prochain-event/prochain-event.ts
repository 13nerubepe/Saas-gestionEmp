import { Component } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';

@Component({
    selector: 'app-prochain-event',
    imports: [ButtonDirective, Tag],
    templateUrl: './prochain-event.html',
    styleUrl: './prochain-event.scss'
})
export class ProchainEvent {}
