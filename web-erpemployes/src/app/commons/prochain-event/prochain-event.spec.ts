import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProchainEvent } from './prochain-event';

describe('ProchainEvent', () => {
    let component: ProchainEvent;
    let fixture: ComponentFixture<ProchainEvent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ProchainEvent]
        }).compileComponents();

        fixture = TestBed.createComponent(ProchainEvent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
