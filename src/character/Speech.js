import { MESSAGES, CHATTER, REACTIONS } from './messages.js';

const FREE_STATES = new Set(['idle', 'walk']);
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const resolve = (text, info) => (typeof text === 'function' ? text(info) : text);

const REACTION_RULES = {
  wave: { cooldown: 180 },
  greet: { cooldown: 300, when: (i) => i.awayFor > 120 },
  leave: { cooldown: 600, when: (i) => i.stayedFor > 120 },
};
const BREAK_RESET = 120;

export class Speech {
  constructor({ character, settings, director }) {
    Object.assign(this, { character, settings, director });
    this.sinceWater = 0;
    this.sinceBreak = 0;
    this.seenFor = 0;
    this.awayFor = 0;
    this.nextChat = rand(25, 45);
    this.decks = {};
    this.last = null;
    this.time = 0;
    this.reactedAt = {};
    director?.onReaction((type, info) => this.react(type, info));
  }

  pick(category) {
    const hour = new Date().getHours();
    const pool = (MESSAGES[category] ?? []).filter((m) => !m.when || m.when(hour));
    if (!pool.length) return null;
    let deck = this.decks[category]?.filter((m) => pool.includes(m));
    if (!deck?.length) {
      deck = [...pool].sort(() => Math.random() - 0.5);
      if (deck.length > 1 && deck[0] === this.last) deck.push(deck.shift());
    }
    const m = deck.shift();
    this.decks[category] = deck;
    this.last = m;
    return m;
  }

  #message(category) {
    const m = this.pick(category);
    if (!m) return null;
    const min = Math.max(1, Math.round((category === 'sitting' ? this.seenFor : this.sinceBreak) / 60));
    return { ...m, text: resolve(m.text, { min }) };
  }

  sayNow(category = this.#anyCategory()) {
    const m = this.#message(category);
    if (m && this.character.say(m, true)) this.#said(category);
    return m;
  }

  #anyCategory() {
    const hour = new Date().getHours();
    const reminder = this.#watching ? 'sitting' : 'break';
    const cats = Object.keys(MESSAGES).filter((c) => c === reminder || !['sitting', 'break'].includes(c));
    const weighted = cats.flatMap((c) => {
      const n = MESSAGES[c].filter((m) => !m.when || m.when(hour)).length;
      return Array(n).fill(c);
    });
    let c = pickOne(weighted);
    if (weighted.length > 1 && c === this.lastAny) c = pickOne(weighted);
    return (this.lastAny = c);
  }

  react(type, info = {}) {
    const rule = REACTION_RULES[type];
    const lines = REACTIONS[type];
    if (!this.settings.speechEnabled || !rule || !lines?.length) return;
    if (this.time - (this.reactedAt[type] ?? -Infinity) < rule.cooldown) return;
    if (rule.when && !rule.when(info)) return;
    const line = pickOne(lines);
    const text = resolve(line.text ?? line, { min: Math.max(1, Math.round((info.awayFor ?? 0) / 60)) });
    if (this.character.quip(text, line.expression)) {
      this.reactedAt[type] = this.time;
      this.nextChat = Math.max(this.nextChat, 60);
    }
  }

  #said(category) {
    if (category === 'water') this.sinceWater = 0;
    if (category === 'break' || category === 'sitting') this.sinceBreak = this.seenFor = 0;
    this.nextChat = this.settings.chatInterval * rand(0.7, 1.3);
  }

  get #watching() {
    return this.director?.active && !this.director.blind;
  }

  get canTalk() {
    const c = this.character;
    if (!FREE_STATES.has(c.stateName) || c.bubble.active) return false;
    if (this.director?.active && !this.director.gestures.state.present) return false;
    return true;
  }

  update(dt) {
    this.time += dt;
    const s = this.settings;
    const sleeping = ['sleep', 'sleepy', 'wake', 'boot'].includes(this.character.stateName);
    if (!sleeping) {
      this.sinceWater += dt;
      this.sinceBreak += dt;
      this.nextChat -= dt;
    }
    if (this.#watching) {
      if (this.director.gestures.state.present) {
        this.seenFor += dt;
        this.awayFor = 0;
      } else if ((this.awayFor += dt) > BREAK_RESET) {
        this.seenFor = this.sinceBreak = 0;
      }
    }
    if (!s.speechEnabled || !this.canTalk) return;

    let category = null;
    const breakDue = s.breakEvery > 0 && (this.#watching ? this.seenFor : this.sinceBreak) > s.breakEvery * 60;
    if (s.waterEvery > 0 && this.sinceWater > s.waterEvery * 60) category = 'water';
    else if (breakDue) category = this.#watching ? 'sitting' : 'break';
    else if (this.nextChat <= 0) category = pickOne(CHATTER);
    if (!category) return;

    const m = this.#message(category);
    if (m && this.character.say(m)) this.#said(category);
    else this.nextChat = 5;
  }
}
