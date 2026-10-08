import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Actualites } from './actualites';

describe('Actualites', () => {
    let component: Actualites;
    let fixture: ComponentFixture<Actualites>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Actualites]
        }).compileComponents();

        fixture = TestBed.createComponent(Actualites);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
