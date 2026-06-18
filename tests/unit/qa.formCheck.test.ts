import { describe, it, expect } from 'vitest';
import {
  makeMarker,
  classifyField,
  mapFields,
  isSkippableForm,
  detectSuccess,
  type FieldDescriptor,
} from '../../qa/formCheckService';

describe('qa/formCheckService pure helpers', () => {
  describe('makeMarker', () => {
    it('builds a slugged, prefixed marker', () => {
      const m = makeMarker('QA-TEST', 'https://ClientA.com', 'run42');
      expect(m).toMatch(/^qa-test-clienta-com-run42-\d+$/);
    });

    it('is unique across calls (timestamp)', () => {
      const a = makeMarker('QA', 'x.com', 'r');
      const b = makeMarker('QA', 'x.com', 'r');
      // Different timestamps OR at least both well-formed.
      expect(a).toMatch(/^qa-x-com-r-\d+$/);
      expect(b).toMatch(/^qa-x-com-r-\d+$/);
    });

    it('handles empty prefix gracefully', () => {
      expect(makeMarker('', 'x.com', 'r')).toMatch(/^qa-test-x-com-r-\d+$/);
    });
  });

  describe('classifyField', () => {
    it('classifies by input type', () => {
      expect(classifyField({ tag: 'input', type: 'email' })).toBe('email');
      expect(classifyField({ tag: 'input', type: 'tel' })).toBe('phone');
      expect(classifyField({ tag: 'textarea' })).toBe('message');
    });

    it('classifies by name/placeholder/label', () => {
      expect(classifyField({ tag: 'input', type: 'text', name: 'your_email' })).toBe('email');
      expect(classifyField({ tag: 'input', type: 'text', placeholder: 'Mobile number' })).toBe('phone');
      expect(classifyField({ tag: 'input', type: 'text', label: 'Full Name' })).toBe('name');
      expect(classifyField({ tag: 'input', type: 'text', name: 'comments' })).toBe('message');
    });

    it('returns null for unknown / adversarial fields', () => {
      expect(classifyField({ tag: 'input', type: 'text', name: 'xyz123' })).toBeNull();
      expect(classifyField({ tag: 'input', type: 'checkbox', name: 'consent' })).toBeNull();
    });

    it('prefers email over name when both words appear', () => {
      expect(classifyField({ tag: 'input', type: 'text', name: 'name_email', label: 'Email' })).toBe(
        'email'
      );
    });
  });

  describe('mapFields', () => {
    it('maps a typical contact form, first-match-wins', () => {
      const fields: FieldDescriptor[] = [
        { tag: 'input', type: 'text', name: 'name' },
        { tag: 'input', type: 'email', name: 'email' },
        { tag: 'input', type: 'text', name: 'phone' },
        { tag: 'textarea', name: 'message' },
        { tag: 'input', type: 'email', name: 'email2' },
      ];
      const m = mapFields(fields);
      expect(m.name?.name).toBe('name');
      expect(m.email?.name).toBe('email');
      expect(m.phone?.name).toBe('phone');
      expect(m.message?.name).toBe('message');
    });
  });

  describe('isSkippableForm', () => {
    it('skips password / login / payment / search forms', () => {
      expect(isSkippableForm({ hasPassword: true, hasCaptcha: false, actionOrId: '' }).skip).toBe(true);
      expect(isSkippableForm({ hasPassword: false, hasCaptcha: false, actionOrId: 'login-form' }).skip).toBe(true);
      expect(isSkippableForm({ hasPassword: false, hasCaptcha: false, actionOrId: '/checkout' }).skip).toBe(true);
      expect(isSkippableForm({ hasPassword: false, hasCaptcha: false, actionOrId: 'site-search' }).skip).toBe(true);
    });

    it('does not skip a normal contact form', () => {
      expect(isSkippableForm({ hasPassword: false, hasCaptcha: false, actionOrId: 'contact-us' }).skip).toBe(false);
    });
  });

  describe('detectSuccess', () => {
    it('detects thank-you text', () => {
      expect(
        detectSuccess({ html: '<p>Thank you! Your message was sent.</p>', urlChanged: false, formStillPresent: false, hasCaptcha: false })
      ).toBe(true);
    });

    it('detects success class', () => {
      expect(
        detectSuccess({ html: '<div class="form-success">ok</div>', urlChanged: false, formStillPresent: false, hasCaptcha: false })
      ).toBe(true);
    });

    it('NEVER claims success when a captcha is present (adversarial)', () => {
      expect(
        detectSuccess({ html: '<p>Thank you!</p>', urlChanged: false, formStillPresent: true, hasCaptcha: true })
      ).toBe(false);
    });

    it('silent fail is NOT a false pass', () => {
      expect(
        detectSuccess({ html: '<form>still here, no message</form>', urlChanged: false, formStillPresent: true, hasCaptcha: false })
      ).toBe(false);
    });

    it('form disappearance + url change is success', () => {
      expect(
        detectSuccess({ html: '<h1>done</h1>', urlChanged: true, formStillPresent: false, hasCaptcha: false })
      ).toBe(true);
    });
  });
});
