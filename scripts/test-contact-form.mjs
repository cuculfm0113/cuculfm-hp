#!/usr/bin/env node
/** Offline form regression tests. Never sends a live Netlify submission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const handler = fs.readFileSync(fileURLToPath(new URL('../contact/form-handler.js', import.meta.url)), 'utf8');
const config = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../content/site.config.json', import.meta.url)), 'utf8')).contact;

function fixture({ reducedMotion = false, resultRegion = true, support = true, trackThrows = false } = {}) {
  let focused = null;
  const byId = new Map();
  class Element {
    constructor(tagName = 'div', id = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.hidden = false;
      this.attributes = {};
      this.listeners = {};
      this.className = '';
      this.innerHTML = '';
      this.textContent = '';
      this.value = '';
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
        remove: name => { this.className = this.className.split(' ').filter(c => c !== name).join(' '); },
      };
      if (id) byId.set(id, this);
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    dispatch(type, event = {}) { return this.listeners[type]?.map(cb => cb({ target: this, ...event }))[0]; }
    focus(options) { focused = this; this.focusOptions = options; }
    scrollIntoView(options) { this.scrollOptions = options; }
  }

  const fields = config.fields.map(f => {
    const el = new Element(['select', 'textarea'].includes(f.type) ? f.type : 'input', f.name);
    Object.assign(el, { name: f.name, type: f.type, required: f.required, checked: true });
    el.value = f.type === 'email' ? 'sample@example.com' : f.type === 'checkbox' ? f.label : 'お問い合わせ & 検証';
    const err = new Element('p', `err-${f.name}`);
    err.hidden = true;
    return el;
  });
  const formName = Object.assign(new Element('input'), { name: 'form-name', type: 'hidden', value: config.formName });
  const honeypot = Object.assign(new Element('input'), { name: config.honeypot, type: 'text', value: '' });
  const form = new Element('form', 'contactForm');
  form.noValidate = false;
  form.setAttribute('action', '/');
  const button = new Element('button');
  button.className = 'btn-submit';
  button.innerHTML = '相談する <span aria-hidden="true">→</span>';
  const originalButton = button.innerHTML;
  const result = new Element('div');
  result.className = 'form-message';
  result.hidden = true;
  form.children = [...fields, ...(resultRegion ? [result] : []), button];
  form.querySelectorAll = () => [formName, honeypot, ...fields];
  form.querySelector = selector => form.children.find(el => el.classList.contains(selector.slice(1))) || null;
  form.insertBefore = (child, target) => {
    const index = target ? form.children.indexOf(target) : form.children.length;
    assert(index >= 0);
    form.children.splice(index, 0, child);
  };
  let resets = 0;
  form.reset = () => {
    resets++;
    fields.forEach(f => { f.value = ''; if (f.type === 'checkbox') f.checked = false; });
  };
  const configElement = new Element('script', 'contact-config');
  configElement.textContent = JSON.stringify({ formName: config.formName, honeypot: config.honeypot, messages: config.errors });
  const document = { readyState: 'complete', getElementById: id => byId.get(id) || null, createElement: tag => new Element(tag) };
  const timers = new Map();
  let timerId = 0;
  const requests = [];
  const window = { dataLayer: [], matchMedia: () => ({ matches: reducedMotion }) };
  if (trackThrows) window.CUCULFM = { track() { throw new Error('Analytics unavailable'); } };
  const mockFetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject });
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  vm.runInNewContext(handler, {
    document, window, AbortController: support ? AbortController : undefined,
    fetch: mockFetch,
    FormData: class {
      constructor(source) { this.fields = source.querySelectorAll(); }
      forEach(callback) {
        this.fields.filter(f => f.type !== 'checkbox' || f.checked).forEach(f => callback(f.value, f.name));
      }
    },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });

  return {
    form, button, fields, byId, requests, timers, originalButton, window,
    get focused() { return focused; },
    get resets() { return resets; },
    get result() { return form.querySelector('.form-message'); },
    submit() {
      let prevented = false;
      const promise = form.dispatch('submit', { preventDefault() { prevented = true; } });
      if (support) assert(prevented);
      return promise;
    },
    events(name) { return window.dataLayer.filter(item => item.event === name); },
    values() { return fields.map(({ name, value, checked }) => ({ name, value, checked })); },
  };
}

const flushFetch = () => Promise.resolve();
function assertIdle(f) {
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.innerHTML, f.originalButton);
  assert.equal(f.form.getAttribute('aria-busy'), null);
  assert.equal(f.timers.size, 0);
}

test('success preserves Netlify fields, announces the result near submit, and resets once', async () => {
  const f = fixture();
  const pending = f.submit();
  assert.equal(f.button.disabled, true);
  assert.equal(f.form.getAttribute('aria-busy'), 'true');
  await flushFetch();
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.url, '/');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const data = new URLSearchParams(request.options.body);
  assert.equal(data.get('form-name'), config.formName);
  assert.equal(data.get(config.honeypot), '');
  for (const field of f.fields) assert.equal(data.get(field.name), field.value);
  request.resolve({ ok: true });
  await pending;
  assert.equal(f.resets, 1);
  assert.equal(f.result.textContent, config.errors.success);
  assert.equal(f.result.getAttribute('role'), 'status');
  assert.equal(f.result.getAttribute('tabindex'), '-1');
  assert.equal(f.focused, f.result);
  assert.equal(f.result.focusOptions.preventScroll, true);
  assert.equal(f.result.scrollOptions.behavior, 'smooth');
  assert.equal(f.form.children.indexOf(f.result), f.form.children.indexOf(f.button) - 1);
  assert.equal(f.events('contact_form_submit').length, 1);
  assert.equal(f.events('contact_form_success').length, 1);
  assert.equal(f.events('contact_form_error').length, 0);
  assertIdle(f);
});

test('Enter or programmatic duplicate submits make one request and one measurement', async () => {
  const f = fixture();
  const pending = f.submit();
  f.submit();
  await flushFetch();
  f.submit();
  assert.equal(f.requests.length, 1);
  assert.equal(f.events('contact_form_submit').length, 1);
  f.requests[0].resolve({ ok: true });
  await pending;
  assert.equal(f.resets, 1);
  assert.equal(f.events('contact_form_success').length, 1);
  assertIdle(f);
});

test('HTTP rejection keeps input and consent intact, then allows an explicit retry', async () => {
  const f = fixture();
  const before = f.values();
  const pending = f.submit();
  await flushFetch();
  f.requests[0].resolve({ ok: false, status: 503 });
  await pending;
  assert.deepEqual(f.values(), before);
  assert.equal(f.resets, 0);
  assert.equal(f.result.textContent, config.errors.failure);
  assert.equal(f.result.getAttribute('role'), 'alert');
  assert.equal(f.focused, f.result);
  assert.equal(f.events('contact_form_error')[0].error_message, 'HTTP 503');
  assertIdle(f);
  const retry = f.submit();
  assert.equal(f.result.hidden, true);
  await flushFetch();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ ok: true });
  await retry;
  assert.equal(f.events('contact_form_success').length, 1);
});

test('network failure keeps input and never retries automatically', async () => {
  const f = fixture();
  const before = f.values();
  const pending = f.submit();
  await flushFetch();
  f.requests[0].reject(new TypeError('Failed to fetch'));
  await pending;
  assert.deepEqual(f.values(), before);
  assert.equal(f.requests.length, 1);
  assert.equal(f.events('contact_form_error').length, 1);
  assert.equal(f.events('contact_form_success').length, 0);
  assertIdle(f);
});

test('a stalled request aborts at 20 seconds, retains input, and permits manual retry', async () => {
  const f = fixture();
  const before = f.values();
  const pending = f.submit();
  await flushFetch();
  const timer = [...f.timers.values()][0];
  assert.equal(timer.delay, 20000);
  timer.callback();
  await pending;
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.deepEqual(f.values(), before);
  assert.equal(f.requests.length, 1);
  assert.equal(f.result.textContent, config.errors.failure);
  assert.match(f.events('contact_form_error')[0].error_message, /timed out/);
  assertIdle(f);
  const retry = f.submit();
  await flushFetch();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].options.signal.aborted, false);
  f.requests[1].resolve({ ok: true });
  await retry;
});

test('required text, invalid email and unchecked consent prevent submission and focus first error', async () => {
  const f = fixture({ reducedMotion: true });
  const name = f.byId.get('name');
  const email = f.byId.get('email');
  const privacy = f.byId.get('privacy');
  name.value = '  ';
  email.value = 'invalid-email';
  privacy.checked = false;
  f.submit();
  await flushFetch();
  assert.equal(f.requests.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.events('contact_form_submit').length, 0);
  assert.equal(f.focused, name);
  assert.equal(name.scrollOptions.behavior, 'instant');
  for (const field of [name, email, privacy]) assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(f.byId.get('err-name').textContent, config.errors.required);
  assert.equal(f.byId.get('err-email').textContent, config.errors.email);
  assert.equal(f.byId.get('err-privacy').textContent, config.errors.requiredCheck);
  name.value = '山田 太郎';
  name.dispatch('input');
  assert.equal(name.getAttribute('aria-invalid'), null);
  assert.equal(f.byId.get('err-name').hidden, true);
  privacy.checked = true;
  privacy.dispatch('change');
  assert.equal(f.byId.get('err-privacy').hidden, true);
});

test('empty optional fields are accepted and reduced motion applies to the result', async () => {
  const f = fixture({ reducedMotion: true, resultRegion: false });
  f.fields.filter(field => !field.required).forEach(field => { field.value = ''; });
  const pending = f.submit();
  await flushFetch();
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({ ok: true });
  await pending;
  assert.equal(f.result.scrollOptions.behavior, 'instant');
  assert.equal(f.form.children.indexOf(f.result), f.form.children.indexOf(f.button) - 1);
  assert.equal(f.focused, f.result);
  assertIdle(f);
});

test('analytics failures do not block a successful form submission', async () => {
  const f = fixture({ trackThrows: true });
  const pending = f.submit();
  await flushFetch();
  f.requests[0].resolve({ ok: true });
  await pending;
  assert.equal(f.resets, 1);
  assert.equal(f.result.textContent, config.errors.success);
  assertIdle(f);
});

test('browsers without AbortController retain native validation and form POST', () => {
  const f = fixture({ support: false });
  assert.equal(f.form.noValidate, false);
  assert.equal(f.form.listeners.submit, undefined);
  assert.equal(f.requests.length, 0);
});
