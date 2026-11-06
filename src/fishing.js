/* ═══════════════════════════════════════════════════════════════
 * src/fishing.js  v3.1 — 여수 낚시 항구 (F2 + F3 도감 확장 + F4 보트 낚시 통합 교체)
 * ※ 기존 fishing.js 를 이 파일로 통째로 바꾸세요. game.js 는 F2 때 고친 9곳 그대로 사용합니다.
 *   (createFishing 의 인자·반환값이 F2 와 같습니다: interactables / onWorld / mini / score)
 *
 *  v3.1 변경
 *   - 물고기 카드(놓아주기/가져가기)가 눌리지 않던 문제 수정 (모달을 낚시 조작 레이어 위로, 모달 중엔 조작 레이어 비활성)
 *   - 낚시 터 이름판 삭제 → 구역별 색 링만 표시
 *   - 배·섬·포털 이름판 축소 + 가까워지면 서서히 사라짐 (FADES)
 *   - 상단/하단 안내 글자 축소, 낚시 중·터치 기기에서 하단 'WASD 이동…' 줄 숨김
 *
 *  - 부두·갯바위·모래사장·안벽 낚시 터 16곳 (걸어서)
 *  - 낚싯배: 승선 → 지도에서 섬 선택 → 자동 항해(또는 수동 조타) → 닻 내리고 낚시
 *  - 여수 섬 11곳 (거리는 게임용으로 줄이고 위치는 단순화)
 *  - 어종 39종(물고기·오징어·문어·낙지·주꾸미·갈치·방어·가다랑어·참다랑어 …) + 도감
 *  - 금지체장·금어기는 해양수산부 「수산자원관리법 시행령」 별표 1·2 (2026.1.1 기준) 값
 *  - 현재 달(월)을 읽어 제철·금어기를 반영합니다. 시험용: 주소 뒤에 ?month=7
 *  - 디버그: 콘솔에서 __fish()
 * ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { engine } from './engine-sound.js';
import { createSeaFx, createSkyFx } from './seafx.js';
import { createShipKit } from './ships.js';


const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const lerpA = (a, b, k) => a + wrapA(b - a) * k;
const lerp = (a, b, k) => a + (b - a) * k;
const PI2 = Math.PI / 2;
const SEA_Y = -1.0;
const QM = parseInt(new URLSearchParams(location.search).get('month'), 10);
const MONTH = QM >= 1 && QM <= 12 ? QM : new Date().getMonth() + 1;
const inR = (m, a, b) => (a <= b ? m >= a && m <= b : m >= a || m <= b);
/* 낚시 난이도 (숫자만 바꿔서 조절) */
const DIFF = {
  wait: [2.5, 6.5],      // 입질까지 기다리는 시간(초)
  biteBase: 1.25,        // 챔질 제한시간 기본값(초). 클수록 쉬움
  biteMin: .55,          // 챔질 제한시간 최솟값(초)
  reel: 3.2,             // 감는 속도. 작을수록 오래 걸림
  rise: [18, 8],         // 누를 때 장력 상승: 기본 + 힘×계수. 클수록 어려움
  fall: 34,              // 손 뗄 때 장력 감소. 작을수록 어려움
  idlePull: .2,          // 손 떼면 물고기가 끌고 가는 거리. 클수록 어려움
  runPull: .7,           // 도망치는 구간에서 끌려가는 거리. 클수록 어려움
  slack: 2.2,            // 줄이 느슨한 채로 버틸 수 있는 시간(초). 작을수록 어려움
};


/* ───────── 어종 데이터 ─────────
 * R(id, 이름, 아이콘, 서식(쉼표), 출현가중치, 최소, 최대, 금지체장, 힘, 등급(1~4), 제철[[시작월,끝월]..], 금어기[시작월,끝월]|null, 단위, 특히 많은 섬(쉼표), 설명, 연계학과)
 * 단위 cm=전장 / an=항문장 / ma=외투장(몸통) / g=무게(g).  금지체장은 "이하"가 금지(법령 표현).
 * 금지체장·금어기는 별표 2·1 (2026.1.1) 기준. 금어기는 월 단위로 단순화했어요. */
const R = (id, n, ic, z, w, lo, hi, min, pw, r, pk, ban, u, at, fact, d) => ({ id, n, ic, z: z.split(','), w, lo, hi, min, pw, r, pk, ban, u, at: at ? at.split(',') : [], fact, d, poison: false });
const SP = [
  R('mang', '망둥어', '🐟', 'pier,quay,sand', 14, 8, 20, 0, .5, 1, [[5, 10]], null, 'cm', '', '갯벌과 방파제에 사는 작은 물고기예요. 가슴지느러미로 갯벌 위를 기어 다니기도 해요.', '양식생물학과'),
  R('bolrak', '볼락', '🐟', 'pier,rock,near,island', 14, 12, 30, 15, .7, 1, [[11, 3]], null, 'cm', '', '여수 바다낚시의 단골 어종이에요. 알이 아니라 새끼를 낳는 난태생이에요.', '스마트수산자원관리학과'),
  R('norae', '쥐노래미', '🐟', 'rock,pier,near', 10, 15, 42, 20, .9, 1, [[10, 3]], [11, 12], 'cm', '', '갯바위 틈에 숨어 사는 텃세 강한 물고기예요.', '양식생물학과'),
  R('hakgong', '학공치', '🐟', 'pier,quay', 9, 15, 38, 0, .6, 1, [[11, 4]], null, 'cm', '', '아래턱이 바늘처럼 길게 튀어나온 겨울 방파제 손님이에요.', '해양생산관리학과'),
  R('jeon', '전갱이', '🐟', 'pier,quay,near', 12, 12, 30, 0, .7, 1, [[6, 10]], null, 'cm', '', '떼를 지어 다니는 회유성 물고기예요. 옆줄을 따라 단단한 모비늘이 있어요.', '해양생산관리학과'),
  R('godeung', '고등어', '🐟', 'pier,quay,near,island', 9, 20, 42, 21, .9, 1, [[7, 11]], [4, 6], 'cm', '', '등에 물결무늬가 있고 쉬지 않고 헤엄치는 대표 대중 생선이에요. (어획량의 20% 미만은 예외 규정)', '해양바이오식품학과'),
  R('jeoneo', '전어', '🐟', 'quay,pier', 7, 15, 32, 0, .6, 1, [[9, 11]], [5, 7], 'cm', '', '가을이면 살이 오르는 인기 생선이에요.', '해양바이오식품학과'),
  R('sung', '숭어', '🐟', 'quay,pier,sand', 6, 25, 65, 0, 1.2, 2, [[10, 3]], null, 'cm', '', '물 위로 높이 뛰어오르는 습성이 있어요. 겨울 숭어가 맛있다고 해요.', '양식생물학과'),
  R('bori', '보리멸', '🐟', 'sand', 12, 12, 28, 0, .6, 1, [[5, 9]], null, 'cm', '', '모래 바닥에 사는 날씬한 물고기예요. 원투낚시에 자주 올라와요.', '해양융합과학과'),
  R('doda', '도다리(문치가자미)', '🐟', 'sand,near', 8, 20, 45, 20, .9, 2, [[3, 5]], [12, 1], 'cm', '', '두 눈이 몸 한쪽에 모여 있는 납작한 물고기예요. 봄 도다리쑥국이 유명해요.', '수산생명의학과'),
  R('seodae', '서대', '🐟', 'sand,near', 5, 20, 40, 0, .8, 2, [[4, 6]], null, 'cm', '', '바닥에 납작하게 붙어 사는 생선이에요. 여수의 서대회로 알려져 있어요.', '해양바이오식품학과'),
  R('bung', '붕장어', '🐟', 'sand,pier,near', 8, 35, 95, 35, 1, 2, [[6, 9]], null, 'cm', '', '뱀장어를 닮은 밤의 사냥꾼이에요. 아나고라고도 불러요.', '해양바이오식품학과'),
  R('gam', '감성돔', '🐟', 'pier,rock,near,island', 10, 20, 55, 25, 1.4, 3, [[3, 5], [10, 12]], [5, 5], 'cm', '', '갯바위 낚시의 대표 어종이에요. 자라면서 성이 바뀌는 특징이 있어요.', '스마트수산자원관리학과'),
  R('beng', '벵에돔', '🐟', 'rock,island', 7, 25, 55, 0, 1.5, 3, [[6, 9]], null, 'cm', 'geomun,baekdo,sonjuk', '거문도 같은 먼 섬 갯바위에서 인기 있는 대형 돔이에요.', '양식생물학과'),
  R('dol', '돌돔', '🐟', 'rock,island', 3, 25, 60, 24, 2, 4, [[6, 10]], null, 'cm', 'geomun,baekdo,sonjuk', '줄무늬가 선명하고 이빨이 단단해 조개도 부숴 먹어요.', '양식생물학과'),
  R('cham', '참돔', '🐟', 'near,island,rock', 8, 25, 85, 24, 1.6, 3, [[4, 6], [10, 12]], null, 'cm', '', '붉은 몸빛의 대표 고급 어종이에요. 양식도 활발해요.', '양식생물학과'),
  R('nong', '농어', '🐟', 'pier,rock,near', 7, 30, 90, 30, 1.7, 3, [[6, 9]], null, 'cm', '', '민물과 바다를 오가는 힘센 포식자예요.', '스마트수산자원관리학과'),
  R('gwang', '광어(넙치)', '🐟', 'sand,near', 8, 25, 75, 35, 1.3, 2, [[4, 6], [9, 10]], null, 'cm', '', '우리나라 대표 양식 어종이에요. 두 눈이 왼쪽에 있어요.', '수산생명의학과'),
  R('ureok', '우럭(조피볼락)', '🐟', 'rock,pier,near', 9, 18, 48, 23, 1, 2, [[1, 3]], null, 'cm', '', '양식장에서도 많이 기르는 어종이에요. 새끼를 낳는 난태생이에요.', '수산생명의학과'),
  R('gal', '갈치', '🐟', 'near,island,deep,quay', 12, 15, 45, 18, 1.1, 2, [[9, 12]], [7, 7], 'an', 'ando,geumo,geomun', '비늘 없이 은빛 피부가 반짝이는 칼 모양 물고기예요. 크기는 항문장(주둥이~항문)으로 재요. (어획량의 20% 미만은 예외 규정)', '해양바이오식품학과'),
  R('sam', '삼치', '🐟', 'near,island,deep', 8, 40, 105, 0, 1.8, 3, [[9, 11]], [5, 5], 'cm', 'geomun,sonjuk,cho', '빠르게 헤엄치는 육식어예요. 금지체장은 없지만 5월 금어기가 있어요.', '해양생산관리학과'),
  R('bang', '방어', '🐟', 'island,deep,near', 5, 45, 125, 30, 2.2, 4, [[11, 2]], null, 'cm', 'geomun,baekdo,sonjuk', '겨울이 제철인 대형 회유어예요.', '스마트수산자원관리학과'),
  R('busi', '부시리', '🐟', 'island,deep', 4, 50, 130, 0, 2.3, 4, [[7, 11]], null, 'cm', 'geomun,baekdo', '방어와 닮았지만 몸이 더 날씬하고 위턱 끝이 각져 있어요.', '해양생산관리학과'),
  R('jaet', '잿방어', '🐟', 'island,deep', 3, 50, 120, 0, 2.2, 4, [[7, 8]], null, 'cm', 'baekdo,geomun', '여름철 섬 주변에 몰려드는 힘센 대형어예요.', '해양융합과학과'),
  R('gada', '가다랑어', '🐟', 'deep,island', 5, 40, 80, 0, 1.9, 3, [[8, 10]], null, 'cm', '', '떼를 지어 먼바다를 오가는 회유어예요. 말린 가쓰오부시의 원료예요.', '해양바이오식품학과'),
  R('chamchi', '참다랑어(참치)', '🐟', 'deep', 1.3, 90, 250, 0, 2.4, 4, [[8, 11]], null, 'cm', '', '참치 중 가장 큰 종이에요. 국제기구가 어획량을 관리하는 귀한 자원이고, 여수 앞바다에선 아주 드물어서 게임에서는 전설 등급이에요.', '스마트수산자원관리학과'),
  R('mansae', '만새기', '🐟', 'deep,island', 3, 60, 130, 0, 1.9, 3, [[8, 10]], null, 'cm', '', '이마가 불룩하고 몸빛이 화려해요. 떠다니는 물체 아래에 잘 모여요.', '해양융합과학과'),
  R('hamo', '갯장어(하모)', '🐟', 'near,sand,island', 6, 50, 130, 40, 1.5, 3, [[6, 10]], null, 'cm', '', '여수의 여름 별미 하모의 주인공이에요. 이빨이 날카로워 만질 때 조심해야 해요.', '해양바이오식품학과'),
  R('ssom', '쏨뱅이', '🐟', 'rock,near,island', 6, 18, 38, 0, .9, 2, [[11, 3]], null, 'cm', '', '가시가 많은 붉은 물고기예요. 매운탕 재료로 인기예요.', '양식생물학과'),
  R('jwichi', '말쥐치(쥐치)', '🐡', 'pier,rock,quay', 8, 15, 38, 18, .7, 1, [[10, 12]], [5, 7], 'cm', '', '가죽이 질겨서 껍질을 벗겨 먹는 물고기예요.', '해양바이오식품학과'),
  R('bokseom', '복섬(복어류)', '🐡', 'pier,quay,rock', 4, 8, 15, 0, .6, 1, [[4, 9]], null, 'cm', '', '내장과 난소에 독(테트로도톡신)이 있어요. 자격 있는 전문가가 아니면 절대 먹으면 안 돼요!', '해양바이오식품학과'),
  R('gab', '갑오징어', '🦑', 'pier,quay,near', 9, 10, 28, 0, .9, 2, [[5, 6], [9, 11]], null, 'ma', '', '몸속에 단단한 뼈(갑)가 있는 오징어예요. 먹물이 진해요.', '해양생산관리학과'),
  R('muni', '무늬오징어', '🦑', 'rock,pier,near,island', 5, 15, 48, 0, 1.2, 3, [[9, 11]], null, 'ma', '', '몸에 줄무늬가 있고 에깅 낚시의 인기 대상이에요.', '해양생산관리학과'),
  R('hanchi', '한치', '🦑', 'island,near', 5, 15, 38, 0, 1, 2, [[6, 8]], null, 'ma', 'geomun,sonjuk,baekdo', '여름 밤바다를 밝히는 집어등 낚시의 대표 대상이에요.', '해양생산관리학과'),
  R('horae', '호래기', '🦑', 'pier,quay', 8, 6, 14, 0, .5, 1, [[11, 3]], null, 'ma', '', '꼴뚜기류의 작은 오징어예요. 겨울 방파제에서 인기예요.', '해양바이오식품학과'),
  R('sal', '살오징어', '🦑', 'near,island,deep', 6, 18, 38, 15, 1.1, 2, [[7, 9]], [4, 5], 'ma', '', '우리나라에서 가장 많이 잡히는 오징어예요. 몸통(외투장) 15cm 이하는 포획 금지예요.', '해양생산관리학과'),
  R('jjugu', '주꾸미', '🐙', 'sand,near,pier', 9, 12, 26, 0, .8, 2, [[9, 11]], [5, 8], 'ma', '', '다리가 8개인 가을 별미예요. 빈 소라껍데기 속에 들어가는 습성을 이용해 잡기도 해요.', '해양생산관리학과'),
  R('muneo', '문어(참문어)', '🐙', 'rock,near,island', 5, 150, 5000, 0, 1.7, 3, [[7, 10]], [5, 6], 'g', '', '심장이 3개, 피가 파란색이에요. (법령의 금지체중 600g은 대문어 기준이에요)', '해양바이오식품학과'),
  R('nakji', '낙지', '🐙', 'sand', 5, 80, 450, 0, 1.1, 2, [[4, 6], [9, 11]], [6, 6], 'g', '', '갯벌에 구멍을 파고 사는 연체동물이에요. 다리가 8개예요. (6월 금어기·지역 고시로 달라질 수 있어요)', '양식생물학과'),
];
SP.find((s) => s.id === 'bokseom').poison = true;
const JUNK = [{ n: '빈 캔', ic: '🥫' }, { n: '폐그물 조각', ic: '🕸️' }, { n: '낡은 장화', ic: '🥾' }, { n: '비닐봉지', ic: '🛍️' }];
const LENL = { cm: '전장', an: '항문장', ma: '외투장(몸통)', g: '무게' };
const RN = ['', '일반', '희귀', '진귀', '전설'];
const PT = [0, 5, 10, 22, 45];
const ZN = { quay: '안벽', pier: '부두', rock: '갯바위', sand: '모래·갯벌', near: '가까운 바다', island: '섬 연안', deep: '먼바다' };
const peakOf = (sp) => sp.pk.some(([a, b]) => inR(MONTH, a, b));
const banOf = (sp) => !!sp.ban && inR(MONTH, sp.ban[0], sp.ban[1]);
const legalOf = (sp, len) => ({ small: sp.min > 0 && len <= sp.min, ban: banOf(sp) });
const fracOf = (sp, len) => clamp((len - sp.lo) / (sp.hi - sp.lo), 0, 1);
const tpts = (sp, len) => PT[sp.r] + Math.round(fracOf(sp, len) * 10);
const fmtL = (sp, len) => (sp.u === 'g' ? (len >= 1000 ? (len / 1000).toFixed(2) + 'kg' : Math.round(len) + 'g') : len.toFixed(1) + 'cm');
const minTxt = (sp) => (sp.min ? `${LENL[sp.u]} ${sp.min}${sp.u === 'g' ? 'g' : 'cm'} 이하` : '지정 없음');
const mTxt = (rs) => rs.map(([a, b]) => (a === b ? a + '월' : a + '~' + b + '월')).join(', ');

