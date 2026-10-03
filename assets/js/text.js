import { DB } from './data.js';

// 화면 문구는 코드에 두지 않는다 — 콘텐츠_화면문구.json에서 키로 읽는다(Text/strings.csv의 ui.키와 같은 키).
// 최종 문구는 GPT가 쓰고 데이터만 바꾼다. 코드는 자리만 안다.
// 키가 비면 키를 그대로 보여 준다 — 빠진 문구가 화면에서 바로 드러나게.
export function T(key, vars) {
  let node = DB.ui;
  for (const seg of key.split('.')) node = node == null ? undefined : node[seg];
  if (typeof node !== 'string') {
    console.warn(`화면 문구 없음: ui.${key}`);
    return `ui.${key}`;
  }
  return vars ? fill(node, vars) : node;
}

// innerHTML 템플릿에 넣을 때
export function TH(key, vars) {
  return escapeHTML(T(key, vars));
}

// 데이터 문구의 {이름} 자리 채우기 — 증거 데이터의 labels에도 쓴다
export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

export function escapeHTML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
