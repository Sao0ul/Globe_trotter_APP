const {
    CATEGORY_FR_TO_EN,
    CATEGORY_EN_TO_FR,
    DIFFICULTY_FR_TO_EN,
    DIFFICULTY_EN_TO_FR,
    DANGER_FR_TO_EN,
    DANGER_EN_TO_FR,
} = require('../../controllers/sitesController');

describe('CATEGORY_FR_TO_EN / CATEGORY_EN_TO_FR', () => {
    it('convertit une valeur FR vers EN', () => {
        expect(CATEGORY_FR_TO_EN['aventure']).toBe('adventure');
        expect(CATEGORY_FR_TO_EN['nature']).toBe('nature');
    });

    it('convertit une valeur EN vers FR', () => {
        expect(CATEGORY_EN_TO_FR['adventure']).toBe('aventure');
    });

    it('renvoie undefined pour une valeur inconnue', () => {
        expect(CATEGORY_FR_TO_EN['inexistant']).toBeUndefined();
    });

    it('les deux tables sont bien symétriques (round-trip FR -> EN -> FR)', () => {
        Object.keys(CATEGORY_FR_TO_EN).forEach((fr) => {
            const en = CATEGORY_FR_TO_EN[fr];
            expect(CATEGORY_EN_TO_FR[en]).toBe(fr);
        });
    });
});

describe('DIFFICULTY_FR_TO_EN / DIFFICULTY_EN_TO_FR', () => {
    it('convertit une valeur FR vers EN', () => {
        expect(DIFFICULTY_FR_TO_EN['facile']).toBe('easy');
        expect(DIFFICULTY_FR_TO_EN['modere']).toBe('moderate');
        expect(DIFFICULTY_FR_TO_EN['difficile']).toBe('difficult');
    });

    it('convertit une valeur EN vers FR', () => {
        expect(DIFFICULTY_EN_TO_FR['easy']).toBe('facile');
    });

    it('les deux tables sont bien symétriques (round-trip FR -> EN -> FR)', () => {
        Object.keys(DIFFICULTY_FR_TO_EN).forEach((fr) => {
            const en = DIFFICULTY_FR_TO_EN[fr];
            expect(DIFFICULTY_EN_TO_FR[en]).toBe(fr);
        });
    });
});

describe('DANGER_FR_TO_EN / DANGER_EN_TO_FR', () => {
    it('convertit une valeur FR vers EN', () => {
        expect(DANGER_FR_TO_EN['faible']).toBe('low');
        expect(DANGER_FR_TO_EN['moderee']).toBe('moderate');
        expect(DANGER_FR_TO_EN['elevee']).toBe('high');
    });

    it('convertit une valeur EN vers FR', () => {
        expect(DANGER_EN_TO_FR['high']).toBe('elevee');
    });

    it('les deux tables sont bien symétriques (round-trip FR -> EN -> FR)', () => {
        Object.keys(DANGER_FR_TO_EN).forEach((fr) => {
            const en = DANGER_FR_TO_EN[fr];
            expect(DANGER_EN_TO_FR[en]).toBe(fr);
        });
    });
});