/* ───────── 여수 섬 (거리는 줄이고 위치는 단순화) ─────────
 * [id, 이름, 아이콘, x, z, 덩어리[[dx,dz,반지름,높이]..], 한줄태그, 설명, 특징]   항구가 (0,0), +z 가 먼바다 쪽 */
const PORT_IN = { x: 10, z: 95 };
const RAWI = [
  ['odong', '오동도', '🌺', 60, 110, [[0, 0, 22, 9]], '동백섬', '768m 방파제로 육지와 이어진 동백섬이에요. 3천여 그루의 동백나무가 숲을 이뤄요.', 'camellia'],
  ['dolsan', '돌산도', '🌉', 270, 60, [[0, 0, 58, 16], [-40, 45, 34, 12]], '돌산대교', '돌산대교로 육지와 이어진 여수에서 가장 큰 섬이에요. 돌산갓김치로도 유명해요.', ''],
  ['nang', '낭도·사도', '🦖', 400, 200, [[0, 0, 26, 10], [-48, 34, 13, 7]], '공룡 발자국', '사도는 공룡 발자국 화석과 갈라지는 바닷길로, 낭도는 여우를 닮은 모양으로 유명해요.', ''],
  ['gaedo', '개도', '🏝️', -150, 260, [[0, 0, 34, 12]], '갯바위 어장', '화정면에 속한 섬이에요. 게임에서는 얕은 갯바위 어장으로 만들었어요.', ''],
  ['hahwa', '하화도', '🌼', -240, 330, [[0, 0, 16, 8]], '꽃섬', '철마다 꽃이 피어 꽃섬이라 불러요. 5.7km 꽃섬길 걷기길이 있어요.', 'flower'],
  ['geumo', '금오도', '🧗', 70, 400, [[-20, -30, 40, 14], [25, 5, 42, 16], [70, 45, 34, 12]], '비렁길', '남면에서 가장 큰 섬이에요. 벼랑(비렁)을 따라 걷는 18.5km 비렁길이 유명해요.', ''],
  ['ando', '안도', '🐟', 210, 560, [[0, 0, 22, 9]], '갈치 포인트', '금오도 남쪽의 섬이에요. 가을 밤 갈치 낚시터로 알려져 있어요.', ''],
  ['sonjuk', '손죽도', '🌊', -70, 480, [[0, 0, 24, 10]], '바닷길 길목', '여수에서 거문도로 가는 뱃길에 있는 삼산면의 섬이에요. 주변 갯바위가 낚시터로 알려져 있어요.', ''],
  ['cho', '초도', '⚓', -180, 650, [[0, 0, 30, 13]], '청정 해역', '거금도와 거문도 중간쯤의 섬이에요. 수심이 깊고 맑은 청정 해역이에요.', ''],
  ['geomun', '거문도', '🗼', -60, 860, [[-28, -6, 28, 14], [32, 14, 24, 13], [-2, -44, 20, 10]], '거문도등대', '동도·서도·고도 세 섬이에요. 1905년 남해안 최초로 불을 밝힌 거문도등대가 있어요.', 'light'],
  ['baekdo', '백도', '🪨', 165, 905, [[0, 0, 10, 30], [-18, 10, 8, 24], [14, -12, 9, 27], [25, 14, 7, 20], [-10, -22, 6, 18]], '명승 제7호', '39개의 무인 바위섬이에요. 상륙이 금지된 보호 구역이라 낚시 대신 눈으로만 관찰해요.', 'tall'],
];
const ISL = RAWI.map(([id, n, ic, x, z, lb, tag, note, feat]) => {
  const lobes = lb.map(([dx, dz, r, hh]) => ({ x: x + dx, z: z + dz, r, h: hh }));
  const br = Math.max(...lb.map(([dx, dz, r]) => Math.hypot(dx, dz) + r));
  const ddx = PORT_IN.x - x, ddz = PORT_IN.z - z, L = Math.hypot(ddx, ddz);
  return { id, n, ic, x, z, lobes, br, tag, note, feat, protect: id === 'baekdo', ax: x + (ddx / L) * (br + 26), az: z + (ddz / L) * (br + 26) };
});
const DEEP_DEST = { n: '먼바다 어장', ic: '🌐', x: -330, z: 760, tag: '대형 회유어', note: '섬에서 멀리 떨어진 깊은 바다예요. 방어·가다랑어·참다랑어 같은 대형어를 노려요.' };
const OBSF = ['🐬 멀리서 상괭이(작은 토종 돌고래)가 숨 쉬러 올라와요!', '🐦 바위 위에서 바닷새들이 쉬고 있어요.', '🌿 바위 아래엔 해조류 숲이 있어 물고기들의 보금자리가 돼요.', '🔭 이런 곳은 물고기가 알을 낳고 자라는 소중한 터전이에요.', '🪸 백도는 희귀 조류와 식물이 사는 천연 생태계의 보고예요.'];

/* ───────── 글자 텍스처 ───────── */
function textTex(text, w, hh, o = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const g = cv.getContext('2d');
  if (o.bg) {
    const r = o.round || 0, x = 2, y = 2, ww = w - 4, h2 = hh - 4; g.fillStyle = o.bg; g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + ww, y, x + ww, y + h2, r); g.arcTo(x + ww, y + h2, x, y + h2, r); g.arcTo(x, y + h2, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); g.fill();
  }
  const lines = String(text).split('\n'); let fs = o.size || Math.floor(hh / (lines.length + 0.6));
  const F2 = (s) => `800 ${s}px "Malgun Gothic","Noto Sans KR","Segoe UI Emoji",sans-serif`;
  g.font = F2(fs); while (fs > 10 && Math.max(...lines.map((l) => g.measureText(l).width)) > w * 0.92) { fs -= 2; g.font = F2(fs); }
  g.fillStyle = o.color || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, hh / 2 + (i - (lines.length - 1) / 2) * fs * 1.18));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function hullGeo(L, B, depth, bow) {
  const w = B / 2, s = new THREE.Shape();
  s.moveTo(-w, -L / 2); s.lineTo(w, -L / 2); s.lineTo(w, L / 2 - bow);
  s.quadraticCurveTo(w * 0.6, L / 2 - bow * 0.3, 0, L / 2);
  s.quadraticCurveTo(-w * 0.6, L / 2 - bow * 0.3, -w, L / 2 - bow); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.rotateX(Math.PI / 2); return geo;
}

