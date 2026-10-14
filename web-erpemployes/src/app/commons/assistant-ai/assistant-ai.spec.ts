import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssistantAi } from './assistant-ai';

describe('AssistantAi', () => {
    let component: AssistantAi;
    let fixture: ComponentFixture<AssistantAi>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AssistantAi]
        }).compileComponents();

        fixture = TestBed.createComponent(AssistantAi);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
