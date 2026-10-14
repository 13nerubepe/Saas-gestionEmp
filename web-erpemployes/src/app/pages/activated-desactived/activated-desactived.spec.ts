import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivatedDesactived } from './activated-desactived';

describe('ActivatedDesactived', () => {
    let component: ActivatedDesactived;
    let fixture: ComponentFixture<ActivatedDesactived>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ActivatedDesactived]
        }).compileComponents();

        fixture = TestBed.createComponent(ActivatedDesactived);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
