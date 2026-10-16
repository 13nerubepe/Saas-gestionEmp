import { Component } from '@angular/core';
import { StatsWidget } from '@/app/commons/statswidget';
import { LegalQuestion } from '@/app/commons/legal-question/legal-question';

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget, LegalQuestion],
    templateUrl: './dashboard.html'
})
export class Dashboard {}
