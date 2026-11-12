const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeState, totalsInDay, activeElapsed } = require('../app.js');

test('old version 2 data imports with default subjects without losing study sessions', () => {
  const startedAt = Date.now() - 60000;
  const raw = { version: 2, profile: { grade: '1', track: 'natural' }, selectedSubject: '수학',
    sessions: [{ subject: '수학', type: '자습', startedAt, endedAt: startedAt + 10000,
      intervals: [[startedAt, startedAt + 10000]] }] };
  const saved = normalizeState(raw);
  assert.equal(saved.sessions.length, 1);
  assert.equal(saved.sessions[0].subject, '수학');
  assert.ok(saved.subjects.some(x => x.id === '수학' && x.name === '수학'));
});

test('renamed subject keeps stable ID and existing study totals', () => {
  const start = Date.now() - 120000;
  const raw = { version: 2, subjects: [
    { id: '수학', name: '미적분', archived: false },
    { id: 'new-physics', name: '물리학', archived: false }
  ], selectedSubject: 'new-physics',
    sessions: [
      { subject: '수학', startedAt: start, endedAt: start + 60000, intervals: [[start, start + 60000]] },
      { subject: 'new-physics', startedAt: start + 60000, endedAt: start + 90000,
        intervals: [[start + 60000, start + 90000]] }
    ] };
  const state = normalizeState(raw);
  const totals = totalsInDay(state.sessions, null, start - 1, Date.now(), state.subjects);
  assert.equal(state.subjects[0].name, '미적분');
  assert.equal(totals['수학'], 60000);
  assert.equal(totals['new-physics'], 30000);
  assert.equal(state.selectedSubject, 'new-physics');
});

test('archiving a subject does not discard its study sessions', () => {
  const start = Date.now() - 50000;
  const state = normalizeState({ version: 2,
    subjects: [{ id: '국어', name: '국어', archived: true }, { id: '과학', name: '과학', archived: false }],
    selectedSubject: '국어', sessions: [{ subject: '국어', startedAt: start, endedAt: start + 20000 }] });
  assert.equal(state.sessions.length, 1);
  assert.equal(state.selectedSubject, '과학');
  assert.equal(state.subjects.find(x => x.id === '국어').archived, true);
});

test('unknown historical subject is preserved as archived instead of deleted', () => {
  const start = Date.now() - 50000;
  const state = normalizeState({ version: 2, sessions: [{ subject: '옛 과목', startedAt: start, endedAt: start + 10000 }] });
  assert.equal(state.sessions.length, 1);
  assert.ok(state.subjects.some(x => x.id === '옛 과목' && x.archived));
});

test('legacy backup data survives optional subject catalog roundtrip', () => {
  const start = Date.now() - 30000;
  const old = { version: 2, selectedSubject: '영어',
    sessions: [{ subject: '영어', startedAt: start, endedAt: start + 20000 }],
    tasks: [{ id: 't1', title: '복습', due: '2026-11-13', done: false }] };
  const once = normalizeState(old);
  const twice = normalizeState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice.sessions, once.sessions);
  assert.deepEqual(twice.tasks, once.tasks);
  assert.deepEqual(twice.subjects, once.subjects);
});

test('active timer remains valid with custom subject after reload', () => {
  const start = Date.now() - 10000;
  const state = normalizeState({ version: 2,
    subjects: [{ id: 'custom-1', name: '생명과학', archived: false }],
    selectedSubject: 'custom-1',
    active: { subject: 'custom-1', type: '자습', startedAt: start, intervals: [], segmentStart: start } });
  assert.equal(state.active.subject, 'custom-1');
  assert.ok(activeElapsed(state.active, start + 5000) >= 5000);
});

test('duplicate subject names and IDs in imported backup are rejected', () => {
  const state = normalizeState({ version: 2, subjects: [
    { id: 'x', name: '화학', archived: false },
    { id: 'x', name: '생물', archived: false },
    { id: 'y', name: '화학', archived: false }
  ]});
  assert.equal(state.subjects.length, 1);
  assert.equal(state.subjects[0].name, '화학');
});
