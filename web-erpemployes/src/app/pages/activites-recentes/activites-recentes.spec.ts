import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivitesRecentes } from './activites-recentes';

describe('ActivitesRecentes', () => {
    let component: ActivitesRecentes;
    let fixture: ComponentFixture<ActivitesRecentes>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ActivitesRecentes]
        }).compileComponents();

        fixture = TestBed.createComponent(ActivitesRecentes);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
