import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatedUser } from './created-user';

describe('CreatedUser', () => {
    let component: CreatedUser;
    let fixture: ComponentFixture<CreatedUser>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CreatedUser]
        }).compileComponents();

        fixture = TestBed.createComponent(CreatedUser);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
