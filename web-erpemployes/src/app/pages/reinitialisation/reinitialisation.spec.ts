import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Reinitialisation } from './reinitialisation';

describe('Reinitialisation', () => {
    let component: Reinitialisation;
    let fixture: ComponentFixture<Reinitialisation>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Reinitialisation]
        }).compileComponents();

        fixture = TestBed.createComponent(Reinitialisation);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
