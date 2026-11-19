import { localDate, relativeDay } from './crm-labels';

describe('follow-up dates', () => {
    it('gives local yyyy-mm-dd dates relative to today', () => {
        const today = new Date();
        const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        expect(localDate(0)).toBe(expected);
        expect(localDate(1) > localDate(0)).toBeTrue();
    });

    it('labels today, tomorrow and late follow-ups, and leaves later dates alone', () => {
        expect(relativeDay(localDate(0))).toBe('Aujourd’hui');
        expect(relativeDay(localDate(1))).toBe('Demain');
        expect(relativeDay(localDate(-3))).toBe('En retard de 3 j');
        expect(relativeDay(localDate(5))).toBeNull();
    });
});
