// @vitest-environment jsdom
//
// Phase 0.5 — minimal component test for the mobile ▲/▼ reorder controls
// added in Phase 0 (analysis_v1.md §4.10-1: HTML5 Drag&Drop doesn't fire on
// touch devices). Deliberately narrow: only the reorder Flow, not OCR/extract
// (which needs network + Anthropic mocking) or drag-and-drop (desktop-only,
// pre-existing, untouched).
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import ScreenshotImportPanel from './ScreenshotImportPanel.jsx'

function makeFile(name) {
  return new File(['fake-image-bytes'], name, { type: 'image/png' })
}

beforeEach(() => {
  // jsdom doesn't implement the Blob URL APIs the component uses for
  // thumbnails; stub them deterministically so each file's <img src> is
  // distinguishable by name.
  global.URL.createObjectURL = vi.fn((file) => `blob:${file.name}`)
  global.URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
})

function orderedSrcs(container) {
  return Array.from(container.querySelectorAll('li img')).map((img) => img.getAttribute('src'))
}

function addThreeFiles(container) {
  const fileInput = container.querySelector('input[type="file"]')
  fireEvent.change(fileInput, {
    target: { files: [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')] },
  })
}

describe('ScreenshotImportPanel — mobile ▲/▼ reorder', () => {
  test('▼ moves an item one position later, then ▲ moves it back', () => {
    const { container } = render(<ScreenshotImportPanel onTextLoaded={() => {}} />)
    addThreeFiles(container)
    expect(orderedSrcs(container)).toEqual(['blob:a.png', 'blob:b.png', 'blob:c.png'])

    fireEvent.click(screen.getAllByLabelText('뒤로 이동')[0]) // move a.png down
    expect(orderedSrcs(container)).toEqual(['blob:b.png', 'blob:a.png', 'blob:c.png'])

    fireEvent.click(screen.getAllByLabelText('앞으로 이동')[1]) // a.png is now at index 1
    expect(orderedSrcs(container)).toEqual(['blob:a.png', 'blob:b.png', 'blob:c.png'])
  })

  test('the first item cannot move up and the last item cannot move down', () => {
    const { container } = render(<ScreenshotImportPanel onTextLoaded={() => {}} />)
    addThreeFiles(container)

    const upButtons = screen.getAllByLabelText('앞으로 이동')
    const downButtons = screen.getAllByLabelText('뒤로 이동')

    expect(upButtons[0].disabled).toBe(true)
    expect(downButtons[downButtons.length - 1].disabled).toBe(true)
    // Every non-boundary button stays enabled.
    expect(upButtons[1].disabled).toBe(false)
    expect(downButtons[0].disabled).toBe(false)
  })

  test('clicking a disabled boundary button does not change the order', () => {
    const { container } = render(<ScreenshotImportPanel onTextLoaded={() => {}} />)
    addThreeFiles(container)
    const before = orderedSrcs(container)

    fireEvent.click(screen.getAllByLabelText('앞으로 이동')[0]) // first item, ▲ disabled
    fireEvent.click(screen.getAllByLabelText('뒤로 이동')[2]) // last item, ▼ disabled

    expect(orderedSrcs(container)).toEqual(before)
  })

  test('reordering invalidates a previously extracted result (textReady resets)', () => {
    const onTextLoaded = vi.fn()
    const { container } = render(
      <ScreenshotImportPanel onTextLoaded={onTextLoaded} textReady={true} />,
    )
    addThreeFiles(container)
    onTextLoaded.mockClear()

    fireEvent.click(screen.getAllByLabelText('뒤로 이동')[0])
    expect(onTextLoaded).toHaveBeenCalledWith('')
  })
})
