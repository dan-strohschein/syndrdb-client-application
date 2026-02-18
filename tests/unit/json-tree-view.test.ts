/**
 * Unit tests for JSON Tree View component.
 * Valid JSON string is parsed and rendered; invalid JSON shows error state.
 * Primitives and object/array roots render; expand/collapse and defaultExpandedDepth.
 */

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../Lit/src/components/json-tree-view/json-tree-view';

describe('JsonTreeView', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('json-tree-view');
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });

  async function waitForUpdate(): Promise<void> {
    const litEl = el as unknown as { updateComplete: Promise<void> };
    await litEl.updateComplete;
  }

  describe('data parsing', () => {
    it('should render "No data" when data is unset', async () => {
      await waitForUpdate();
      expect(el.textContent).toContain('No data');
    });

    it('should parse valid JSON string and render tree', async () => {
      (el as unknown as { data: unknown }).data = '{"a": 1}';
      await waitForUpdate();
      expect(el.textContent).toContain('(root)');
      expect(el.textContent).toContain('a');
      expect(el.textContent).toContain('1');
    });

    it('should show error state for invalid JSON string', async () => {
      (el as unknown as { data: unknown }).data = 'not json';
      await waitForUpdate();
      expect(el.textContent).toMatch(/Invalid JSON/i);
    });

    it('should accept object directly without parsing', async () => {
      (el as unknown as { data: unknown }).data = { x: 42 };
      await waitForUpdate();
      expect(el.textContent).toContain('x');
      expect(el.textContent).toContain('42');
    });
  });

  describe('primitive roots', () => {
    it('should render string root as single value', async () => {
      (el as unknown as { data: unknown }).data = '"hello"';
      await waitForUpdate();
      expect(el.textContent).toContain('hello');
    });

    it('should render number root', async () => {
      (el as unknown as { data: unknown }).data = '42';
      await waitForUpdate();
      expect(el.textContent).toContain('42');
    });

    it('should render boolean root', async () => {
      (el as unknown as { data: unknown }).data = 'true';
      await waitForUpdate();
      expect(el.textContent).toContain('true');
    });

    it('should render null root', async () => {
      (el as unknown as { data: unknown }).data = 'null';
      await waitForUpdate();
      expect(el.textContent).toContain('null');
    });
  });

  describe('object and array roots', () => {
    it('should render object with children', async () => {
      (el as unknown as { data: unknown }).data = {
        users: [{ name: 'a', count: 1 }],
        meta: {}
      };
      await waitForUpdate();
      expect(el.textContent).toContain('users');
      expect(el.textContent).toContain('meta');
    });

    it('should render array with indices', async () => {
      (el as unknown as { data: unknown }).data = [10, 20];
      await waitForUpdate();
      expect(el.textContent).toContain('0');
      expect(el.textContent).toContain('1');
      expect(el.textContent).toContain('10');
      expect(el.textContent).toContain('20');
    });
  });

  describe('defaultExpandedDepth', () => {
    it('should expand root and one level when defaultExpandedDepth is 1', async () => {
      const tree = el as unknown as { data: unknown; defaultExpandedDepth: number };
      tree.data = { a: { b: 1 } };
      tree.defaultExpandedDepth = 1;
      await waitForUpdate();
      expect(el.textContent).toContain('a');
      expect(el.querySelector('[aria-expanded="true"]')).toBeTruthy();
    });

    it('should show collapsed when defaultExpandedDepth is 0', async () => {
      const tree = el as unknown as { data: unknown; defaultExpandedDepth: number };
      tree.data = { a: 1 };
      tree.defaultExpandedDepth = 0;
      await waitForUpdate();
      expect(el.textContent).toContain('(root)');
    });
  });

  describe('expand/collapse', () => {
    it('should toggle expansion on branch click', async () => {
      const tree = el as unknown as { data: unknown; defaultExpandedDepth: number };
      tree.data = { key: 'value' };
      tree.defaultExpandedDepth = 1;
      await waitForUpdate();
      const branch = el.querySelector('[role="treeitem"][aria-expanded]') as HTMLElement;
      expect(branch).toBeTruthy();
      const expandedBefore = branch.getAttribute('aria-expanded');
      branch.click();
      await waitForUpdate();
      const expandedAfter = branch.getAttribute('aria-expanded');
      expect(expandedAfter).not.toBe(expandedBefore);
    });
  });
});
