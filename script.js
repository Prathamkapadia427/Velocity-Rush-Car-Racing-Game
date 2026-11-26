const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const speedEl = document.getElementById('speed');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const panelTitle = document.getElementById('panelTitle');
const panelText = document.getElementById('panelText');
const panelEyebrow = document.getElementById('panelEyebrow');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const pauseTag = document.getElementById('pauseTag');

const W = canvas.width, H = canvas.height;
const road = { x: 74, width: 332, lanes: 3 };
const laneWidth = road.width / road.lanes;
const player = { lane: 1, x: 0, y: 585, w: 48, h: 88, color: '#35d8ff' };
let traffic = [], particles = [], gameState = 'menu';
let score = 0, best = Number(localStorage.getItem('velocityRushBest') || 0);
let level = 1, speed = 5, roadOffset = 0, spawnTimer = 0, lastTime = 0;
let boostTime = 0, soundOn = true, audioContext = null;
let keys = { left:false, right:false, boost:false };

bestEl.textContent = formatScore(best);
player.x = laneCenter(player.lane) - player.w / 2;

function formatScore(n) { return String(Math.floor(n)).padStart(6, '0'); }
function laneCenter(lane) { return road.x + laneWidth * (lane + 0.5); }
function roundedRect(x,y,w,h,r,fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
}
function drawCar(x,y,w,h,color,isPlayer=false) {
  // soft shadow
  ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(x+w/2,y+h-3,w*.62,9,0,0,Math.PI*2); ctx.fill();
  roundedRect(x-5,y+14,8,22,3,'#111820');
  roundedRect(x+w-3,y+14,8,22,3,'#111820');
  roundedRect(x-5,y+h-34,8,22,3,'#111820');
  roundedRect(x+w-3,y+h-34,8,22,3,'#111820');
  roundedRect(x,y,w,h,12,color);
  roundedRect(x+7,y+13,w-14,24,7,isPlayer?'#b8f5ff':'#c4d4e4');
  roundedRect(x+8,y+43,w-16,25,6,isPlayer?'#16718e':'#26394d');
  roundedRect(x+6,y+4,10,5,2,'#fff4b0');
  roundedRect(x+w-16,y+4,10,5,2,'#fff4b0');
  roundedRect(x+6,y+h-9,10,5,2,'#ff526a');
  roundedRect(x+w-16,y+h-9,10,5,2,'#ff526a');
  if (isPlayer) {
    ctx.fillStyle='#eaffff'; ctx.fillRect(x+w/2-2,y+5,4,h-10);
  }
}
function drawRoad(dt) {
  ctx.fillStyle = '#183b31'; ctx.fillRect(0,0,W,H);
  // roadside strips and markers
  for (let y=-40+(roadOffset%80); y<H; y+=80) {
    ctx.fillStyle='#d6d9d4'; ctx.fillRect(road.x-12,y,7,40);
    ctx.fillStyle='#e65c54'; ctx.fillRect(road.x-12,y+40,7,40);
    ctx.fillStyle='#d6d9d4'; ctx.fillRect(road.x+road.width+5,y,7,40);
    ctx.fillStyle='#e65c54'; ctx.fillRect(road.x+road.width+5,y+40,7,40);
  }
  ctx.fillStyle='#303943'; ctx.fillRect(road.x,0,road.width,H);
  ctx.fillStyle='#f4f1d8'; ctx.fillRect(road.x+3,0,4,H);
  ctx.fillRect(road.x+road.width-7,0,4,H);
  for (let i=1;i<road.lanes;i++) {
    const x=road.x+i*laneWidth-2;
    for (let y=-70+(roadOffset%90);y<H;y+=90) {
      roundedRect(x,y,4,48,2,'#aab4b5');
    }
  }
  // subtle road texture
  ctx.fillStyle='#ffffff08';
  for(let i=0;i<16;i++) ctx.fillRect(road.x+12+i*20,0,1,H);
}
function spawnTraffic() {
  const lane = Math.floor(Math.random()*3);
  const colors = ['#ff5364','#ffb347','#a78bfa','#f2f4f8','#55d69e'];
  const car = { lane, x:laneCenter(lane)-22, y:-110, w:44, h:82, color:colors[Math.floor(Math.random()*colors.length)], extra:Math.random()*1.2 };
  // Avoid spawning directly beside an existing car at the same height.
  if (!traffic.some(t => t.lane===lane && t.y < 130)) traffic.push(car);
}
function drawBackground(dt) {
  drawRoad(dt);
  // distant trees / bushes
  for(let y=-25+(roadOffset%120);y<H;y+=120) {
    roundedRect(22,y,27,35,10,'#24533e');
    roundedRect(430,y+45,28,36,10,'#24533e');
    ctx.fillStyle='#39704d';ctx.beginPath();ctx.arc(35,y+8,12,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(443,y+53,13,0,Math.PI*2);ctx.fill();
  }
}
function drawParticles() {
  particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/35);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);});
  ctx.globalAlpha=1;
}
function addCrashParticles() {
  for(let i=0;i<38;i++) particles.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:(Math.random()-.5)*9,vy:(Math.random()-.5)*9,life:35,color:Math.random()>.5?'#ffb454':'#55e7ff'});
}
function playBeep(freq=440,duration=.08) {
  if(!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc=audioContext.createOscillator(), gain=audioContext.createGain();
    osc.frequency.value=freq; osc.type='sine'; gain.gain.value=.045;
    osc.connect(gain);gain.connect(audioContext.destination);osc.start();gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);osc.stop(audioContext.currentTime+duration);
  } catch(e) { /* Sound is optional if browser audio is unavailable. */ }
}
function collides(a,b) {
  const pad=10;
  return a.x+pad < b.x+b.w-pad && a.x+a.w-pad > b.x+pad && a.y+pad < b.y+b.h-pad && a.y+a.h-pad > b.y+pad;
}
function update(dt) {
  if(gameState!=='playing') return;
  const factor=dt/16.67;
  level=1+Math.floor(score/500);
  speed=Math.min(15,5+(level-1)*.8);
  const boosting=keys.boost && boostTime<=0;
  if(boosting) boostTime=80;
  if(boostTime>0) boostTime-=factor;
  const actualSpeed=speed+(boostTime>0?4:0);
  roadOffset=(roadOffset+actualSpeed*factor*2.2)%90;
  score+=actualSpeed*factor*.12;
  scoreEl.textContent=formatScore(score);
  speedEl.textContent=Math.round(actualSpeed*18);
  levelEl.textContent=level;
  if(keys.left) { player.lane=Math.max(0,player.lane-1);keys.left=false;playBeep(330,.04); }
  if(keys.right) { player.lane=Math.min(2,player.lane+1);keys.right=false;playBeep(390,.04); }
  const targetX=laneCenter(player.lane)-player.w/2;
  player.x+=(targetX-player.x)*Math.min(1,.24*factor);
  spawnTimer+=dt;
  const spawnEvery=Math.max(430,1050-(level-1)*65);
  if(spawnTimer>spawnEvery){spawnTraffic();spawnTimer=0;}
  traffic.forEach(t=>t.y+=(actualSpeed+t.extra)*factor*2.05);
  traffic=traffic.filter(t=>t.y<H+120);
  for(const car of traffic) {
    if(collides(player,car)){ endGame(); return; }
  }
  particles.forEach(p=>{p.x+=p.vx*factor;p.y+=p.vy*factor;p.life-=factor;});
  particles=particles.filter(p=>p.life>0);
}
function render(dt) {
  drawBackground(dt);
  traffic.forEach(t=>drawCar(t.x,t.y,t.w,t.h,t.color));
  if(gameState!=='crashed') drawCar(player.x,player.y,player.w,player.h,player.color,true);
  drawParticles();
  if(boostTime>0 && gameState==='playing') {
    ctx.strokeStyle='#ffb454';ctx.lineWidth=4;ctx.globalAlpha=.7;
    ctx.beginPath();ctx.moveTo(player.x+10,player.y+player.h);ctx.lineTo(player.x+10,player.y+player.h+22);ctx.moveTo(player.x+player.w-10,player.y+player.h);ctx.lineTo(player.x+player.w-10,player.y+player.h+22);ctx.stroke();ctx.globalAlpha=1;
  }
}
function loop(timestamp) {
  const dt=Math.min(40,timestamp-(lastTime||timestamp));lastTime=timestamp;
  update(dt);render(dt);
  requestAnimationFrame(loop);
}
function showPanel(mode) {
  overlay.classList.remove('hidden');
  if(mode==='menu') {
    panelEyebrow.textContent='READY TO RACE?';panelTitle.textContent='VELOCITY RUSH';
    panelText.textContent='Dodge traffic, collect points and beat your best score.';
    startBtn.textContent='START RACE';
  } else if(mode==='over') {
    panelEyebrow.textContent='RACE FINISHED';panelTitle.textContent='CRASHED!';
    panelText.textContent=`Your score: ${formatScore(score)} · Level ${level}. Can you beat it?`;
    startBtn.textContent='RACE AGAIN';
  } else {
    panelEyebrow.textContent='TAKE A BREATHER';panelTitle.textContent='PAUSED';
    panelText.textContent='Your race is paused. Ready to get back on the road?';
    startBtn.textContent='RESUME RACE';
  }
}
function startGame() {
  if(gameState==='paused'){gameState='playing';overlay.classList.add('hidden');pauseTag.classList.remove('show');pauseBtn.textContent='Ⅱ PAUSE';return;}
  score=0;level=1;speed=5;traffic=[];particles=[];spawnTimer=0;boostTime=0;
  player.lane=1;player.x=laneCenter(1)-player.w/2;
  scoreEl.textContent='000000';speedEl.textContent='0';levelEl.textContent='1';
  gameState='playing';overlay.classList.add('hidden');pauseTag.classList.remove('show');pauseBtn.textContent='Ⅱ PAUSE';
  playBeep(520,.12);
}
function endGame() {
  gameState='over';addCrashParticles();playBeep(110,.35);
  if(score>best){best=Math.floor(score);localStorage.setItem('velocityRushBest',best);bestEl.textContent=formatScore(best);}
  showPanel('over');pauseBtn.textContent='Ⅱ PAUSE';
}
function togglePause() {
  if(gameState==='playing'){gameState='paused';showPanel('pause');pauseTag.classList.add('show');pauseBtn.textContent='▶ RESUME';}
  else if(gameState==='paused') startGame();
}
startBtn.addEventListener('click',startGame);
pauseBtn.addEventListener('click',togglePause);
document.getElementById('soundBtn').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?'🔊':'🔇';});
document.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight',' ','ArrowUp'].includes(e.key)) e.preventDefault();
  if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a') keys.left=true;
  if(e.key==='ArrowRight'||e.key.toLowerCase()==='d') keys.right=true;
  if(e.key==='ArrowUp'||e.key===' ') keys.boost=true;
  if(e.key.toLowerCase()==='p') togglePause();
});
document.addEventListener('keyup',e=>{if(e.key==='ArrowUp'||e.key===' ')keys.boost=false;});
function bindTap(id,action) {
  const el=document.getElementById(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();action(true);});
  el.addEventListener('pointerup',e=>{e.preventDefault();action(false);});
  el.addEventListener('pointerleave',()=>action(false));
  el.addEventListener('pointercancel',()=>action(false));
}
bindTap('leftBtn',v=>{if(v)keys.left=true;});
bindTap('rightBtn',v=>{if(v)keys.right=true;});
bindTap('boostBtn',v=>keys.boost=v);
showPanel('menu');
requestAnimationFrame(loop);
