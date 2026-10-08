import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComparaisonActif } from './comparaison-actif';

describe('ComparaisonActif', () => {
    let component: ComparaisonActif;
    let fixture: ComponentFixture<ComparaisonActif>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ComparaisonActif]
        }).compileComponents();

        fixture = TestBed.createComponent(ComparaisonActif);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
