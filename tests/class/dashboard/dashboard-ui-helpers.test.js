import { describe, expect, it } from 'vitest';
import { getStatusLineActions } from '../../../src/class/Dashboard/StatusLine.js';
import { clampPaletteIndex, filterPaletteCommands } from '../../../src/class/Dashboard/CommandPalette.js';
import {
    buildDashboardToast,
    getDashboardUpdateCount,
    getDashboardUpdateTitle,
    hasRenderableToast
} from '../../../src/class/Dashboard/ToastStrip.js';

describe('dashboard UI helpers', () => {
    it('filters command palette commands by label, hint, and keywords', () => {
        const commands = [
            { id: 'refresh', label: 'Refresh', hint: 'R', keywords: 'reload update' },
            { id: 'settings', label: 'Settings', hint: 'S', keywords: 'config preferences' },
            { id: 'focus-breaking', label: 'Focus Breaking', hint: '1', keywords: 'panel breaking' }
        ];

        expect(filterPaletteCommands(commands, 'reload')).toEqual([commands[0]]);
        expect(filterPaletteCommands(commands, 'config')).toEqual([commands[1]]);
        expect(filterPaletteCommands(commands, 'panel breaking')).toEqual([commands[2]]);
    });

    it('wraps command palette selection indexes', () => {
        expect(clampPaletteIndex(-1, 3)).toBe(2);
        expect(clampPaletteIndex(3, 3)).toBe(0);
        expect(clampPaletteIndex(1, 3)).toBe(1);
        expect(clampPaletteIndex(1, 0)).toBe(0);
    });

    it('exposes the expected dashboard status line actions', () => {
        const actions = getStatusLineActions();

        expect(actions.map(action => action.shortcut)).toEqual(['/', 'Enter', 'R', 'T', 'S', 'Q']);
        expect(actions.map(action => action.key)).toContain('palette');
    });

    it('builds update toasts from dashboard results', () => {
        const toast = buildDashboardToast(
            'breaking',
            { data: [{ displayTitle: '**BTC breaks higher**' }] },
            () => 'Breaking',
            1234
        );

        expect(toast).toMatchObject({
            id: 'breaking-1234',
            level: 'success',
            panelLabel: 'Breaking',
            count: 1,
            latestTitle: 'BTC breaks higher'
        });
    });

    it('ignores stale or empty update toasts and extracts nested data details', () => {
        expect(buildDashboardToast('breaking', { data: [], stale: true })).toBeNull();
        expect(buildDashboardToast('breaking', { data: [] })).toBeNull();
        expect(getDashboardUpdateCount({ data: [{ title: 'A' }, { title: 'B' }] })).toBe(2);
        expect(getDashboardUpdateTitle({ items: [{ signals: [{ title: 'Signal title' }] }] })).toBe('Signal title');
    });

    it('requires toast content before rendering a notification strip', () => {
        expect(hasRenderableToast(null)).toBe(false);
        expect(hasRenderableToast({ message: '', latestTitle: '' })).toBe(false);
        expect(hasRenderableToast({ message: 'Breaking updated', latestTitle: '' })).toBe(true);
        expect(hasRenderableToast({ message: '', latestTitle: 'BTC headline' })).toBe(true);
    });
});
