const test=require('node:test');
const assert=require('node:assert/strict');
const {dailySlots,normalizeState,totalsInDay,activeElapsed,dayStart}=require('../app.js');
const find=(rows,title)=>rows.find(x=>x[2]===title);
test('HAFS official weekday schedule varies by grade',()=>{
  for(const [grade,wake,breakfast,lunch,dinner,finish] of [
    ['1','07:00','08:10','13:25','18:20','23:00'],
    ['2','07:00','07:50','13:10','18:00','23:00'],
    ['3','06:40','07:30','12:55','17:40','23:20']
  ]){
    const rows=dailySlots(grade,1);
    assert.equal(find(rows,'기상')[0],wake);
    assert.equal(find(rows,'조식')[0],breakfast);
    assert.equal(find(rows,'중식')[0],lunch);
    assert.equal(find(rows,'석식')[0],dinner);
    assert.equal(rows.find(x=>x[2].startsWith('자기주도학습 (후반부)'))[1],finish);
  }
});
test('8th period Monday vs Tuesday',()=>{
  assert.equal(find(dailySlots('1',1),'8교시')[0],'17:00');
  assert.equal(find(dailySlots('1',2),'8교시')[0],'16:50');
});
test('first-run setup is required and timetable profiles are independent',()=>{
  assert.equal(normalizeState(null).profile,null);
  const one=Array.from({length:5},()=>Array(8).fill(''));one[0][0]='문학';
  const s=normalizeState({version:2,profile:{grade:'2',track:'humanities'},timetables:{'2:humanities':one}});
  assert.equal(s.timetables['2:humanities'][0][0],'문학');
  assert.equal(s.timetables['2:natural'],undefined);
});
test('user supplied subjects shown without invented subjects',()=>{
  const row=Array(8).fill('');row[0]='물리';
  assert.equal(find(dailySlots('3',1,row),'물리')[0],'09:05');
  assert.ok(find(dailySlots('3',1),'1교시'));
});
test('pause is not counted in study time',()=>{
  assert.equal(activeElapsed({startedAt:0,intervals:[[0,1500]],segmentStart:5000},6500),3000);
});
test('sessions split correctly between Korean calendar days',()=>{
  const start=Date.UTC(2026,9,29)-9*3600000;
  const s=[{subject:'수학',startedAt:start-1000,endedAt:start+1500,intervals:[[start-1000,start+1500]]}];
  assert.equal(totalsInDay(s,null,start).수학,1500);
  assert.equal(totalsInDay(s,null,start-86400000).수학,1000);
  assert.equal(dayStart(start+5000),start);
});
test('weekend has no fabricated classes',()=>{
  assert.equal(dailySlots('1',6).filter(x=>x[3]==='class').length,0);
});