/* ═════════════════════════ 메인 ═════════════════════════ */
export function createFishing(D) {
  const { cam, P, WS, WORLDS, isTouch, sfx, toast, buzz, closeModal, getS, save, hud, getMode, setMode, place, openM } = D;
  const W = WS.soccer, root = W.root;
  const snd = (n) => { try { if (sfx && typeof sfx[n] === 'function') sfx[n](); } catch (e) { /* 무시 */ } };
  const vib = (ms) => { try { if (typeof buzz === 'function') buzz(ms); } catch (e) { /* 무시 */ } };
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pick = (a) => a[(Math.random() * a.length) | 0];

  /* 저장 데이터 (v3 구조) */
  const fs = () => {
    const S = getS(); let f = S.fish;
    if (!f || f.v !== 3) f = S.fish = { v: 3, score: (f && +f.score) || 0, dex: {}, rel: 0, relBad: 0, take: 0, viol: 0, trash: 0, safe: 0, tnBest: 0, obs: 0 };
    return f;
  };
  const addScore = (n) => { const f = fs(); f.score = Math.max(0, (f.score | 0) + n); save(); hud(); };

  /* ── 월드 초기화 ── */
  while (root.children.length) root.remove(root.children[0]);
  const colliders = [];
  W.colliders = colliders; W.limit = 975; W.mapR = 1000; W.spawn = { x: 0, z: -16, yaw: 0 };
  W.portals = [{ x: 0, z: -27, r: 5, to: 'campus', label: '캠퍼스로 돌아가기' }];
  W.coins = []; W.dummies = []; W.ballSpots = []; W.pitch = { x: 9999, z: 9999, hw: 1, hl: 1 };
  W.env = { sky: '#5aa6ee', fog: ['#c4e4fa', 260, 950], sunPos: [80, 120, 60], sunColor: '#fff1d6', sunI: 1.7, hemi: ['#e4f3ff', '#4f7fa6', 1.0] };
  try { WORLDS.soccer.name = '낚시 항구'; WORLDS.soccer.icon = '🎣'; } catch (e) { /* 무시 */ }

  /* ── 재료 ── */
  const mc = {};
  const M = (c, o) => { if (o) return new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true, ...o }); return mc[c] || (mc[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true })); };
  const put = (m, x, y, z, p) => { m.position.set(x, y, z); (p || root).add(m); return m; };
  const bx = (w, hh, d, c, x, y, z, p) => put(new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), M(c)), x, y, z, p);
  const cy = (rt, rb, hh, c, x, y, z, p, s = 10) => put(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, s), M(c)), x, y, z, p);
  const ball = (r, c, x, y, z, p) => put(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), M(c)), x, y, z, p);
  const co = (r, hh, c, x, y, z, p, s = 8) => put(new THREE.Mesh(new THREE.ConeGeometry(r, hh, s), M(c)), x, y, z, p);
  const glow = (m, c, i = .9) => { m.material = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i }); return m; };

  /* 이름판: fd=[가까움,멀음] 이면 그 거리 안에서는 서서히 사라져요 (가까이서 화면을 덮지 않게) */
  const FADES = [];
  const label = (text, bg, w, hh, x, y, z, p, fd) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, 512, Math.round((512 * hh) / w), { bg, round: 26 }), transparent: true, depthTest: false, fog: false }));
    s.scale.set(w, hh, 1); s.position.set(x, y, z); s.renderOrder = 10; (p || root).add(s);
    if (fd) FADES.push({ s, near: fd[0], far: fd[1] });
    return s;
  };
  const tplane = (text, pw, ph, x, y, z, ry, o, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: textTex(text, Math.round(pw * 110), Math.round(ph * 110), o), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.set(x, y, z); m.rotation.y = ry; (p || root).add(m); return m;
  };

  /* ── 바다 ── */
  const seaCv = document.createElement('canvas'); seaCv.width = seaCv.height = 256;
  { const g = seaCv.getContext('2d'); g.fillStyle = '#2a79b5'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 150; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = 10 + Math.random() * 32; g.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.13})`; g.lineWidth = 1 + Math.random() * 2;
      for (const dx of [0, -256]) for (const dy of [0, -256]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + l / 2, y + dy - 4, x + dx + l, y + dy); g.stroke(); } } }
  const seaTex = new THREE.CanvasTexture(seaCv); seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(130, 130); seaTex.colorSpace = THREE.SRGBColorSpace;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ map: seaTex, roughness: .25, metalness: .1, transparent: true, opacity: .92 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; root.add(sea);
  { const deep = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshBasicMaterial({ color: '#0e3a63' })); deep.rotation.x = -Math.PI / 2; deep.position.y = SEA_Y - 6; root.add(deep); }

  /* ── 뒷산·땅 ── */
  [[-420, -560, 150, 110], [-150, -620, 200, 140], [200, -600, 180, 120], [480, -520, 150, 100], [-600, -380, 140, 90]].forEach(([x, z, r, hh], i) => put(new THREE.Mesh(new THREE.ConeGeometry(r, hh, 7), M(i % 2 ? '#4d7a57' : '#5b8a63')), x, hh / 2 - 3, z));
  bx(1500, 3, 694, '#6f9a5a', 0, -1.55, -353);
  { const qm = M('#858b95', {}); qm.userData.noDetail = true; qm.roughness = .95; bx(120, .3, 40, '#858b95', 0, -.15, -26).material = qm; bx(120, .02, .35, '#e8c53a', 0, .02, -7.6); }
  /* 부두 */
  bx(6, .5, 76, '#8a6b4a', 0, -.25, 32); bx(12, .5, 10, '#8a6b4a', 0, -.25, 67);
  for (let z = -3; z <= 71; z += 3) bx(6, .02, .07, '#6e5237', 0, .01, z);
  for (let z = -2; z <= 70; z += 8) [-2.7, 2.7].forEach((x) => cy(.25, .25, 3.5, '#5b4630', x, -1.7, z, root, 8));
  [[-5.5, 64], [5.5, 64], [-5.5, 70], [5.5, 70]].forEach(([x, z]) => cy(.25, .25, 3.5, '#5b4630', x, -1.7, z, root, 8));
  for (let z = 6; z <= 66; z += 12) [-3, 3].forEach((x) => { cy(.07, .07, 3.6, '#666b75', x, 1.8, z, root, 6); glow(ball(.2, '#ffe9a8', x, 3.7, z), '#ffe9a8', .8); });
  /* 갯바위 곶 */
  bx(22, .5, 36, '#7d8590', -49, -.25, 12);
  for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, r = rnd(1.4, 3.2), m = put(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), M('#6a717b')), -49 + Math.cos(a) * 15 + rnd(-3, 3), -.4, 12 + Math.sin(a) * 25 + rnd(-3, 3)); m.scale.y = .6; }
  for (let i = 0; i < 10; i++) { const m = put(new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(1, 2.4), 0), M('#5f6670')), rnd(-64, -34), -.5, rnd(32, 40)); m.scale.y = .5; }
  /* 모래사장 */
  bx(22, .4, 26, '#e8d7a5', 49, -.2, 7);
  /* 나무·건물 */
  for (let i = 0; i < 26; i++) { const x = rnd(-56, 56), z = rnd(-98, -50); if (Math.hypot(x + 34, z + 62) < 8) continue; cy(.25, .3, 2, '#6b4a2b', x, 1, z, root, 6); co(1.7, 4, i % 2 ? '#3f8a4a' : '#357a40', x, 3.8, z, root, 7); colliders.push({ x, z, r: 1 }); }
  bx(22, 7, 12, '#e9eef4', -40, 3.5, -62 + 30); bx(22.6, .6, 12.6, '#4a5568', -40, 7.2, -32);
  tplane('여수 수산시장', 12, 2, -40, 5.2, -25.9, 0, { bg: '#0f3d73', round: 18 });
  colliders.push({ x: -40, z: -32, r: 9 }, { x: -30, z: -32, r: 4 }, { x: -50, z: -32, r: 4 });
  const hut = (x, z, wall, roof, text) => {
    bx(5, 3, 4, wall, x, 1.5, z); const rf = co(4.4, 2.2, roof, x, 4.1, z, root, 4); rf.rotation.y = Math.PI / 4;
    tplane(text, 4.4, 1, x, 3.3, z + 2.02, 0, { bg: '#0f3d73', round: 14 }); bx(1.2, 2, .1, '#4a3320', x, 1, z + 2.03);
    colliders.push({ x, z, r: 3.1 });
  };
  hut(-14, -18, '#d6b98a', '#b5472f', '📖 어류 도감'); hut(14, -18, '#d6b98a', '#2f6fb5', '🏆 낚시 대회');
  tplane('금지체장 이하는 방생! 🌊', 5.6, 1.1, -7.5, 2.4, -7.2, 0, { bg: '#1c6b45', round: 14 }); cy(.08, .08, 2.4, '#666b75', -10.2, 1.2, -7.3, root, 6); cy(.08, .08, 2.4, '#666b75', -4.8, 1.2, -7.3, root, 6);
  tplane('🦺 구명조끼 착용', 5.6, 1.1, 7.5, 2.4, -7.2, 0, { bg: '#c0532f', round: 14 }); cy(.08, .08, 2.4, '#666b75', 4.8, 1.2, -7.3, root, 6); cy(.08, .08, 2.4, '#666b75', 10.2, 1.2, -7.3, root, 6);
  /* 캠퍼스 포털 */
    { const px = 0, pz = -27; [-3, 3].forEach((dx) => cy(.5, .6, 6, '#2f9fbf', px + dx, 3, pz, root, 10)); bx(7.4, .9, 1.2, '#2f9fbf', px, 6.3, pz);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, .18, 8, 28), M('#7fe3ff', { emissive: '#7fe3ff', emissiveIntensity: .8 })); ring.position.set(px, 3.2, pz); root.add(ring); W._portalRing = ring;
        label('🌀 캠퍼스로 돌아가기', 'rgba(15,61,115,.9)', 9, 1.9, px, 8.8, pz, undefined, [6, 26]); colliders.push({ x: px - 3, z: pz, r: .9 }, { x: px + 3, z: pz, r: .9 }); }

  /* 낚시 터 (이름판 없음 — 바닥 링만. 구역별 색) */
  const SPOTS = [
    { id: 'p1', n: '부두 1번', zone: 'pier', x: -1.7, z: 14, yaw: -PI2 }, { id: 'p2', n: '부두 2번', zone: 'pier', x: -1.7, z: 34, yaw: -PI2 }, { id: 'p3', n: '부두 3번', zone: 'pier', x: -1.7, z: 54, yaw: -PI2 },
    { id: 'p4', n: '부두 4번', zone: 'pier', x: 1.7, z: 14, yaw: PI2 }, { id: 'p5', n: '부두 5번', zone: 'pier', x: 1.7, z: 26, yaw: PI2 }, { id: 'p6', n: '부두 6번', zone: 'pier', x: 1.7, z: 54, yaw: PI2 },
    { id: 'h1', n: '부두 끝 왼쪽', zone: 'pier', x: -4, z: 70, yaw: 0 }, { id: 'h2', n: '부두 끝 가운데', zone: 'pier', x: 0, z: 70.2, yaw: 0 }, { id: 'h3', n: '부두 끝 오른쪽', zone: 'pier', x: 4, z: 70, yaw: 0 },
    { id: 'r1', n: '갯바위 서쪽', zone: 'rock', x: -56, z: 12, yaw: -PI2 }, { id: 'r2', n: '갯바위 곶 끝', zone: 'rock', x: -49, z: 27, yaw: 0 }, { id: 'r3', n: '갯바위 동쪽', zone: 'rock', x: -41, z: 14, yaw: PI2 },
    { id: 's1', n: '모래사장 앞', zone: 'sand', x: 50, z: 16, yaw: 0 }, { id: 's2', n: '모래사장 끝', zone: 'sand', x: 58, z: 6, yaw: PI2 },
    { id: 'q1', n: '안벽 서쪽', zone: 'quay', x: -22, z: -7.2, yaw: 0 }, { id: 'q2', n: '안벽 동쪽', zone: 'quay', x: 22, z: -7.2, yaw: 0 },
  ];
  const ZCOL = { pier: '#ffd34d', rock: '#ff9f43', sand: '#ff7aa8', quay: '#7fe3ff' };
  const spotRings = SPOTS.map((s) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.45, 32), new THREE.MeshBasicMaterial({ color: ZCOL[s.zone] || '#ffd34d', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(s.x, .05, s.z); root.add(m); return m;
  });

  /* 울타리 충돌(바다로 걸어 나가지 않도록) */
  const LOOP = [[-60.2, -100.2], [60.2, -100.2], [60.2, 20.2], [37.8, 20.2], [37.8, -5.8], [3.2, -5.8], [3.2, 62.2], [6.2, 62.2], [6.2, 72.2], [-6.2, 72.2], [-6.2, 62.2], [-3.2, 62.2], [-3.2, -5.8], [-37.8, -5.8], [-37.8, 30.2], [-60.2, 30.2], [-60.2, -100.2]];
  for (let i = 0; i < LOOP.length - 1; i++) {
    const [x0, z0] = LOOP[i], [x1, z1] = LOOP[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2));
    for (let k = 0; k <= n; k++) colliders.push({ x: lerp(x0, x1, k / n), z: lerp(z0, z1, k / n), r: .9 });
  }

  /* ── 선박 ── */
  const hullMesh = (g, L, B, depth, bow, col, y) => { const m = new THREE.Mesh(hullGeo(L, B, depth, bow), new THREE.MeshStandardMaterial({ color: col, roughness: .55, metalness: .1, side: THREE.DoubleSide })); m.position.y = y; g.add(m); return m; };
  const side = (g, text, pw, ph, W2, y, z, o) => { tplane(text, pw, ph, W2 + .02, y, z, PI2, o, g); tplane(text, pw, ph, -W2 - .02, y, z, -PI2, o, g); };
  const SHIPKIT = createShipKit(M, tplane);
  function makeShip(kind) {
    if (kind === 'research' || kind === 'cheong') { try { return SHIPKIT[kind](); } catch (e) { console.warn('[ships]', e); } }
    const g = new THREE.Group(); g.rotation.order = 'YXZ'; const WH = '#e1e6ec', DK = '#1b2836';
    if (kind === 'fish') {
      const L = 11.5, B = 4, FB = 1.5;
      hullMesh(g, L - .5, B - .4, 1.2, 3.5, '#27456f', 0); hullMesh(g, L, B, FB, 3.8, WH, FB);
      [1, -1].forEach((s) => bx(.06, .35, L * .7, '#e8602c', s * (B / 2 + .01), .85, -.5, g));
      bx(2.6, 1.9, 3.2, WH, 0, FB + .95, 2.0, g); bx(2.64, .6, 2.4, DK, 0, FB + 1.3, 2.1, g); bx(3.0, .2, 3.6, '#e8602c', 0, FB + 1.98, 2.0, g);
      cy(.07, .07, 3.4, '#cdd3da', 0, FB + 3.7, 1.4, g, 6); glow(ball(.15, '#ffe08a', 0, FB + 5.4, 1.4, g), '#ffcc55');
      [1, -1].forEach((s) => { cy(.05, .05, 1.1, '#444', s * 1.7, FB + .55, -3.4, g, 6); cy(.05, .05, 1.1, '#444', s * 1.7, FB + .55, -4.4, g, 6); });
      bx(.9, .5, .9, '#3aa86a', 1.2, FB + .25, -1.0, g);
      side(g, '낚싯배 여수1호', 4.2, .7, B / 2, 1.0, -2.2, { color: '#143a78' });
      g.userData = { L, B, FB };
    } else if (kind === 'research') {
      const L = 26, B = 5.6, FB = 2.2, Wd = B / 2;
      hullMesh(g, L - .6, B - .6, 1.4, 6, '#1b2f55', 0); hullMesh(g, L, B, FB, 7, '#e1e6ec', FB);
      bx(B - .7, .06, 8.6, '#2f7d4a', 0, FB + .03, -8.4, g);
      bx(4.6, 2.2, 9, WH, 0, FB + 1.1, 1.5, g); bx(4.62, .4, 6.5, DK, 0, FB + 1.2, 1.9, g); bx(4.2, 2.0, 6.5, WH, 0, FB + 3.2, 2.4, g); bx(4.22, .4, 5.5, DK, 0, FB + 3.3, 2.7, g);
      bx(3.7, 1.7, 3.4, WH, 0, FB + 5.05, 3.9, g); bx(3.74, .62, 3.44, DK, 0, FB + 5.3, 3.9, g); ball(1.25, '#ffffff', 0, 7.7, .3, g);
      bx(1.8, 2.6, 2.4, '#1d3b73', 0, 5.7, -2.0, g); [1, -1].forEach((s) => cy(.12, .12, 5, '#e8602c', s * 2.0, FB + 2.5, -12.2, g, 8)); bx(4.3, .25, .25, '#e8602c', 0, FB + 5, -12.2, g);
      cy(.1, .12, 4, '#cdd3da', 0, 10.1, 3.6, g, 8);
      side(g, '전남대학교', 7.0, 1.2, Wd, 1.15, 1.0, { color: '#143a78' }); side(g, '새동백호', 5.0, .9, Wd, 1.0, -9.0, { color: '#143a78' });
      g.userData = { L, B, FB };
    } else {
      const L = 24, B = 4.8, FB = 1.9, Wd = B / 2;
      hullMesh(g, L - .6, B - .5, 1.3, 6.5, '#14233f', 0); hullMesh(g, L, B, FB, 6.5, '#e1e6ec', FB);
      bx(4.0, 1.8, 9, WH, 0, FB + .9, .5, g); bx(4.02, .4, 7.5, DK, 0, FB + 1.1, .9, g); bx(3.5, 1.6, 4, WH, 0, FB + 2.6, 2.0, g); bx(3.54, .55, 4.04, DK, 0, 4.75, 2.0, g);
      cy(.09, .11, 5, '#cdd3da', 0, 7.8, 1.6, g, 8); glow(bx(1.2, .15, .3, '#2a6bff', 0, 5.4, .4, g), '#2a6bff', .8);
      bx(3.4, 1.9, 3.2, WH, 0, FB + .95, -6.0, g); bx(4.4, .08, 5, '#6b7585', 0, FB + .04, -9.6, g);
      [['#d8232a', 0], ['#f6c200', .9], ['#0d3b8e', 1.8]].forEach(([c, dz]) => [1, -1].forEach((s) => bx(.05, 1.4, .7, c, s * (Wd + .02), .95, 3.4 - dz, g)));
      side(g, 'KOREA COAST GUARD', 9, .9, Wd, 1.0, -6.2, { color: '#0d3b8e' }); side(g, '해양경찰 122', 3.6, .8, Wd, 1.0, 6.0, { color: '#0d3b8e' });
      g.userData = { L, B, FB };
    }
    g.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.userData.noDetail = true; }); });
    return g;
  }
  const SHIPS = [], OBS_C = [], OBS_R = [
    { x0: -800, x1: 800, z0: -800, z1: -6 }, { x0: -3, x1: 3, z0: -6, z1: 64 }, { x0: -6, x1: 6, z0: 62, z1: 72 },
    { x0: -60, x1: -38, z0: -6, z1: 30 }, { x0: 38, x1: 60, z0: -6, z1: 20 },
  ];
  [['research', -20, 44], ['guard', 25, 30], ['cheong', -20, 84]].forEach(([k, x, z], i) => {
    const g = makeShip(k); g.position.set(x, SEA_Y + .15, z); root.add(g); SHIPS.push({ g, ph: i * 2 });
    const U = g.userData; [-.33, 0, .33].forEach((f) => OBS_C.push({ x, z: z + U.L * f, r: U.B / 2 + 1.6 }));
  });
  label('🚢 실습선 새동백호', 'rgba(15,61,115,.85)', 7, 1.4, -20, 12, 44, undefined, [30, 70]);
  label('🛟 해양경찰 함정', 'rgba(15,61,115,.85)', 7, 1.4, 25, 11, 30, undefined, [30, 70]);
  label('🛥 청경호 (LNG 추진)', 'rgba(15,61,115,.85)', 7, 1.4, -20, 14, 84, undefined, [30, 70]);
  { const gw = bx(5, .15, 1.4, '#8a6b4a', 5.5, .3, 40); gw.rotation.z = 0; }
  label('⛵ 낚싯배 승선장', 'rgba(192,83,47,.9)', 6, 1.3, 6, 5, 40, undefined, [10, 28]);
  /* 내 낚싯배 */
  const B = { g: makeShip('fish'), x: 10, z: 40, h: 0, v: 0, thr: 0, rud: 0, aboard: false, anchored: false, docked: true, auto: null, dock: null, want: false, cd: 0, autoD: 0 };
  B.g.position.set(B.x, SEA_Y + .15, B.z); root.add(B.g);

  /* ── 섬 만들기 ── */
  function lighthouse(p, x, y, z, s = 1) {
    cy(1.2 * s, 1.7 * s, 9 * s, '#f3f3f3', x, y + 4.5 * s, z, p, 12); cy(1.25 * s, 1.25 * s, 1.8 * s, '#d6453d', x, y + 9.9 * s, z, p, 12);
    glow(cy(.8 * s, .8 * s, 1.2 * s, '#ffe08a', x, y + 11.4 * s, z, p, 12), '#ffcc55'); cy(.1 * s, 1.1 * s, 1 * s, '#d6453d', x, y + 12.5 * s, z, p, 12);
  }
  ISL.forEach((I) => {
    const g = new THREE.Group(); root.add(g); let maxH = 0;
    I.lobes.forEach((l, li) => {
      const base = SEA_Y + 3.5;
      if (I.feat === 'tall') {
        cy(l.r * .7, l.r, l.h, '#9a9fa6', l.x, SEA_Y + l.h / 2 - 1, l.z, g, 7); co(l.r * .7, 3, '#4d7a57', l.x, SEA_Y + l.h - .5, l.z, g, 7);
        [1, 2].forEach((k) => cy(l.r * .2, l.r * .25, l.h * .5, '#b0b4ba', l.x + l.r * .5 * k, SEA_Y + l.h * .25, l.z - 1, g, 5));
      } else {
        cy(l.r * .85, l.r * 1.1, 4, '#7a7f86', l.x, SEA_Y + 1.5, l.z, g, 12);
        co(l.r * .8, l.h, '#5c8f58', l.x, base + l.h / 2, l.z, g, 10);
        const nt = Math.round(l.r / 4);
        for (let t = 0; t < nt; t++) { const a = Math.random() * 6.28, rho = Math.random() * l.r * .5, ty = base + l.h * (1 - rho / (l.r * .8)); co(1.2, 4.2, '#2f6f3d', l.x + Math.cos(a) * rho, ty + 1.8, l.z + Math.sin(a) * rho, g, 6); }
      }
      const foam = new THREE.Mesh(new THREE.RingGeometry(l.r * 1.02, l.r * 1.42, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .33, side: THREE.DoubleSide, depthWrite: false }));
      foam.rotation.x = -Math.PI / 2; foam.position.set(l.x, SEA_Y + .05, l.z); g.add(foam);
      maxH = Math.max(maxH, I.feat === 'tall' ? l.h : l.h + 4);
      if (I.feat === 'light' && li === 1) lighthouse(g, l.x, base + l.h - 2, l.z, 1);
      if (I.feat === 'camellia') for (let t = 0; t < 10; t++) { const a = Math.random() * 6.28, rho = Math.random() * l.r * .55; ball(.8, '#e0344a', l.x + Math.cos(a) * rho, base + l.h * (1 - rho / (l.r * .8)) + 1.4, l.z + Math.sin(a) * rho, g); }
      if (I.feat === 'flower') for (let t = 0; t < 12; t++) { const a = Math.random() * 6.28, rho = Math.random() * l.r * .6; ball(.6, pick(['#ff7fb5', '#ffd34d', '#c58bff']), l.x + Math.cos(a) * rho, base + l.h * (1 - rho / (l.r * .8)) + 1.2, l.z + Math.sin(a) * rho, g); }
      OBS_C.push({ x: l.x, z: l.z, r: l.r * .95 + 1 });
    });
    if (I.feat === 'camellia') lighthouse(g, I.x + 6, SEA_Y + 3.5 + I.lobes[0].h - 2, I.z + 4, .6);
    label(`${I.ic} ${I.n}`, I.protect ? 'rgba(120,60,150,.9)' : 'rgba(15,61,115,.85)', 20, 4.4, I.x, SEA_Y + maxH + 12, I.z, g, [80, 170]);
  });

  /* ── 바다 셰이더 (seafx.js) ── */
  const _sc = [];
  ISL.forEach((I) => I.lobes.forEach((l) => _sc.push([l.x, l.z, l.r * 1.05])));
  SHIPS.forEach((s) => { const U = s.g.userData; [-.4, -.2, 0, .2, .4].forEach((f) => _sc.push([s.g.position.x, s.g.position.z + U.L * f, U.B / 2 + .3])); });
  const SEAFX = createSeaFx({ root, y: SEA_Y, circles: _sc, rects: OBS_R.map((w) => [w.x0, w.z0, w.x1, w.z1]), sun: W.env.sunPos });
  if (SEAFX) sea.visible = false;
  const SKYFX = createSkyFx({ root, sun: W.env.sunPos });

  /* 물고기 그림자 */
  const fishSh = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: '#08243f', transparent: true, opacity: .28, depthWrite: false }));
    m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; const s = rnd(.5, 1.1); m.scale.set(s * 1.6, s * .55, 1); root.add(m);
    fishSh.push({ m, cx: rnd(-40, 40), cz: rnd(8, 110), r: rnd(6, 20), sp: rnd(.15, .4) * (Math.random() < .5 ? 1 : -1), ph: rnd(0, 6) });
  }

  /* ── 낚싯대·찌·링 ── */
  const rod = new THREE.Group(); rod.rotation.order = 'YXZ'; rod.visible = false; root.add(rod);
  { const r1 = new THREE.Mesh(new THREE.CylinderGeometry(.02, .05, 3.4, 6), M('#2b2f36')); r1.position.y = 1.7; rod.add(r1); const rl = new THREE.Mesh(new THREE.BoxGeometry(.12, .1, .18), M('#c0c6cf')); rl.position.set(0, .35, .08); rod.add(rl); }
  const TIP = new THREE.Vector3(0, 3.4, 0);
  const rodTip = () => { rod.updateMatrixWorld(true); return rod.localToWorld(TIP.clone()); };
  const bob = new THREE.Group(); bob.visible = false; root.add(bob);
  { const b1 = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), M('#e8412f')); const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .5, 6), M('#f4f4f4')); b2.position.y = .35; bob.add(b1, b2); }
  const LN = 14, lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LN * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f7fa', transparent: true, opacity: .85 })); line.frustumCulled = false; line.visible = false; root.add(line);
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false });
  const ringL = new THREE.Mesh(new THREE.RingGeometry(.8, 1.05, 28), ringMat('#ffd34d', .9)); ringL.rotation.x = -Math.PI / 2; ringL.visible = false; root.add(ringL);
  const rip = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 24), ringMat('#ffffff', 0)); rip.rotation.x = -Math.PI / 2; rip.visible = false; root.add(rip);
  const fshadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: '#08243f', transparent: true, opacity: .4, depthWrite: false })); fshadow.rotation.x = -Math.PI / 2; fshadow.visible = false; root.add(fshadow);
  const hideLine = () => { bob.visible = line.visible = fshadow.visible = false; };
  function updateLine(sag) {
    const a = rodTip(), b = bob.position, ar = lineGeo.attributes.position.array;
    for (let i = 0; i < LN; i++) { const u = i / (LN - 1); ar[i * 3] = lerp(a.x, b.x, u); ar[i * 3 + 1] = lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * sag; ar[i * 3 + 2] = lerp(a.z, b.z, u); }
    lineGeo.attributes.position.needsUpdate = true;
  }

  /* ── 지형·구역 판정 ── */
  function isWater(x, z) {
    for (const w of OBS_R) if (x > w.x0 - .3 && x < w.x1 + .3 && z > w.z0 - .3 && z < w.z1 + .3) return false;
    for (const c of OBS_C) if (Math.hypot(x - c.x, z - c.z) < c.r) return false;
    return true;
  }
  function zoneAt(x, z) {
    let best = null, bd = 1e9;
    for (const I of ISL) for (const l of I.lobes) { const d = Math.hypot(x - l.x, z - l.z) - l.r; if (d < bd) { bd = d; best = I; } }
    if (bd < 100) return { zone: 'island', isl: best, label: `${best.n} 앞바다`, protect: !!best.protect };
    if (Math.hypot(x, z) > 650) return { zone: 'deep', isl: null, label: '먼바다', protect: false };
    return { zone: 'near', isl: null, label: Math.hypot(x - 10, z - 70) < 110 ? '여수항 앞바다' : '가까운 바다', protect: false };
  }
  function pool(zone, isl) {
    return SP.map((sp) => {
      if (!sp.z.includes(zone)) return [sp, 0];
      let w = sp.w; if (peakOf(sp)) w *= 2.2; if (banOf(sp)) w *= .35;
      if (sp.at.length) w *= isl && sp.at.includes(isl.id) ? 3 : zone === 'island' ? .3 : 1;
      return [sp, w];
    });
  }
  const hotNames = (I) => pool('island', I).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0].n).join('·');

  /* ── 상태 ── */
  const F = { on: false, kind: 'foot', sub: 'fish', st: 'idle', spot: null, zone: null, aim: 0, pw: 0, t: 0, wait: 0, nib: [], nibI: 0, tw: 0, rip: 0, bt: 0, fi: null, f: null, tgt: null, from: null, saved: null, obsCd: 0 };
  const hold = { act: false, left: false, right: false };
  const TN = { on: false, left: 0, pts: 0, n: 0, best: null };

  /* ═════════ UI ═════════ */
  const css = document.createElement('style');
  css.textContent = `
