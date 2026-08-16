import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'ui/src/contexts/auditedUiTranslations.ts'), 'utf8');
const languages = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];
const requiredKeys = [
  'columns', 'showAllColumns', 'horizontalBarChart', 'areaChart', 'scatterChart',
  'radarChart', 'polarAreaChart', 'doughnutChart', 'chartViewTitle', 'chartFit', 'chartZoom',
  'copyChartImage', 'saveChartPng', 'closeChartView',
];

test('all audited renderer locales contain column, chart and chart viewer labels', () => {
  for (let index = 0; index < languages.length; index += 1) {
    const language = languages[index];
    const start = source.indexOf(`  ${language}: {`);
    assert.notEqual(start, -1, `${language} locale must exist`);
    const nextStarts = languages
      .slice(index + 1)
      .map((candidate) => source.indexOf(`  ${candidate}: {`, start + 1))
      .filter((position) => position >= 0);
    const end = nextStarts.length > 0 ? Math.min(...nextStarts) : source.length;
    const block = source.slice(start, end);
    for (const key of requiredKeys) {
      assert.match(block, new RegExp(`\\b${key}\\s*:`), `${language} is missing ${key}`);
    }
  }
});
