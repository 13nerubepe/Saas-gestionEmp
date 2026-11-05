import { Component, computed, inject } from '@angular/core';
import { StatsWidget } from '@/app/commons/statswidget';
import { LegalQuestion } from '@/app/commons/legal-question/legal-question';
import { PageHeader } from '@/app/commons/page-header';
import { AuthService } from '@/app/core/auth/auth.service';

/** Country name in French from an ISO code (CM → Cameroun), with the browser's own data. */
const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' });

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget, LegalQuestion, PageHeader],
    templateUrl: './dashboard.html'
})
export class Dashboard {
    private readonly auth = inject(AuthService);

    readonly greeting = computed(() => {
        const firstName = this.auth.user()?.first_name;
        return firstName ? `Bonjour ${firstName}` : 'Bonjour';
    });

    /** "Awa Services SARL · Cameroun · Employé" */
    readonly companyLine = computed(() => {
        const membership = this.auth.activeMembership();
        if (!membership) return '';
        const parts = [membership.company_name, countryName(membership.country)];
        if (membership.role !== 'founder') parts.push('Employé');
        return parts.filter(Boolean).join(' · ');
    });
}

function countryName(code: string): string {
    try {
        return countryNames.of(code) ?? code;
    } catch {
        return code;
    }
}