#fx{position:fixed;inset:0;z-index:30;pointer-events:none;display:none;color:#fff;font-family:"Malgun Gothic","Noto Sans KR",sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#fx.on{display:block}
#fx .drag{position:absolute;inset:0;pointer-events:auto;touch-action:none}
#fx .b{position:absolute;pointer-events:auto;touch-action:none;width:58px;height:58px;border-radius:50%;border:2px solid rgba(255,255,255,.6);background:rgba(10,40,80,.62);color:#fff;font-size:24px;line-height:1.05;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;font-family:inherit}
#fx .b small{font-size:10px;opacity:.9}
#fx .b.on{background:rgba(255,200,60,.9);border-color:#fff}
#fx .act{right:16px;bottom:16px;width:84px;height:84px;font-size:34px;background:rgba(220,70,50,.82)}
#fx .left{left:16px;bottom:24px}#fx .right{left:86px;bottom:24px}
#fx .up{right:30px;bottom:112px}#fx .down{right:112px;bottom:30px}
#fx .exit{right:12px;top:calc(50% - 80px);width:52px;height:52px;border-radius:14px;font-size:18px;background:rgba(200,60,60,.78)}
#fx .chart{left:12px;top:calc(50% - 70px);width:52px;height:52px;border-radius:14px;font-size:20px}
#fx .anchor{left:12px;top:calc(50% + 2px);width:52px;height:52px;border-radius:14px;font-size:20px}
#fx .top{position:absolute;left:50%;top:44px;transform:translateX(-50%);padding:3px 10px;border-radius:12px;background:rgba(10,30,60,.55);font-size:11px;text-align:center;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
#fx .top b{display:inline;font-size:12px;margin-right:6px}
#fx .tn{position:absolute;left:50%;top:70px;transform:translateX(-50%);padding:3px 12px;border-radius:12px;background:rgba(160,60,20,.85);font-weight:800;font-size:14px;display:none}
#fx .msg{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);font-size:clamp(12px,1.8vw,16px);font-weight:800;text-align:center;text-shadow:0 2px 6px #000,0 0 3px #000;white-space:nowrap;max-width:94vw}
#fx .gauge{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);width:min(56vw,430px);display:none}
#fx .gauge.on{display:block}
#fx .gl{font-size:12px;text-align:center;margin-bottom:3px;text-shadow:0 1px 3px #000}
#fx .gb{position:relative;height:18px;border-radius:9px;overflow:hidden;background:linear-gradient(90deg,#3fd17a 0,#3fd17a 58%,#ffd24a 58%,#ffd24a 82%,#ff5a4d 82%,#ff5a4d 100%);border:2px solid rgba(255,255,255,.85)}
#fx .gb.pw{background:linear-gradient(90deg,#4cc3ff,#ffd24a 70%,#ff7a59)}
#fx .gn{position:absolute;top:-2px;bottom:-2px;width:5px;margin-left:-2px;background:#fff;box-shadow:0 0 4px #000;left:0}
#fx .gb2{margin-top:6px;height:8px;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden}
#fx .gf{display:block;height:100%;width:0;background:#4cc3ff}
.fxcard{text-align:center}.fxic{font-size:64px;line-height:1.1}.fxnew{font-size:12px;background:#ff5a4d;color:#fff;padding:2px 8px;border-radius:10px;vertical-align:middle}
.fxbig{font-size:26px;font-weight:800;margin:4px 0}.fxrow{opacity:.9;margin:2px 0}.fxfact{margin:8px 0;font-size:14px}.fxsmall{font-size:12px;opacity:.85;margin-bottom:8px}
.fxchip{display:inline-block;padding:5px 12px;border-radius:12px;font-weight:700;font-size:13px;margin:4px 0}.fxchip.ok{background:#1f8f55;color:#fff}.fxchip.bad{background:#c0392b;color:#fff}.fxchip.poi{background:#7d3cb0;color:#fff}
.fxchk{display:block;margin:7px 0;font-size:15px}.fxchk input{width:18px;height:18px;margin-right:6px;vertical-align:middle}
.fxdex .bar{height:10px;border-radius:5px;background:rgba(127,127,127,.3);overflow:hidden;margin:4px 0 8px}.fxdex .bar i{display:block;height:100%;background:#4cc3ff}
.fxdex .flt{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
.fxdex .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:6px;max-height:40vh;overflow:auto}
.fxt{border:2px solid rgba(127,127,127,.4);border-radius:10px;padding:6px 2px;text-align:center;cursor:pointer;background:rgba(127,127,127,.12)}.fxt.off{opacity:.55}.fxt b{display:block;font-size:26px}.fxt small{display:block;font-size:11px}.fxt i{font-style:normal;color:#e0a800;font-size:10px}
.fxlist{max-height:55vh;overflow:auto}.fxli{display:flex;gap:8px;align-items:center;border:2px solid rgba(127,127,127,.35);border-radius:10px;padding:8px;margin:6px 0;background:rgba(127,127,127,.1)}.fxli div{flex:1;font-size:13px}.fxli small{opacity:.85}
.fxprof{font-size:13px;margin-top:8px;padding:8px;border-radius:10px;background:rgba(127,127,127,.12)}
#modal{z-index:60!important}
#fx.hold .b{visibility:hidden}
#fx.hold .drag{pointer-events:none}
body.touch #keys,body.fxon #keys{display:none!important}
@media (max-height:520px){#fx .b{width:50px;height:50px;font-size:21px}#fx .act{width:72px;height:72px;font-size:30px}#fx .up{bottom:96px}#fx .left{bottom:18px}#fx .right{left:76px;bottom:18px}#fx .down{right:96px;bottom:22px}#fx .msg{bottom:132px}#fx .gauge{bottom:78px}}
#fx .exit{left:auto!important;bottom:auto!important;right:14px!important;top:calc(50% - 26px)!important}
#fx.sail .up{right:auto!important;left:16px!important;bottom:92px!important}
#fx.sail .down{right:auto!important;left:16px!important;bottom:24px!important}
#fx.sail .left{left:auto!important;right:86px!important;bottom:24px!important}
#fx.sail .right{left:auto!important;right:16px!important;bottom:24px!important}
#fx.sail .chart{top:calc(50% - 120px)!important}
#fx.sail .anchor{top:calc(50% - 56px)!important}
@media (max-height:520px){#fx.sail .up{bottom:80px!important}#fx.sail .down{bottom:18px!important}#fx.sail .left{right:76px!important;bottom:18px!important}#fx.sail .right{bottom:18px!important}}`;

  document.head.append(css);
  const ui = h('div'); ui.id = 'fx';
  ui.innerHTML = '<div class="drag"></div><div class="top"><b class="t1"></b><span class="t2"></span></div><div class="tn"></div><div class="msg"></div><div class="gauge"><div class="gl"></div><div class="gb"><i class="gn"></i></div><div class="gb2"><i class="gf"></i></div></div>'
    + '<button class="b left" data-k="left">◀</button><button class="b right" data-k="right">▶</button><button class="b up" data-k="up">▲<small>가속</small></button><button class="b down" data-k="down">▼<small>감속</small></button>'
    + '<button class="b act" data-k="act">🎣</button><button class="b exit" data-k="exit">✖<small>그만</small></button><button class="b chart" data-k="chart">🗺</button><button class="b anchor" data-k="anchor">⚓</button>';
  document.body.append(ui);
  const q = (s) => ui.querySelector(s), E = {
    drag: q('.drag'), t1: q('.t1'), t2: q('.t2'), tn: q('.tn'), msg: q('.msg'), gauge: q('.gauge'), gl: q('.gl'), gb: q('.gb'), gn: q('.gn'), gb2: q('.gb2'), gf: q('.gf'),
    left: q('.left'), right: q('.right'), up: q('.up'), down: q('.down'), act: q('.act'), exit: q('.exit'), chart: q('.chart'), anchor: q('.anchor'),
  };
  const setT = (el, txt) => { if (el._t !== txt) { el._t = txt; el.textContent = txt; } };
  const setH = (el, htm) => { if (el._h !== htm) { el._h = htm; el.innerHTML = htm; } };
  const setV = (el, v, d = 'flex') => { if (el._v !== v) { el._v = v; el.style.display = v ? d : 'none'; } };
  const bind = (btn, down, up) => {
    let on = false;
    const s = (e) => { e.preventDefault(); e.stopPropagation(); if (on) return; on = true; try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } btn.classList.add('on'); if (down) down(); };
    const f = () => { if (!on) return; on = false; btn.classList.remove('on'); if (up) up(); };
    btn.addEventListener('pointerdown', s); btn.addEventListener('pointerup', f); btn.addEventListener('pointercancel', f); btn.addEventListener('lostpointercapture', f);
  };
  const inFish = () => F.on && getMode() === 'fish';
  const actDown = () => { if (!inFish()) return; hold.act = true; onAct(); };
  const actUp = () => { hold.act = false; if (F.on && F.st === 'charge') cast(); };
  const thr = (d) => { if (!inFish() || F.sub !== 'sail' || B.dock) return; B.auto = null; B.thr = clamp(B.thr + d, 0, 3); snd('click'); vib(10); };
  bind(E.act, actDown, actUp); bind(E.left, () => { hold.left = true; }, () => { hold.left = false; }); bind(E.right, () => { hold.right = true; }, () => { hold.right = false; });
  bind(E.up, () => thr(1)); bind(E.down, () => thr(-1)); bind(E.exit, () => { if (inFish()) exitPressed(); }); bind(E.chart, () => { if (inFish()) openChart(); }); bind(E.anchor, () => { if (inFish()) anchorPressed(); });
  let drag = null;
  E.drag.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX }; try { E.drag.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ } });
  E.drag.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x; drag.x = e.clientX; if (inFish() && F.sub === 'fish' && F.st !== 'fight') aimBy(-dx * 0.006); });
  ['pointerup', 'pointercancel'].forEach((ev) => E.drag.addEventListener(ev, () => { drag = null; }));
  addEventListener('keydown', (e) => {
    if (!inFish() || (e.target && e.target.tagName === 'INPUT')) return; const c = e.code;
    if (c === 'Space') { e.preventDefault(); if (!e.repeat) actDown(); } else if (c === 'ArrowLeft' || c === 'KeyA') hold.left = true; else if (c === 'ArrowRight' || c === 'KeyD') hold.right = true;
    else if ((c === 'ArrowUp' || c === 'KeyW') && !e.repeat) thr(1); else if ((c === 'ArrowDown' || c === 'KeyS') && !e.repeat) thr(-1);
    else if ((c === 'KeyX' || c === 'Escape') && !e.repeat) exitPressed(); else if (c === 'KeyC' && !e.repeat) openChart(); else if (c === 'KeyQ' && !e.repeat) anchorPressed();
  }, true);
  addEventListener('keyup', (e) => { const c = e.code; if (c === 'Space') actUp(); else if (c === 'ArrowLeft' || c === 'KeyA') hold.left = false; else if (c === 'ArrowRight' || c === 'KeyD') hold.right = false; });

  /* 카드·지도·도감 같은 창: 열려 있는 동안 낚시 조작 레이어(버튼·드래그)를 꺼서 클릭이 창에 닿게 해요 */
  function modal(box, opt = {}) {
    ui.classList.add('hold'); hold.act = hold.left = hold.right = false; drag = null;
    openM(box, {
      wide: opt.wide,
      onClose: (rep) => {
        if (!rep) ui.classList.remove('hold');   // 다른 창으로 교체되는 경우(rep)엔 유지
        if (opt.onClose) opt.onClose(rep);
        if (!rep) setTimeout(() => { if (F.on && getMode() === 'play') setMode('fish'); }, 0);
      },
    });
  }
  function showUI() {
    F.on = true; ui.classList.add('on'); ui.classList.remove('hold'); document.body.classList.add('fxon');
    const bar = document.getElementById('bar'); if (bar) bar.style.display = 'none';
    if (!F.saved) F.saved = { dist: cam.dist, pitch: cam.pitch };
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* 무시 */ }
  }
  function stopAll(toPlay = true) {
    hideLine(); ringL.visible = false; rip.visible = false; rod.visible = false;
    F.on = false; F.st = 'idle'; hold.act = hold.left = hold.right = false; ui.classList.remove('on'); ui.classList.remove('hold'); document.body.classList.remove('fxon');
    const bar = document.getElementById('bar'); if (bar) bar.style.display = '';
    try { engine.stop(); } catch (e) { /* 무시 */ }
    if (F.saved) { cam.dist = F.saved.dist; cam.pitch = F.saved.pitch; F.saved = null; }
    if (toPlay && getMode() === 'fish') setMode('play');
    P.vx = P.vz = 0; try { place(); } catch (e) { /* 무시 */ }
  }

  /* ═════════ 안전 점검 · 시작/종료 ═════════ */
  function safety(cb, cancel) {
    const f = fs(); if (f.safe) { cb(); return; }
    const box = h('div', '', '<h2>🦺 낚시 안전 점검</h2><p>출발 전에 모두 체크해요. (해양경찰학과에서 배우는 기본 안전 수칙)</p>');
    const items = ['구명조끼를 입었어요', '미끄럽지 않은 신발을 신었어요', '파도가 높거나 미끄러운 곳에는 가지 않아요', '위험한 곳에서 혼자 낚시하지 않아요'];
    const ok = h('button', 'btn primary big', '✅ 점검 완료 (+5점)'); ok.disabled = true; let done = false;
    const boxes = items.map((t) => { const l = h('label', 'fxchk'), c = document.createElement('input'); c.type = 'checkbox'; c.onchange = () => { ok.disabled = !boxes.every((x) => x.checked); }; l.append(c, ' ' + t); box.append(l); return c; });
    ok.onclick = () => { done = true; f.safe = 1; addScore(5); closeModal(); cb(); };
    box.append(ok); modal(box, { onClose: () => { if (!done && cancel) cancel(); } });
  }
  function startFoot(spot) {
    safety(() => {
      F.kind = 'foot'; F.sub = 'fish'; F.spot = spot; F.zone = { zone: spot.zone, isl: null, label: spot.n, protect: false }; F.aim = spot.yaw; F.st = 'idle';
      P.x = spot.x; P.z = spot.z; P.y = 0; P.yaw = spot.yaw; cam.dist = 6.5; cam.pitch = .3; setMode('fish'); showUI(); rod.visible = true; try { place(); } catch (e) { /* 무시 */ }
      toast(isTouch ? '화면을 밀어 방향 · 🎣 꾹 눌렀다 놓으면 던져요' : '마우스 드래그/←→ 방향 · Space(또는 🎣) 꾹 눌렀다 놓아 던지기', 4200);
    }, () => { TN.on = false; });
  }
  function boardBoat() {
    safety(() => {
      F.kind = 'boat'; F.sub = 'sail'; F.spot = null; F.zone = null; F.st = 'idle'; B.aboard = true; B.anchored = false; B.thr = 0; B.auto = null;
      cam.dist = 17; cam.pitch = .34; setMode('fish'); showUI(); rod.visible = false; try { engine.start(); } catch (e) { /* 무시 */ }
      toast('⛵ 승선! 🗺 지도로 섬을 고르면 자동 항해해요 · ◀▶ 조타 · ▲▼ 속도', 5200);
    });
  }
  function disembark() {
    if (!B.docked) return; B.aboard = false; B.anchored = false; P.x = 1.7; P.z = 40; P.y = 0; P.yaw = PI2; cam.yaw = PI2; stopAll(true);
  }
  function exitPressed() {
    if (F.kind === 'boat') {
      if (F.sub === 'fish') { anchorPressed(); return; }
      if (B.docked) { disembark(); return; }
      if (!B.dock) { B.auto = { x: PORT_IN.x, z: PORT_IN.z, r: 12, port: true, n: '여수항' }; toast('🏠 자동으로 귀항해요 (🗺 지도에서 다른 곳도 고를 수 있어요)', 3000); }
      return;
    }
    if (TN.on) endTournament(); else stopAll(true);
  }
  function anchorPressed() {
    if (F.kind !== 'boat') return;
    if (F.sub === 'sail') {
      if (B.dock) return; B.auto = null; B.thr = 0;
      if (B.v > 2.5) { B.want = true; toast('속도를 줄이는 중… 멈추면 닻을 내려요', 2200); } else dropAnchor();
    } else { if (F.st === 'fight' || F.st === 'card') { toast('지금은 닻을 올릴 수 없어요'); return; } raiseAnchor(); }
  }
  function dropAnchor() {
    F.sub = 'fish'; F.st = 'idle'; B.anchored = true; B.thr = 0; B.v = 0; B.want = false; B.auto = null; B.docked = B.docked && Math.hypot(B.x - 10, B.z - 40) < 1.5;
    F.zone = zoneAt(B.x, B.z); F.aim = B.h; cam.dist = 7.5; cam.pitch = .28; rod.visible = true; try { engine.stop(); } catch (e) { /* 무시 */ }
    toast(`⚓ ${F.zone.label}에 닻을 내렸어요`, 2400);
    if (F.zone.protect) toast('🔭 보호 구역이에요. 낚시 대신 🔭 버튼으로 관찰해요', 4000);
  }
  function raiseAnchor() {
    hideLine(); ringL.visible = false; rip.visible = false; F.st = 'idle'; F.sub = 'sail'; B.anchored = false; rod.visible = false; cam.dist = 17; cam.pitch = .34;
    try { engine.start(); } catch (e) { /* 무시 */ } toast('⚓ 닻을 올렸어요');
  }

  /* ═════════ 낚시 동작 ═════════ */
  const aimBy = (d) => { F.aim += d; if (F.kind === 'foot' && F.spot) F.aim = F.spot.yaw + clamp(wrapA(F.aim - F.spot.yaw), -1.2, 1.2); };
  const castDist = (pw) => { const mx = F.kind === 'boat' ? 30 : F.spot && F.spot.zone === 'pier' ? 26 : 20; return 5 + pw * (mx - 5); };
  function onAct() {
    if (F.sub === 'sail') return;
    if (F.zone && F.zone.protect) { observe(); return; }
    if (F.st === 'idle') { F.st = 'charge'; F.pw = 0; ringL.visible = true; snd('click'); }
    else if (F.st === 'wait') { hideLine(); F.st = 'idle'; toast('찌를 거뒀어요. 입질 신호(찌가 쑥 들어감)를 기다려요', 2200); }
    else if (F.st === 'bite') hook();
  }
  function observe() {
    if (F.obsCd > 0) return; F.obsCd = 3; toast(pick(OBSF), 4200); const f = fs(); if (f.obs < 10) { f.obs++; addScore(2); }
  }
  function cast() {
    ringL.visible = false;
    if (F.pw < .08) { F.st = 'idle'; return; }
    const d = castDist(F.pw), tx = P.x + Math.sin(F.aim) * d, tz = P.z + Math.cos(F.aim) * d;
    if (!isWater(tx, tz)) { F.st = 'idle'; toast('물이 아닌 곳이에요. 방향을 바꿔 봐요', 2200); return; }
    F.tgt = { x: tx, z: tz }; F.from = rodTip(); F.st = 'fly'; F.t = 0; bob.visible = line.visible = true; bob.position.copy(F.from); snd('click'); vib(15);
  }
  function rollCatch() {
    const z = F.zone || { zone: 'pier', isl: null };
    if (Math.random() < (z.zone === 'deep' ? .03 : .07)) return { junk: pick(JUNK) };
    const pl = pool(z.zone, z.isl), tot = pl.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot, sp = pl.find((x) => x[1] > 0)[0];
    for (const [s, w] of pl) { if (w > 0 && (r -= w) < 0) { sp = s; break; } }
    let len = sp.lo + (sp.hi - sp.lo) * Math.pow(Math.random(), 1.7); if (Math.random() < .04) len = sp.hi * rnd(.95, 1.04);
    len = sp.u === 'g' ? Math.round(len / 5) * 5 : Math.round(len * 10) / 10; return { sp, len };
  }
  function beginBite() {
    F.fi = rollCatch(); F.st = 'bite'; const pw = F.fi.sp ? F.fi.sp.pw : .5; F.bt = Math.max(DIFF.biteMin, DIFF.biteBase - .3 * pw); F.rip = 1; rip.position.set(F.tgt.x, SEA_Y + .07, F.tgt.z); rip.visible = true; vib(70); snd('click');
  }
  function hook() {
    const fi = F.fi, sp = fi.sp, frac = sp ? fracOf(sp, fi.len) : .2, pw = (sp ? sp.pw : .5) * (.75 + .5 * frac);
    F.f = { pw, d0: 7 + frac * 4 + pw * 1.5, T: 10, run: false, t: rnd(1.0, 2.0), reel: DIFF.reel / (.65 + .35 * pw), slack: 0 }; F.f.dist = F.f.d0; F.st = 'fight';
    const s = .5 + frac * 1.1; fshadow.scale.set(s * 1.5, s * .6, 1); fshadow.visible = true; vib(40); snd('ok');
  }
  function lose(msg, snap) { hideLine(); F.st = 'idle'; F.fi = null; toast(msg, 2800); snd('hurt'); vib(snap ? 80 : 30); }
  function fightStep(dt, t) {
    const f = F.f, hd = hold.act; f.t -= dt;
    f.slack = f.slack || 0;
    if (f.t <= 0) { f.run = !f.run; f.t = f.run ? rnd(.9, 1.8) * (.8 + .3 * f.pw) : rnd(1.2, 2.6) / (.7 + .3 * f.pw); if (f.run) vib(40); }
    if (f.run) { f.T += hd ? 54 * f.pw * dt : -30 * dt; f.dist += (hd ? .25 : DIFF.runPull) * f.pw * dt; }
    else { f.T += hd ? (DIFF.rise[0] + DIFF.rise[1] * f.pw) * dt : -DIFF.fall * dt; if (hd) f.dist -= f.reel * dt; else f.dist += DIFF.idlePull * f.pw * dt; }
    if (!f.run && !hd && f.T < 6) f.slack += dt; else f.slack = Math.max(0, f.slack - dt * .5);
    if (f.slack > DIFF.slack) { lose('줄이 느슨해서 바늘이 빠졌어요! 너무 오래 손을 떼면 안 돼요.'); return; }
    f.T = clamp(f.T, 0, 100);
    if (f.T >= 100) { lose('줄이 끊어졌어요! 물고기가 도망갈 땐 손을 떼야 해요.', true); return; }
    if (f.dist <= .8) { landed(); return; }
    if (f.dist > f.d0 + 14) { lose('물고기가 줄을 끌고 도망갔어요…'); return; }
    const tip = rodTip(), k = f.dist / f.d0, sh = f.run ? Math.sin(t * 25) * .25 : 0;
    bob.position.set(tip.x + (F.tgt.x - tip.x) * k + sh, SEA_Y + .06, tip.z + (F.tgt.z - tip.z) * k + sh * .6); fshadow.position.set(bob.position.x, SEA_Y + .05, bob.position.z);
  }

  /* ═════════ 도감 · 점수 · 카드 ═════════ */
  function dexAdd(sp, len) {
    const f = fs(), e = f.dex[sp.id] || (f.dex[sp.id] = { n: 0, best: 0, rel: 0, take: 0 }); const isNew = e.n === 0; e.n++; if (len > e.best) e.best = len;
    if (isNew) getS().coins += 2; return isNew;
  }
  function landed() {
    const fi = F.fi; hideLine(); F.st = 'card'; hold.act = false; vib(40); snd('pickup');
    if (fi.junk) { const f = fs(); f.trash++; addScore(4); toast(`${fi.junk.ic} ${fi.junk.n} 수거! 바다가 깨끗해져요 (+4점)`, 2800); F.st = 'idle'; return; }
    if (TN.on) { tournCatch(fi); return; }
    showCard(fi);
  }
  function applyDecision(sp, len, lg, how) {
    const f = fs(), e = f.dex[sp.id], base = tpts(sp, len), bad = lg.small || lg.ban; let add = 0, msg = '';
    if (how === 'rel') {
      e.rel++; f.rel++;
      if (bad) { f.relBad++; add = Math.round(base * .4) + 10; msg = '👍 올바른 선택! 어린 물고기·금어기는 돌려보내요'; } else { add = Math.round(base * .6) + 3; msg = '🌊 잘 가! 바다 자원을 지켰어요'; }
    } else if (sp.poison) { e.rel++; msg = '☠️ 독 있는 물고기는 가져가지 않아요. 돌려보냈어요'; }
    else if (bad) { f.viol++; e.rel++; add = -15; msg = `🚨 ${lg.ban ? '금어기' : '금지체장 이하'} 포획은 단속 대상이에요! 바다로 돌려보내요`; }
    else { e.take++; f.take++; add = base; getS().coins += sp.r >= 3 ? 2 : 1; msg = `🧺 ${sp.n} 가져가기`; }
    addScore(add); toast(`${msg} (${add >= 0 ? '+' : ''}${add}점)`, 3400);
  }
  function showCard(fi) {
    const sp = fi.sp, len = fi.len, lg = legalOf(sp, len), isNew = dexAdd(sp, len), e = fs().dex[sp.id];
    const chip = sp.poison ? ['poi', '☠️ 독이 있어요 — 가져갈 수 없어요 (방생)'] : lg.small ? ['bad', `⚠️ 금지체장 이하 (${minTxt(sp)}) — 반드시 방생!`] : lg.ban ? ['bad', '⚠️ 지금은 금어기 — 반드시 방생!'] : ['ok', '✅ 포획 가능한 크기예요'];
    const box = h('div', 'fxcard');
    box.innerHTML = `<div class="fxic">${sp.ic}</div><h2>${sp.n}${isNew ? ' <span class="fxnew">NEW!</span>' : ''}</h2><div class="fxrow">${'★'.repeat(sp.r)} ${RN[sp.r]}${peakOf(sp) ? ' · 🌟 지금이 제철' : ''}</div>
<div class="fxbig">${LENL[sp.u]} ${fmtL(sp, len)}</div><div class="fxchip ${chip[0]}">${chip[1]}</div><p class="fxfact">${sp.fact}</p>
<div class="fxsmall">📏 금지체장: ${minTxt(sp)}${sp.ban ? ` · 금어기: ${mTxt([sp.ban])}` : ''}<br>🎓 연계 학과: ${sp.d}${e.best === len && e.n > 1 ? '<br>🏅 내 최고 기록!' : ''}</div>`;
    const row = h('div', 'row'), rel = h('button', 'btn primary big', '🌊 놓아주기'), tk = h('button', 'btn big', '🧺 가져가기'); let done = false;
    const decide = (how) => { if (done) return; done = true; applyDecision(sp, len, lg, how); F.st = 'idle'; closeModal(); };
    rel.onclick = () => decide('rel'); tk.onclick = () => decide('take'); row.append(rel, tk); box.append(row);
    modal(box, { onClose: () => { if (!done) { done = true; applyDecision(sp, len, lg, 'rel'); F.st = 'idle'; } } });
  }

  /* ═════════ 대회 ═════════ */
  function tournCatch(fi) {
    const sp = fi.sp, lg = legalOf(sp, fi.len); dexAdd(sp, fi.len);
    if (lg.small || lg.ban || sp.poison) toast(`${sp.ic} ${sp.n} ${fmtL(sp, fi.len)} — ${sp.poison ? '독' : lg.small ? '금지체장' : '금어기'}라 방생! (점수 없음)`, 2200);
    else { const p = tpts(sp, fi.len); TN.pts += p; TN.n++; if (!TN.best || p > TN.best.p) TN.best = { sp, len: fi.len, p }; toast(`${sp.ic} ${sp.n} ${fmtL(sp, fi.len)} +${p}점`, 1800); }
    F.st = 'idle';
  }
  function openTournament() {
    const box = h('div', '', '<h2>🏆 3분 낚시 대회</h2><p>부두 끝에서 3분 동안 최대한 많이 잡아요.<br>• 금지체장 이하·금어기·독 있는 물고기는 <b>점수 없이 방생</b>돼요.<br>• 크기가 크고 희귀할수록 점수가 높아요.<br>• 대회 중에는 물고기 카드 없이 자동으로 정리돼요.</p>');
    const row = h('div', 'row'), go = h('button', 'btn primary big', '🎣 대회 시작'), no = h('button', 'btn', '취소');
    go.onclick = () => { closeModal(); TN.on = true; TN.left = 180; TN.pts = 0; TN.n = 0; TN.best = null; startFoot(SPOTS.find((s) => s.id === 'h2')); }; no.onclick = closeModal; row.append(go, no); box.append(row); modal(box);
  }
  function endTournament() {
    if (!TN.on) return; TN.on = false; stopAll(true);
    const f = fs(), pts = TN.pts, rank = pts >= 200 ? '🥇 낚시왕' : pts >= 120 ? '🥈 베테랑' : pts >= 60 ? '🥉 숙련자' : '🎣 참가상', coin = Math.floor(pts / 15);
    getS().coins += coin; if (pts > f.tnBest) f.tnBest = pts; addScore(Math.round(pts * .3));
    const box = h('div', '', `<h2>🏆 낚시 대회 결과</h2><div class="fxbig">${pts}점</div><p>${rank} · ${TN.n}마리${TN.best ? `<br>최고 기록: ${TN.best.sp.ic} ${TN.best.sp.n} ${fmtL(TN.best.sp, TN.best.len)} (+${TN.best.p})` : ''}<br>🪙 +${coin} · 내 대회 최고 ${f.tnBest}점</p>`);
    const b = h('button', 'btn primary', '확인'); b.onclick = closeModal; box.append(b); modal(box);
  }

  /* ═════════ 도감 창 ═════════ */
  function openDex() {
    const f = fs(), box = h('div', 'fxdex'); let flt = 'all', view = null;
    const FL = [['all', '전체', () => true], ['shore', '부두·안벽', (s) => s.z.includes('pier') || s.z.includes('quay')], ['rock', '갯바위', (s) => s.z.includes('rock')], ['sand', '갯벌·모래', (s) => s.z.includes('sand')],
      ['sea', '바다·섬', (s) => s.z.includes('near') || s.z.includes('island')], ['deep', '먼바다', (s) => s.z.includes('deep')], ['ceph', '오징어·문어', (s) => s.ic === '🦑' || s.ic === '🐙']];
    const render = () => {
      box.innerHTML = '';
      if (view) {
        const sp = view, e = f.dex[sp.id], got = !!e;
        box.append(h('h2', '', `${got ? sp.ic : '❔'} ${got ? sp.n : '아직 못 잡았어요'}`));
        const at = sp.at.length ? ` · 특히 많은 곳: ${sp.at.map((id) => (ISL.find((i) => i.id === id) || {}).n).join(', ')}` : '';
        box.append(h('div', 'fxsmall', `${'★'.repeat(sp.r)} ${RN[sp.r]}<br>📍 서식: ${sp.z.map((z) => ZN[z]).join(', ')}${at}<br>🌟 제철: ${mTxt(sp.pk)}`
          + (got ? `<br>📏 금지체장: ${minTxt(sp)}${sp.ban ? ` · 금어기: ${mTxt([sp.ban])}` : ''}<br>🎓 연계 학과: ${sp.d}<br>🏅 최고 ${fmtL(sp, e.best)} · 잡은 횟수 ${e.n} · 방생 ${e.rel} · 가져감 ${e.take}` : '<br>힌트를 보고 찾아가 봐요!')));
        if (got) box.append(h('p', 'fxfact', sp.fact));
        const bk = h('button', 'btn primary', '◀ 목록'); bk.onclick = () => { view = null; render(); }; box.append(bk); return;
      }
      const known = SP.filter((s) => f.dex[s.id]).length;
      box.append(h('h2', '', `📖 어류 도감 <small>${known} / ${SP.length}</small>`), h('div', 'bar', `<i style="width:${(known / SP.length) * 100}%"></i>`));
      const fb = h('div', 'flt'); FL.forEach(([k, t]) => { const b = h('button', 'btn small' + (flt === k ? ' primary' : ''), t); b.onclick = () => { flt = k; render(); }; fb.append(b); }); box.append(fb);
      const fn = FL.find((x) => x[0] === flt)[2], gr = h('div', 'grid');
      SP.filter(fn).forEach((sp) => { const got = f.dex[sp.id], t = h('div', 'fxt' + (got ? '' : ' off'), `<b>${got ? sp.ic : '❔'}</b><small>${got ? sp.n : '???'}</small><i>${'★'.repeat(sp.r)}</i>`); t.onclick = () => { view = sp; render(); }; gr.append(t); });
      box.append(gr);
      const hints = []; if (f.relBad >= 3) hints.push('스마트수산자원관리학과'); if (f.trash >= 3) hints.push('해양융합과학과'); if (f.safe) hints.push('해양경찰학과'); if (known >= 12) hints.push('양식생물학과·수산생명의학과'); if (f.take >= 5) hints.push('해양바이오식품학과');
      box.append(h('div', 'fxprof', `<b>🌱 책임 있는 낚시 기록</b><br>🌊 방생 ${f.rel}마리 (금지체장·금어기 방생 ${f.relBad}) · 🚨 위반 ${f.viol} · 🧹 쓰레기 수거 ${f.trash}<br>🦺 안전 점검 ${f.safe ? '완료' : '미완료'} · 🏆 대회 최고 ${f.tnBest}점 · 🎣 점수 ${f.score | 0}점<br>🎓 어울릴 수 있는 학과 힌트: ${hints.length ? hints.join(', ') : '더 낚시해 보면 나타나요'}<br><small>※ 이번 달(${MONTH}월) 기준 제철·금어기가 반영돼요.</small>`));
      const cl = h('button', 'btn primary', '닫기'); cl.onclick = closeModal; box.append(cl);
    };
    render(); modal(box, { wide: true });
  }

  /* ═════════ 지도(섬 이동) ═════════ */
  function openChart() {
    if (F.kind !== 'boat' || B.dock) return;
    const box = h('div', '', '<h2>🗺 여수 바다 지도</h2><p class="fxsmall">섬을 고르면 자동 항해로 이동해요. (거리는 게임용으로 줄이고 위치는 단순화했어요) 도착하면 ⚓ 닻을 내리고 낚시해요.</p>');
    const list = h('div', 'fxlist');
    const dest = [{ n: '여수항 (귀항)', ic: '🏠', x: PORT_IN.x, z: PORT_IN.z, r: 12, port: true, tag: '접안·하선', note: '낚시를 마치고 부두로 돌아가요.', hot: '' }]
      .concat(ISL.map((I) => ({ n: I.n, ic: I.ic, x: I.ax, z: I.az, r: 10, tag: I.tag, note: I.note, hot: I.protect ? '🔭 관찰만 (낚시 금지)' : '🎣 ' + hotNames(I) })))
      .concat([{ n: DEEP_DEST.n, ic: DEEP_DEST.ic, x: DEEP_DEST.x, z: DEEP_DEST.z, r: 14, tag: DEEP_DEST.tag, note: DEEP_DEST.note, hot: '🎣 ' + pool('deep', null).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0].n).join('·') }]);
    dest.forEach((d) => {
      const dist = Math.round(Math.hypot(d.x - B.x, d.z - B.z)), row = h('div', 'fxli', `<div><b>${d.ic} ${d.n}</b> · ${dist}m <small>(${d.tag})</small><br><small>${d.note}</small>${d.hot ? `<br><small>${d.hot}</small>` : ''}</div>`);
      const go = h('button', 'btn primary small', '⛵ 가기'); go.onclick = () => { closeModal(); if (F.sub === 'fish') { if (F.st === 'fight') return; raiseAnchor(); } B.auto = { x: d.x, z: d.z, r: d.r, port: !!d.port, n: d.n }; toast(`⛵ ${d.n}(으)로 자동 항해! 조타·속도 버튼을 누르면 수동으로 바뀌어요`, 3600); };
      row.append(go); list.append(row);
    });
    const cl = h('button', 'btn', '닫기'); cl.onclick = closeModal; box.append(list, cl); modal(box);
  }

  /* ═════════ 배 운항 ═════════ */
  const SPD = [0, 6, 14, 26], PR = [[4.2, 2.1], [0, 2.5], [-4.2, 2.1]];
  function resolveBoat() {
    let hit = false;
    for (const [off, pr] of PR) {
      let px = B.x + Math.sin(B.h) * off, pz = B.z + Math.cos(B.h) * off;
      for (const c of OBS_C) { const dx = px - c.x, dz = pz - c.z, m = c.r + pr, d2 = dx * dx + dz * dz; if (d2 < m * m) { const d = Math.sqrt(d2) || .001, k = (m - d) / d; B.x += dx * k; B.z += dz * k; px += dx * k; pz += dz * k; hit = true; } }
      for (const w of OBS_R) {
        const qx = clamp(px, w.x0, w.x1), qz = clamp(pz, w.z0, w.z1), dx = px - qx, dz = pz - qz, d2 = dx * dx + dz * dz;
        if (d2 < pr * pr) { if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (pr - d) / d; B.x += dx * k; B.z += dz * k; px += dx * k; pz += dz * k; } else { B.z += w.z1 - pz + pr + .1; } hit = true; }
      }
    }
    return hit;
  }
  function boatStep(dt, t) {
    if (B.dock) {
      const D2 = B.dock; D2.t += dt / 4.5; const u = Math.min(1, D2.t), e = u * u * (3 - 2 * u);
      B.x = lerp(D2.x0, 10, e); B.z = lerp(D2.z0, 40, e); B.h = D2.h0 + wrapA(0 - D2.h0) * e; B.v = 0; B.thr = 0;
      if (u >= 1) { B.dock = null; B.docked = true; B.x = 10; B.z = 40; B.h = 0; try { engine.stop(); } catch (e2) { /* 무시 */ } toast('🏠 접안 완료! 🚶 버튼으로 하선해요', 3500); snd('ok'); }
      return;
    }
    let tn = (hold.left ? 1 : 0) - (hold.right ? 1 : 0);
    if (tn !== 0) B.auto = null;
    if (B.auto) {
      const a = B.auto, dx = a.x - B.x, dz = a.z - B.z, d = Math.hypot(dx, dz); B.autoD = d;
      if (d < a.r) {
        B.auto = null; B.thr = 0; snd('ok');
        if (a.port) { B.dock = { t: 0, x0: B.x, z0: B.z, h0: B.h }; toast('⚓ 여수항에 접안하는 중…', 2500); } else toast(`📍 ${a.n} 도착! ⚓ 버튼으로 닻을 내리고 낚시해요`, 4200);
      } else {
        let want = Math.atan2(dx, dz), blocked = false;
        for (const L of [22, 46]) {
          const px = B.x + Math.sin(B.h) * L, pz = B.z + Math.cos(B.h) * L;
          for (const c of OBS_C) if (Math.hypot(px - c.x, pz - c.z) < c.r + 12) { const lat = (c.x - B.x) * Math.cos(B.h) - (c.z - B.z) * Math.sin(B.h); want = B.h - (lat >= 0 ? 1 : -1) * .8; blocked = true; break; }
          if (blocked) break;
        }
        tn = clamp(wrapA(want - B.h) * 2.4, -1, 1); B.thr = blocked ? 1 : d > 90 ? 3 : d > 40 ? 2 : 1;
      }
    }
    B.rud += (tn - B.rud) * Math.min(1, 3.5 * dt);
    B.v += (SPD[B.thr] - B.v) * Math.min(1, .8 * dt);
    B.h += B.rud * .9 * Math.min(1, .25 + B.v / 6) * dt;
    B.x += Math.sin(B.h) * B.v * dt; B.z += Math.cos(B.h) * B.v * dt;
    if (B.v > .5) B.docked = false;
    B.cd = Math.max(0, B.cd - dt);
    if (resolveBoat()) { B.v *= .55; if (B.cd <= 0) { B.cd = 1.5; snd('bump'); vib(50); toast('쿵! 섬이나 부두에 부딪혔어요. 속도를 줄여요', 1800); } }
    const rr = Math.hypot(B.x, B.z); if (rr > 970) { B.x *= 970 / rr; B.z *= 970 / rr; B.v *= .97; }
    if (B.want && B.v < 2.5) { B.want = false; dropAnchor(); }
    try { engine.set(B.v * 1.1); } catch (e) { /* 무시 */ }
  }

  /* ═════════ 매 프레임 ═════════ */
  function fishStep(dt, t) {
    if (hold.left) aimBy(1.5 * dt); if (hold.right) aimBy(-1.5 * dt);
    F.obsCd = Math.max(0, F.obsCd - dt);
    if (F.rip > 0) { F.rip -= dt * 1.5; rip.material.opacity = Math.max(0, F.rip) * .8; const s = 1 + (1 - F.rip) * 3; rip.scale.set(s, s, s); rip.visible = F.rip > 0; }
    switch (F.st) {
      case 'charge': {
        F.pw = Math.min(1, F.pw + dt / 1.3); const d = castDist(F.pw), rx = P.x + Math.sin(F.aim) * d, rz = P.z + Math.cos(F.aim) * d, k = 1 + Math.sin(t * 8) * .08;
        ringL.position.set(rx, SEA_Y + .06, rz); ringL.scale.set(k, k, k); ringL.material.color.set(isWater(rx, rz) ? '#ffd34d' : '#ff5a4d'); break;
      }
      case 'fly': {
        F.t += dt / .6; const u = Math.min(1, F.t), a = F.from;
        bob.position.set(lerp(a.x, F.tgt.x, u), lerp(a.y, SEA_Y + .05, u) + Math.sin(Math.PI * u) * 3.5, lerp(a.z, F.tgt.z, u));
        if (u >= 1) {
          F.st = 'wait'; F.t = 0; F.wait = rnd(DIFF.wait[0], DIFF.wait[1]); F.nib = [F.wait * rnd(.25, .4)]; if (Math.random() < .5) F.nib.push(F.wait * rnd(.55, .75)); F.nibI = 0; F.tw = 0;
          F.rip = 1; rip.position.set(F.tgt.x, SEA_Y + .07, F.tgt.z); rip.visible = true; snd('click');
        }
        break;
      }
      case 'wait': {
        F.t += dt; let tw = 0; if (F.tw > 0) { F.tw -= dt; tw = Math.sin(F.tw * 30) * .09 * Math.min(1, F.tw * 3); }
        while (F.nibI < F.nib.length && F.t >= F.nib[F.nibI]) { F.nibI++; F.tw = .55; F.rip = 1; rip.position.set(F.tgt.x, SEA_Y + .07, F.tgt.z); rip.visible = true; vib(15); }
        bob.position.set(F.tgt.x, SEA_Y + .06 + Math.sin(t * 2.2) * .04 - Math.abs(tw), F.tgt.z);
        if (F.t >= F.wait) beginBite(); break;
      }
      case 'bite': {
        bob.position.set(F.tgt.x, SEA_Y - .22 + Math.sin(t * 40) * .05, F.tgt.z); F.bt -= dt;
        if (F.bt <= 0) lose('앗, 너무 늦었어요. 물고기가 미끼만 먹고 갔어요'); break;
      }
      case 'fight': fightStep(dt, t); break;
      default: break;
    }
  }
  function syncPlayer(dt, t) {
    if (F.kind === 'boat') {
      const off = -2.2; P.x = B.x + Math.sin(B.h) * off; P.z = B.z + Math.cos(B.h) * off; P.y = SEA_Y + 1.7 + Math.sin(t * 1.3) * .08;
      if (F.sub === 'sail') { cam.yaw = lerpA(cam.yaw, B.h, 1 - Math.exp(-2.5 * dt)); P.yaw = B.h; } else { cam.yaw = F.aim; P.yaw = F.aim; }
    } else { P.y = 0; cam.yaw = F.aim; P.yaw = F.aim; }
    P.vx = P.vz = 0; try { place(); } catch (e) { /* 무시 */ }
    if (F.sub === 'fish') {
      const bend = F.st === 'fight' ? .3 * (F.f.T / 100) : F.st === 'charge' ? .22 * F.pw : 0;
      rod.position.set(P.x + Math.sin(F.aim) * .45, P.y + 1.05, P.z + Math.cos(F.aim) * .45); rod.rotation.set(.95 - bend, F.aim, 0);
      if (bob.visible) updateLine(F.st === 'fight' ? .1 + (1 - F.f.T / 100) * .3 : F.st === 'fly' ? .2 : .5);
    }
  }
  function uiUpdate() {
const sail = F.sub === 'sail', boat = F.kind === 'boat', prot = !!(F.zone && F.zone.protect);
    ui.classList.toggle('sail', sail);
    if (!window.__fxPinT) window.__fxPinT = setInterval(() => {
      const u = document.getElementById('fx'); if (!u) return;
      const on = u.classList.contains('sail'), b = u.querySelector('.exit'); if (!b) return;
      const S = { left: 'auto', bottom: 'auto', right: '14px', top: 'calc(50% - 30px)', width: '60px', height: '60px' };
      for (const k in S) { if (on) b.style.setProperty(k, S[k], 'important'); else b.style.removeProperty(k); }
    }, 100);
    setV(E.up, sail && !B.dock); setV(E.down, sail && !B.dock); setV(E.left, F.sub === 'fish' || (sail && !B.dock)); setV(E.right, F.sub === 'fish' || (sail && !B.dock));
    setV(E.act, F.sub === 'fish'); setV(E.chart, boat && !B.dock); setV(E.anchor, boat && !B.dock && !(sail && B.docked));
    setH(E.act, prot ? '🔭' : '🎣'); setH(E.anchor, sail ? '⚓<small>내리기</small>' : '⚓<small>올리기</small>');
    setH(E.exit, boat ? (sail && B.docked ? '🚶<small>하선</small>' : sail ? '🏠<small>귀항</small>' : '✖<small>그만</small>') : '✖<small>그만</small>');
    setT(E.t1, boat ? `⛵ 낚싯배${F.zone && !sail ? ' · ' + F.zone.label : ''}` : F.spot ? F.spot.n : '');
    if (sail) setT(E.t2, B.dock ? '접안 중…' : `속도 ${Math.round(B.v * 1.9)}노트 · ${B.auto ? `자동항해 → ${B.auto.n} ${Math.round(B.autoD)}m` : '수동 조타'} · ${B.docked ? '부두 접안 중' : '🗺 지도로 섬 선택'}`);
    else setT(E.t2, `${F.zone ? ZN[F.zone.zone] : ''} · ${MONTH}월 제철 ${SP.filter((s) => peakOf(s) && s.z.includes(F.zone ? F.zone.zone : 'pier')).slice(0, 3).map((s) => s.n).join('·') || '—'}`);
    setV(E.tn, TN.on, 'block'); if (TN.on) setT(E.tn, `⏱ ${Math.ceil(TN.left)}초 · 🏆 ${TN.pts}점 · ${TN.n}마리`);
    let m = '';
    if (sail) m = B.dock ? '' : B.docked ? '⛵ 🗺 지도에서 가고 싶은 섬을 골라요' : B.auto ? '자동 항해 중… 버튼을 누르면 수동으로 바뀌어요' : '◀▶ 조타 · ▲▼ 속도 · 멈추면 ⚓ 닻을 내려요';
    else if (prot) m = '🔭 보호 구역이에요 · 버튼을 눌러 관찰해요';
    else if (F.st === 'idle') m = isTouch ? '화면을 밀어 방향 정하고 🎣 꾹 눌렀다 놓아요' : '드래그/←→ 방향 · Space 꾹 눌렀다 놓아 던지기';
    else if (F.st === 'charge') m = '힘을 모으는 중… 놓으면 던져요';
    else if (F.st === 'wait') m = '기다려요… 찌가 움찔하면 예고, 쑥 들어가면 챔질!';
    else if (F.st === 'bite') m = '❗ 지금 챔질! 🎣을 눌러요';
    else if (F.st === 'fight') m = F.f.run ? '🐟 도망쳐요! 손을 떼요!' : '감아요! 꾹 누르세요';
    setT(E.msg, m);
    const gOn = F.st === 'charge' || F.st === 'fight'; E.gauge.classList.toggle('on', gOn);
    if (F.st === 'charge') { E.gb.classList.add('pw'); setT(E.gl, '던지는 힘'); E.gn.style.left = F.pw * 100 + '%'; E.gb2.style.display = 'none'; }
    else if (F.st === 'fight') { E.gb.classList.remove('pw'); setT(E.gl, F.f.run ? '장력 — 달릴 땐 손 떼기!' : '장력 — 빨강 전에 놓기'); E.gn.style.left = F.f.T + '%'; E.gb2.style.display = 'block'; E.gf.style.width = clamp((1 - F.f.dist / (F.f.d0 + 14)) * 100, 0, 100) + '%'; }
  }

  function animate(dt, t) {
    sea.position.set(Math.round(P.x / 20) * 20, SEA_Y, Math.round(P.z / 20) * 20); seaTex.offset.set(t * .012, t * .007);
    for (const f of FADES) { const d = Math.hypot(P.x - f.s.position.x, P.z - f.s.position.z), k = clamp((d - f.near) / (f.far - f.near), 0, 1); f.s.material.opacity = k; f.s.visible = k > .03; }
    if (SEAFX) SEAFX.update(t, P.x, P.z, B);
    if (SKYFX) SKYFX.update(t, P.x, P.y, P.z);
    fishSh.forEach((f) => { const a = t * f.sp + f.ph; f.m.position.set(f.cx + Math.cos(a) * f.r, SEA_Y + .03, f.cz + Math.sin(a) * f.r * .6); f.m.rotation.y = -a + (f.sp > 0 ? Math.PI / 2 : -Math.PI / 2); });
    SHIPS.forEach((s) => { s.g.position.y = SEA_Y + .15 + Math.sin(t * 1.1 + s.ph) * .06; s.g.rotation.z = Math.sin(t * .9 + s.ph) * .012; });
    B.g.position.set(B.x, SEA_Y + .15 + Math.sin(t * 1.3) * .08, B.z); B.g.rotation.set(Math.sin(t * .9) * .012, B.h, -B.rud * B.v * .008 + Math.sin(t * 1.1) * .02);
    spotRings.forEach((m, i) => { const k = 1 + Math.sin(t * 3 + i) * .06; m.scale.set(k, k, k); });
    if (W._portalRing) W._portalRing.rotation.y = t * 1.2;
  }
  W.update = (dt, t) => {
    animate(dt, t);
    if (!F.on || getMode() !== 'fish') return;
    if (TN.on) { TN.left -= dt; if (TN.left <= 0) { endTournament(); return; } }
    if (F.sub === 'sail') boatStep(dt, t); else fishStep(dt, t);
    syncPlayer(dt, t); uiUpdate();
  };

  /* ═════════ 게임 연결 ═════════ */
  const IA = [];
  SPOTS.forEach((s) => IA.push({ x: s.x, z: s.z, r: 3.4, label: `[E] 🎣 낚시하기 · ${s.n} (${ZN[s.zone]})`, act: () => startFoot(s), hide: () => F.on }));
  IA.push({ x: -14, z: -14, r: 4.6, label: '[E] 📖 어류 도감 보기', act: openDex, hide: () => F.on });
  IA.push({ x: 14, z: -14, r: 4.6, label: '[E] 🏆 낚시 대회 (3분)', act: openTournament, hide: () => F.on });
  IA.push({ x: 1.8, z: 40, r: 4.2, label: '[E] ⛵ 낚싯배 타고 섬으로 (승선)', act: boardBoat, hide: () => F.on || !B.docked });
  function resetAll() {
    stopAll(false); TN.on = false; B.aboard = false; B.anchored = false; B.docked = true; B.dock = null; B.auto = null; B.thr = 0; B.v = 0; B.x = 10; B.z = 40; B.h = 0; B.want = false;
  }
  function onWorld(id) {
    resetAll();
    if (id === 'soccer') setTimeout(() => { try { toast('🎣 색깔 링 = 낚시 터 · 📖 도감 · 🏆 대회 · ⛵ 부두 오른쪽에서 낚싯배 승선!', 5200); } catch (e) { /* 무시 */ } }, 3800);
  }
  function mini(mx, X, Z, sc) {
    const c = X(0); mx.save(); mx.beginPath(); mx.arc(c, c, c - 2, 0, 7); mx.clip();
    mx.fillStyle = '#4f8a4a'; mx.fillRect(X(-1000), Z(-1000), 2000 * sc, 994 * sc);
    ISL.forEach((I) => { mx.fillStyle = I.protect ? '#9a8fb0' : '#5aa05a'; I.lobes.forEach((l) => { mx.beginPath(); mx.arc(X(l.x), Z(l.z), Math.max(2, l.r * sc), 0, 7); mx.fill(); }); });
    mx.fillStyle = '#c9a36a'; mx.fillRect(X(-3), Z(-6), Math.max(2, 6 * sc), 76 * sc);
    mx.fillStyle = '#ffd34d'; SPOTS.forEach((s) => { mx.fillRect(X(s.x) - 1, Z(s.z) - 1, 2, 2); });
    if (B.auto) { mx.strokeStyle = '#ffd34d'; mx.lineWidth = 2; mx.beginPath(); mx.arc(X(B.auto.x), Z(B.auto.z), 6, 0, 7); mx.stroke(); }
    if (!B.aboard) { mx.fillStyle = '#ffffff'; mx.fillRect(X(B.x) - 2, Z(B.z) - 2, 4, 4); }
    mx.restore();
  }
  window.__fish = () => ({ month: MONTH, on: F.on, kind: F.kind, sub: F.sub, st: F.st, zone: F.zone && F.zone.label, boat: { x: +B.x.toFixed(1), z: +B.z.toFixed(1), h: +B.h.toFixed(2), v: +B.v.toFixed(1), docked: B.docked, auto: !!B.auto }, species: SP.length, islands: ISL.length, colliders: colliders.length, fades: FADES.length, hold: ui.classList.contains('hold'), score: fs().score, mode: getMode() });
  return { interactables: () => IA, onWorld, mini, score: () => fs().score | 0 };
}
