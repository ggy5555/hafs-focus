const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 820, height: 1180 },
      { width: 1440, height: 900 }
    ]) {
      const context = await browser.newContext({ viewport, acceptDownloads: true, serviceWorkers: 'allow' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });

      assert.equal(await page.locator('#setup-overlay').isVisible(), true, 'first-run setup is visible');
      await page.locator('#setup-form button[type=submit]').click();
      assert.equal(await page.locator('#setup-overlay').isHidden(), true, 'setup closes');

      // Subject management, stable reference, archive/restore.
      await page.locator('.nav-btn[data-tab=settings]').click();
      await page.locator('#new-subject-name').fill('물리학 실험');
      await page.locator('#subject-add-form button').click();
      let state = await page.evaluate(() => JSON.parse(localStorage.getItem('hafs-focus-v2')));
      const custom = state.subjects.find(s => s.name === '물리학 실험');
      assert.ok(custom && custom.id.startsWith('subject-'));
      await page.locator('.subject-row').filter({ hasText: '물리학 실험' }).getByText('이름 수정').click();
      await page.locator('.subject-rename-input').fill('실험물리');
      await page.locator('.subject-row').filter({ has: page.locator('.subject-rename-input') }).getByText('저장').click();

      // Running and paused timer must not mutate current subject or lose recorded intervals.
      await page.locator('.nav-btn[data-tab=timer]').click();
      assert.equal(await page.locator('#subject-select').inputValue(), custom.id);
      await page.locator('#timer-start').click();
      assert.equal(await page.locator('#timer-state').innerText(), 'FOCUSING');
      await page.waitForTimeout(1100);
      await page.locator('#timer-pause').click();
      assert.equal(await page.locator('#timer-state').innerText(), 'PAUSED');
      await page.locator('#timer-pause').click();
      assert.equal(await page.locator('#timer-state').innerText(), 'FOCUSING');
      await page.waitForTimeout(1100);
      await page.locator('#timer-finish').click();
      state = await page.evaluate(() => JSON.parse(localStorage.getItem('hafs-focus-v2')));
      assert.equal(state.sessions.length, 1);
      assert.equal(state.sessions[0].subject, custom.id);
      assert.ok(state.sessions[0].intervals.length >= 2);

      // Planner create, edit, and complete.
      await page.locator('.nav-btn[data-tab=planner]').click();
      await page.locator('#task-title').fill('과학 복습');
      await page.locator('#task-date').fill('2026-11-14');
      await page.locator('#task-form button').click();
      await page.locator('.task-edit').click();
      await page.locator('.task-inline-input').fill('과학 노트 복습');
      await page.locator('.task-actions').getByText('저장').click();
      assert.ok((await page.locator('.task-title').innerText()).includes('과학 노트'));
      await page.locator('.task input[type=checkbox]').check();

      // Monday timetable and profile isolation.
      await page.locator('.nav-btn[data-tab=schedule]').click();
      if (viewport.width <= 700) await page.locator('#timetable-day-switch .weekday-btn').first().click();
      const monday = page.getByRole('textbox', { name: '월요일 1교시 과목' });
      await monday.fill('문학');
      await page.locator('.nav-btn[data-tab=settings]').click();
      await page.locator('#settings-grade').selectOption('2');
      await page.locator('#profile-form button').click();
      await page.locator('.nav-btn[data-tab=schedule]').click();
      assert.equal(await monday.inputValue(), '');
      await page.locator('.nav-btn[data-tab=settings]').click();
      await page.locator('#settings-grade').selectOption('1');
      await page.locator('#profile-form button').click();
      await page.locator('.nav-btn[data-tab=schedule]').click();
      assert.equal(await monday.inputValue(), '문학');

      // Existing JSON backup envelope and subject extension.
      await page.locator('.nav-btn[data-tab=settings]').click();
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#backup-export').click();
      const download = await downloadPromise;
      const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
      assert.equal(backup.version, 2);
      assert.ok(backup.data.subjects.some(s => s.id === custom.id));
      assert.ok(backup.data.sessions.some(s => s.subject === custom.id));

      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('#setup-overlay').isHidden(), true);
      assert.equal(await page.locator('.nav-btn.selected').count(), 1);
      const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
      assert.ok(overflow.sw <= overflow.vw + 2, 'no horizontal overflow: ' + JSON.stringify({ viewport, overflow }));
      assert.deepEqual(errors, [], 'no runtime errors');

      // Offline navigation: existing static PWA shell must remain usable.
      await page.evaluate(() => navigator.serviceWorker.ready);
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.ok(await page.locator('#home').count(), 'offline app shell');
      await context.close();
      process.stdout.write('Browser smoke passed: ' + viewport.width + 'px\\n');
    }
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
