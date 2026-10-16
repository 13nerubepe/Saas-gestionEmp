import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestioUtilisateurs } from './gestio-utilisateurs';

describe('GestioUtilisateurs', () => {
    let component: GestioUtilisateurs;
    let fixture: ComponentFixture<GestioUtilisateurs>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GestioUtilisateurs]
        }).compileComponents();

        fixture = TestBed.createComponent(GestioUtilisateurs);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
