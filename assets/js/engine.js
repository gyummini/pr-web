// 자체 미니 대사 엔진 (명세서 4). 렌파이 손맛 체크리스트:
// 타이핑 이펙트 / 2단계 클릭 / CTC 깜빡임 / 스탠딩 디졸브 / 대사창 페이드 /
// 키보드 진행(Space·Enter) / 연타 방지(~100ms) / 화자명 네임태그
import { SPRITE_KEYS } from './sprites.js';

const TYPE_MS = 32;       // 글자당 출력 간격
const LOCK_MS = 110;      // 문장 완성 직후 진행 잠금
export const SPRITE_FADE_MS = 250; // 스탠딩 크로스페이드 (CSS와 동기)

export class DialogueEngine {
  constructor(root, { resolveSprite, mode = 'standing' } = {}) {
    this.root = root;
    this.resolveSprite = resolveSprite;
    this.mode = mode;
    this.lines = [];
    this.index = -1;
    this.typing = false;
    this.choiceShowing = false;
    this.holdEnd = false;
    this.lockUntil = 0;
    this.timer = null;
    this.currentSprite = null;
    this.destroyed = false;
    this.onChoice = null;
    this.onComplete = null;

    // 표정 4종을 전부 미리 렌더해 겹쳐두고 opacity만 전환한다.
    // src 교체 방식은 새 이미지 디코딩 동안 빈 프레임이 생기므로 사용하지 않는다.
    const layers = SPRITE_KEYS.map(
      (k) =>
        `<img class="spr" data-key="${k}" alt="" aria-hidden="true" decoding="async"${
          resolveSprite ? ` src="${resolveSprite(k)}"` : ''
        }>`
    ).join('');
    root.classList.add('dlg-scene', `dlg-${mode}`);
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="dlg-sprite">${layers}</div>
       <div class="dlg-box">
         <div class="dlg-name"></div>
         <div class="dlg-text"></div>
         <div class="dlg-ctc" aria-hidden="true">▼</div>
       </div>
       <div class="dlg-choice"></div>`
    );
    this.sprImgs = root.querySelectorAll('.dlg-sprite .spr');
    // 디코딩까지 미리 끝내둔다 (실패해도 무시)
    this.sprImgs.forEach((img) => {
      if (typeof img.decode === 'function') img.decode().catch(() => {});
    });
    this.box = root.querySelector('.dlg-box');
    this.nameEl = root.querySelector('.dlg-name');
    this.textEl = root.querySelector('.dlg-text');
    this.ctc = root.querySelector('.dlg-ctc');
    this.choiceEl = root.querySelector('.dlg-choice');

    this._onClick = () => this.advance();
    root.addEventListener('click', this._onClick);
    this._onKey = (e) => {
      if (this.destroyed || this.choiceShowing) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.advance();
      }
    };
    document.addEventListener('keydown', this._onKey);
  }

  play(lines, { onChoice, onComplete, holdEnd = false } = {}) {
    this.lines = lines;
    this.onChoice = onChoice || null;
    this.onComplete = onComplete || null;
    this.holdEnd = holdEnd;
    this.index = -1;
    // 대사창 등장 페이드 — rAF는 백그라운드 탭에서 멈추므로 setTimeout 사용
    setTimeout(() => this.box.classList.add('on'), 30);
    this._next();
  }

  // 재방문 처리: 대사 생략, 선택지만 표시 (스탠딩 normal 유지)
  playFromChoice(lines, { onChoice } = {}) {
    this.lines = lines;
    this.onChoice = onChoice || null;
    this.setSprite('normal');
    const ci = lines.findIndex((l) => l.type === 'choice');
    if (ci >= 0) {
      this.index = ci;
      this._showChoice(lines[ci]);
    }
  }

  // SKIP: 대사 전부 생략 → 선택지 블록으로 점프 (없으면 즉시 종료)
  skip() {
    if (this.destroyed || this.choiceShowing) return;
    clearInterval(this.timer);
    this.typing = false;
    const ci = this.lines.findIndex((l) => l.type === 'choice');
    if (ci >= 0) {
      this.setSprite('normal');
      this.index = ci;
      this._showChoice(this.lines[ci]);
    } else {
      this._finish();
    }
  }

  _next() {
    this.index++;
    const line = this.lines[this.index];
    if (line == null) {
      this._finish();
      return;
    }
    if (line.type === 'choice') {
      this._showChoice(line);
      return;
    }
    if (line.sprite) this.setSprite(line.sprite);
    this.nameEl.textContent = line.speaker || '';
    this.nameEl.style.visibility = line.speaker ? 'visible' : 'hidden';
    this._type(line.text || '');
  }

  _type(text) {
    clearInterval(this.timer);
    this.typing = true;
    this.ctc.classList.remove('on');
    this.full = text;
    let pos = 0;
    this.textEl.textContent = '';
    this.timer = setInterval(() => {
      pos++;
      this.textEl.textContent = text.slice(0, pos);
      if (pos >= text.length) this._doneTyping();
    }, TYPE_MS);
  }

  _doneTyping() {
    clearInterval(this.timer);
    this.timer = null;
    this.textEl.textContent = this.full;
    this.typing = false;
    this.lockUntil = performance.now() + LOCK_MS;
    const isLast = this.index >= this.lines.length - 1;
    if (!(this.holdEnd && isLast)) this.ctc.classList.add('on');
  }

  advance() {
    if (this.destroyed || this.choiceShowing || this.index < 0) return;
    if (this.typing) {
      this._doneTyping(); // 1단계: 타이핑 중 클릭 → 문장 즉시 완성
      return;
    }
    if (performance.now() < this.lockUntil) return; // 연타 방지
    if (this.holdEnd && this.index >= this.lines.length - 1) return;
    this._next(); // 2단계: 완성 상태에서 클릭 → 다음 대사
  }

  _showChoice(line) {
    this.choiceShowing = true;
    this.ctc.classList.remove('on');
    // 재방문(선택지만 표시) 시 빈 대사창은 띄우지 않는다
    if (this.textEl.textContent) this.box.classList.add('on');
    const wrap = this.choiceEl;
    wrap.innerHTML = '';
    if (line.prompt) {
      const p = document.createElement('div');
      p.className = 'choice-prompt';
      p.textContent = line.prompt;
      wrap.appendChild(p);
    }
    (line.options || []).forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice-btn';
      const label = document.createElement('span');
      label.className = 'choice-label';
      label.textContent = opt.label;
      const sub = document.createElement('span');
      sub.className = 'choice-sub';
      sub.textContent = opt.sub || '';
      b.append(label, sub);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onChoice) this.onChoice(opt);
      });
      wrap.appendChild(b);
      if (i === 0) setTimeout(() => b.focus(), 60);
    });
    wrap.classList.add('on');
  }

  // 스탠딩 교체: 미리 렌더된 레이어 간 opacity 크로스페이드 (빈 프레임 없음)
  setSprite(key) {
    if (!this.resolveSprite || key === this.currentSprite) return;
    const target = SPRITE_KEYS.includes(key) ? key : 'normal';
    this.currentSprite = key;
    this.sprImgs.forEach((img) => {
      img.classList.toggle('show', img.dataset.key === target);
    });
  }

  _finish() {
    this.box.classList.remove('on'); // 대사창 퇴장 페이드
    setTimeout(() => {
      if (!this.destroyed && this.onComplete) this.onComplete();
    }, 260);
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    this.root.removeEventListener('click', this._onClick);
    document.removeEventListener('keydown', this._onKey);
  }
}
