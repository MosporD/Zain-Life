// Nutrition label parsing (www/labelscan.js). Run: node test/labelscan.test.js
const assert = require('assert');
const { parse, rows } = require('../www/labelscan.js');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.6, msg + ': ' + a + ' vs ' + b);
// Helper: a table as OCR lines with boxes, each cell a separate line (as ML Kit often returns columns).
function table(r, colX = [20, 300, 480]) {
  const out = [];
  r.forEach((cells, i) => cells.forEach((t, j) => { if (t) out.push({ t, x: colX[j], y: 100 + i * 40 + (j % 2) * 3, w: 120, h: 24 }); }));
  return out.sort(() => Math.random() - 0.5);   // ML Kit's order is not reliable; rows() must fix it
}

// 1. Crisps, EU style: per 100 g and per 30 g serving, energy as kJ/kcal, "of which" rows, comma decimals.
let r = parse(table([
  ['Nutrition Information', 'Per 100g', 'Per serving (30g)'],
  ['Energy', '2250kJ / 539kcal', '675kJ / 162kcal'],
  ['Fat', '34g', '10.2g'],
  ['of which saturates', '3,1g', '0.9g'],
  ['Carbohydrate', '52g', '15.6g'],
  ['of which sugars', '0,6g', '0.2g'],
  ['Fibre', '4.2g', '1.3g'],
  ['Protein', '6,5g', '2g'],
  ['Salt', '1.3g', '0.4g']
]));
near(r.per100.kcal, 539, 'crisps kcal/100'); near(r.per100.f, 34, 'fat/100'); near(r.per100.c, 52, 'carbs/100'); near(r.per100.p, 6.5, 'protein/100');
near(r.serving.kcal, 162, 'crisps kcal/serving'); near(r.serving.f, 10.2, 'fat/serving'); near(r.serving.p, 2, 'protein/serving');
assert.strictEqual(r.servingG, 30);

// 2. US Nutrition Facts, one column per serving, %DV ignored, "Og" for 0g.
r = parse(['Nutrition Facts', 'Serving size 1 oz (28g)', 'Calories 160', 'Total Fat 10g 13%', 'Saturated Fat 1.5g 8%', 'Trans Fat Og',
  'Cholesterol 0mg 0%', 'Sodium 170mg 7%', 'Total Carbohydrate 15g 5%', 'Dietary Fiber 1g 4%', 'Total Sugars 1g', 'Protein 2g']);
assert.strictEqual(r.per100, null);
near(r.serving.kcal, 160, 'US kcal'); near(r.serving.f, 10, 'US fat'); near(r.serving.c, 15, 'US carbs'); near(r.serving.p, 2, 'US protein');
assert.strictEqual(r.servingG, 28);

// 3. Per 100 g only, energy only in kJ, plus a stated serving size: kcal from kJ, serving worked out.
r = parse(table([
  ['Typical values', 'per 100 g'],
  ['Energy', '1600 kJ'],
  ['Fat', '12 g'],
  ['Carbohydrate', '50 g'],
  ['Protein', '8 g'],
  ['A bag contains 2 servings of 25g', '']
]));
near(r.per100.kcal, 382.4, 'kJ→kcal'); near(r.serving.kcal, 95.6, 'serving from per100'); assert.strictEqual(r.servingG, 25);

// 4. Columns reversed (serving first), energy split over kJ and kcal rows.
r = parse(table([
  ['', 'Per portion 40g', 'Per 100g'],
  ['Energy kJ', '800', '2000'],
  ['Energy kcal', '191', '478'],
  ['Fat', '9', '22.5'],
  ['Carbohydrates', '24', '60'],
  ['Proteins', '3', '7.5']
]));
near(r.per100.kcal, 478, 'reversed kcal/100'); near(r.serving.kcal, 191, 'reversed kcal/serving'); near(r.serving.p, 3, 'reversed protein');

// 5. Not a label.
assert.strictEqual(parse(['Best before 12/2027', 'Made in Jordan']), null);
assert.strictEqual(parse([]), null);

// rows(): cells on one line come back left to right.
assert.deepStrictEqual(rows([{ t: '6g', x: 300, y: 101, w: 40, h: 20 }, { t: 'Protein', x: 10, y: 99, w: 80, h: 20 }]), ['Protein | 6g']);
console.log('labelscan: all passed');
