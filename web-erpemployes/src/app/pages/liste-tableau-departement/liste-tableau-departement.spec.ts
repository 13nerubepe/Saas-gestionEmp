import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListeTableauDepartement } from './liste-tableau-departement';

describe('ListeTableauDepartement', () => {
    let component: ListeTableauDepartement;
    let fixture: ComponentFixture<ListeTableauDepartement>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ListeTableauDepartement]
        }).compileComponents();

        fixture = TestBed.createComponent(ListeTableauDepartement);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
