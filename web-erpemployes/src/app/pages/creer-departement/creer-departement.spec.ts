import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreerDepartement } from './creer-departement';

describe('CreerDepartement', () => {
  let component: CreerDepartement;
  let fixture: ComponentFixture<CreerDepartement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreerDepartement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreerDepartement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
