import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagesPermissions } from './pages-permissions';

describe('PagesPermissions', () => {
    let component: PagesPermissions;
    let fixture: ComponentFixture<PagesPermissions>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PagesPermissions]
        }).compileComponents();

        fixture = TestBed.createComponent(PagesPermissions);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
