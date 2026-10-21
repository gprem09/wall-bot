import * as THREE from 'three';
import { PoseTracker } from '../vision/PoseTracker.js';
import { toast } from '../debug/toast.js';

const SLEEPING = new Set(['sleep', 'sleepy']);
const SAD_DELAY = 1.5;
const GREET_AFTER = 3;
const EXCITED_AFTER = 10;
const FOLLOW_CONFIRM = 0.6;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class InteractionDirector {
  constructor({ character, tracker, gestures, settings, wall }) {
    this.character = character;
    this.tracker = tracker;
    this.gestures = gestures;
    this.settings = settings;
    this.wall = wall;
    this.absentFor = 0;
    this.sentToSleep = false;
    this.sadPending = false;
    this.lastSeen = -Infinity;
    this.farFor = 0;
    this.time = 0;
    this.attention = new THREE.Vector3();
    this.attentionTarget = new THREE.Vector3();
    this.hasAttention = false;
    this.presentSince = null;
    this.reactionListeners = new Set();

    tracker.onResult((landmarks, t) => gestures.update(landmarks, t, tracker.aspect));
  }

  onReaction(fn) {
    this.reactionListeners.add(fn);
  }

  #react(type, info = {}) {
    for (const fn of this.reactionListeners) fn(type, info);
  }

  get active() {
    return this.tracker.running;
  }

  get blind() {
    return this.active && this.tracker.blind;
  }

  async setEnabled(on) {
    this.settings.trackingEnabled = on;
    if (on) {
      this.absentFor = 0;
      this.sentToSleep = false;
      this.sadPending = false;
      this.lastSeen = -Infinity;
      this.tracker.lowLightBoost = this.settings.lowLightBoost;
      toast('Starting camera…');
      try {
        await this.tracker.start(this.settings.cameraDeviceId, this.settings.poseModel);
        toast(`Camera on · ${this.tracker.modelName} model · press T to turn off`);
      } catch (err) {
        this.settings.trackingEnabled = false;
        toast(`Camera didn't start: ${PoseTracker.explain(err)}`, 9000);
        throw err;
      }
    } else {
      this.tracker.stop();
      toast('Camera off');
    }
  }

  update(dt) {
    this.time += dt;
    const c = this.character;
    if (!this.active) {
      c.attention = null;
      c.socialMode = false;
      c.allowAutoWake = true;
      this.hasAttention = false;
      return;
    }
    c.allowAutoWake = false;
    this.tracker.lowLightBoost = this.settings.lowLightBoost;
    this.gestures.blind = this.tracker.blind;

    for (const ev of this.gestures.consumeEvents()) this.#handle(ev);

    if (this.blind) {
      c.attention = null;
      c.socialMode = false;
      this.hasAttention = false;
      this.farFor = 0;
      return;
    }

    const g = this.gestures.state;
    if (!g.present) {
      c.attention = null;
      c.socialMode = false;
      this.hasAttention = false;
      this.absentFor += dt;
      if (this.sadPending && this.absentFor > SAD_DELAY) {
        this.sadPending = false;
        if (!SLEEPING.has(c.stateName) && c.trigger('sad')) this.#react('leave', { stayedFor: this.stayedFor });
      }
      if (!this.sentToSleep && this.absentFor > this.settings.absenceTimeout) {
        this.sentToSleep = true;
        if (!SLEEPING.has(c.stateName)) c.trigger('sleepy', {}, true);
      }
      return;
    }

    this.absentFor = 0;
    this.sentToSleep = false;
    this.sadPending = false;
    this.lastSeen = this.time;
    c.socialMode = true;

    const { scale, floorY, minX, maxX } = c.placement;
    const personX = this.wall.boundsToWorldX(g.bodyU);
    if (g.hand) {
      const handX = this.wall.boundsToWorldX(g.hand.u);
      const handY = floorY + scale * (2.2 + (g.hand.v - g.headV) * 5);
      this.attentionTarget.set(handX, handY, 3.5);
    } else {
      this.attentionTarget.set(personX, floorY + scale * 2.6, 5);
    }
    if (!this.hasAttention) this.attention.copy(this.attentionTarget);
    else this.attention.lerp(this.attentionTarget, 1 - Math.exp(-6 * dt));
    this.hasAttention = true;
    c.attention = this.attention;

    const target = clamp(personX, minX, maxX);
    const state = c.stateName;
    if (state === 'walk' && c.fsm.params.follow) {
      c.loco.walkTo(target);
      return;
    }
    const deadzone = this.settings.followDeadzone * (maxX - minX);
    const far = Math.abs(target - c.loco.x) > deadzone && !g.hand;
    this.farFor = far ? this.farFor + dt : 0;
    if (state === 'idle' && this.farFor > FOLLOW_CONFIRM) {
      c.trigger('walk', { x: target, follow: true, mood: 'happy' });
      this.farFor = 0;
    }
  }

  #handle(ev) {
    const c = this.character;
    const asleep = SLEEPING.has(c.stateName);
    switch (ev.type) {
      case 'enter': {
        const goneFor = this.time - this.lastSeen;
        this.sadPending = false;
        this.presentSince = this.time;
        if (asleep) c.trigger('surprised', { then: 'excited' }, true);
        else if (goneFor > EXCITED_AFTER) c.trigger('excited', {}, true);
        else if (goneFor > GREET_AFTER) c.trigger('happy');
        if (Number.isFinite(goneFor)) this.#react('greet', { awayFor: goneFor });
        break;
      }
      case 'leave':
        this.stayedFor = this.presentSince === null ? 0 : this.time - this.presentSince;
        this.presentSince = null;
        if (!asleep) this.sadPending = true;
        break;
      case 'wave':
        if (c.stateName === 'wave' || c.stateName === 'happy') break;
        if (asleep) c.trigger('surprised', { then: { name: 'wave', params: { then: 'happy' } } }, true);
        else c.trigger('wave', { then: 'happy' }, true);
        this.#react('wave');
        break;
    }
  }
}
