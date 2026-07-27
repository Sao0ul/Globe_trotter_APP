// src/test/unit/moyenne.test.js
function calculerMoyenne(notes) {
    if (notes.length === 0) return 0;
    return notes.reduce((a, b) => a + b, 0) / notes.length;
}

describe('calculerMoyenne', () => {
    it('renvoie 0 pour un tableau vide', () => {
        expect(calculerMoyenne([])).toBe(0);
    });

    it('calcule correctement la moyenne', () => {
        expect(calculerMoyenne([4, 5, 3])).toBeCloseTo(4);
    });
});