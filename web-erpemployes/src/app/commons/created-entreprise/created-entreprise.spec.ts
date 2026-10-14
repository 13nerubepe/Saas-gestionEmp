import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatedEntreprise } from './created-entreprise';

describe('CreatedEntreprise', () => {
    let component: CreatedEntreprise;
    let fixture: ComponentFixture<CreatedEntreprise>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CreatedEntreprise]
        }).compileComponents();

        fixture = TestBed.createComponent(CreatedEntreprise);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
