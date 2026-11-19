import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { founderGuard } from './auth.guard';

describe('founderGuard', () => {
    const isFounder = signal(false);

    function run(): boolean | UrlTree {
        return TestBed.runInInjectionContext(() => founderGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as boolean | UrlTree;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { isFounder } }] });
    });

    it('lets a founder in', () => {
        isFounder.set(true);
        expect(run()).toBeTrue();
    });

    it('sends an employee back to "Ma journée"', () => {
        isFounder.set(false);
        const result = run();
        expect(result instanceof UrlTree).toBeTrue();
        expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
    });
});
