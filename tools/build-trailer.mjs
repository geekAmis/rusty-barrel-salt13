import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'tools', 'trailer-frames');
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json'), 'utf8'));

const scenes = meta.ranges;
const selected = [];
const sceneDur = [];
for (const sc of scenes) {
  const idx = [];
  for (let i = 0; i < meta.times.length; i++) {
    const t = meta.times[i];
    if (t >= sc.keepStart && t <= sc.keepEnd) idx.push(i);
  }
  if (!idx.length) { console.log('WARN empty scene', sc.name); sceneDur.push(0); continue; }
  let dur = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const next = idx[k + 1];
    let d = next != null ? (meta.times[next] - meta.times[i]) / 1000 : 0.04;
    d = Math.max(0.008, Math.min(0.12, d));
    selected.push({ file: 'f' + String(i).padStart(4, '0') + '.jpg', duration: d });
    dur += d;
  }
  sceneDur.push(dur);
}

const total = sceneDur.reduce((a, b) => a + b, 0);
console.log('selected frames', selected.length, 'video duration', total.toFixed(2), 's');
for (let i = 0; i < scenes.length; i++) console.log(' ', scenes[i].name, sceneDur[i].toFixed(2));

const list = selected.map((f) => `file '${f.file}'\nduration ${f.duration.toFixed(4)}`).join('\n') + `\nfile '${selected[selected.length - 1].file}'\n`;
fs.writeFileSync(path.join(DIR, 'list.txt'), list);

const jokes = {
  menu: [
    [0.00, 0.42, 'Остров Крутой, 1994. Интернет ещё не придумал, чем вас напугать.'],
    [0.42, 1.00, 'Смена не заканчивается. Как «Твин Пикс» на кассете.']
  ],
  game: [
    [0.00, 0.33, 'Тарков учил не бежать. Но соль не ждёт.'],
    [0.33, 0.66, 'Ведьмак брал монеты. Я беру талоны.'],
    [0.66, 1.00, 'Один стик, чтобы править всеми.']
  ],
  inventory: [
    [0.00, 0.50, 'Рюкзак меньше, чем в Таркове. Соли — больше.'],
    [0.50, 1.00, '9×18: 3 + 32 = 35. Математика выживания.']
  ],
  trade: [
    [0.00, 0.50, '«Купить» — единственная кнопка, которая работает без соли.'],
    [0.50, 1.00, 'У Зои не наливают. Зато продают соль оптом.']
  ],
  dialog: [
    [0.00, 0.50, 'Сталкер говорил: «Хорошие сапоги». Зоя говорит: «Покажи наряд».'],
    [0.50, 1.00, 'В Зоне не врут. Врут в отчёте по форме 13.']
  ],
  cutscene: [
    [0.00, 0.50, 'Лента мокрая. Как сюжет «Соляриса», только дешевле.'],
    [0.50, 1.00, 'Акт 2. Дальше — как в «Сталкере», только с канцелярией.']
  ],
  stash: [
    [0.00, 0.50, 'Отмычка — это не магия. Это допуск к чужим тайнам.'],
    [0.50, 1.00, 'Взломал сейф. Внутри — соль. Кто бы сомневался.']
  ],
  boss: [
    [0.00, 0.38, 'Терминатор сказал: «Я вернусь». Босс сказал: «Я уже здесь».'],
    [0.38, 0.74, 'В космосе никто не услышит, как ты открываешь банку соли.'],
    [0.74, 1.00, 'Никто не ожидает испанскую инквизицию. Особенно наряд 13.']
  ],
  map: [
    [0.00, 0.50, 'Здесь водятся солевики. И пара сюжетных дыр.'],
    [0.50, 1.00, 'Карта врёт. Туман — нет.']
  ],
  ending: [
    [0.00, 1.00, 'Морфеус предложил красную таблетку. Я выбрал солёную.']
  ]
};

const assTime = (t) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Joke,Consolas,24,&H00E8D8B0,&H00FFFFFF,&H00000000,&HCC0A0A08,0,0,0,0,100,100,0.4,0,3,7,0,2,70,70,16,204

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

let offset = 0;
for (let i = 0; i < scenes.length; i++) {
  const sc = scenes[i];
  const dur = sceneDur[i];
  for (const [a, b, text] of (jokes[sc.name] || [])) {
    const t0 = offset + a * dur;
    const t1 = offset + b * dur;
    ass += `Dialogue: 0,${assTime(t0)},${assTime(t1)},Joke,,0,0,0,,${text}\n`;
  }
  offset += dur;
}
fs.writeFileSync(path.join(ROOT, 'tools', 'trailer.ass'), ass, 'utf8');

const out = path.join(ROOT, 'docs', 'rusty-barrel-trailer.webm');
const mp4 = path.join(ROOT, 'docs', 'rusty-barrel-trailer.mp4');
const drone = `aevalsrc='0.24*sin(2*PI*55*t)*(0.62+0.38*sin(2*PI*0.125*t))+0.08*sin(2*PI*110*t)+0.025*sin(2*PI*220*t)':s=48000:d=${total.toFixed(2)}`;

const vf = `fps=30,scale=1280:720:flags=lanczos,subtitles=f=trailer.ass,noise=alls=2:allf=t+u,vignette=PI/6`;
const r = spawnSync(path.join(ROOT, 'tools', 'ffmpeg.exe'), [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
  '-f', 'concat', '-safe', '0', '-i', 'trailer-frames/list.txt',
  '-f', 'lavfi', '-i', drone,
  '-f', 'lavfi', '-i', `anoisesrc=color=brown:sample_rate=48000:amplitude=0.05:duration=${total.toFixed(2)}`,
  '-filter_complex', `[0:v]${vf}[v];[1:a][2:a]amix=inputs=2:duration=longest,lowpass=f=800,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, total - 3).toFixed(2)}:d=2.8,volume=3.2[a]`,
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2', '-tile-columns', '2',
  '-c:a', 'libopus', '-b:a', '96k',
  '-pix_fmt', 'yuv420p', '-shortest', out
], { cwd: path.join(ROOT, 'tools'), stdio: 'inherit' });

if (r.status !== 0) { console.error('ffmpeg failed', r.status); process.exit(1); }
console.log('OK', out, (fs.statSync(out).size / 1048576).toFixed(2), 'MB');

// H.264 fallback for phones/players without VP9
const r2 = spawnSync(path.join(ROOT, 'tools', 'ffmpeg.exe'), [
  '-y', '-hide_banner', '-loglevel', 'warning',
  '-i', out,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4
], { cwd: path.join(ROOT, 'tools'), stdio: 'inherit' });
if (r2.status === 0) console.log('OK', mp4, (fs.statSync(mp4).size / 1048576).toFixed(2), 'MB');
