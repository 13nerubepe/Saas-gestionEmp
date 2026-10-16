import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateUserEntreprise } from './create-user-entreprise';

describe('CreateUserEntreprise', () => {
    let component: CreateUserEntreprise;
    let fixture: ComponentFixture<CreateUserEntreprise>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CreateUserEntreprise]
        }).compileComponents();

        fixture = TestBed.createComponent(CreateUserEntreprise);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
