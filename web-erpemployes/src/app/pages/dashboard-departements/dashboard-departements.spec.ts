import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardDepartements } from './dashboard-departements';

describe('DashboardDepartements', () => {
  let component: DashboardDepartements;
  let fixture: ComponentFixture<DashboardDepartements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardDepartements]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardDepartements);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
