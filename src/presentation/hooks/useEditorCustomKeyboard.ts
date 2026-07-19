import { useCallback, useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import type { KeyboardMode } from '../components/CustomKeyboard';

export type EditorKeyboardField = 'songName' | 'segmentMeter';

type ActiveFieldState = {
  field: EditorKeyboardField;
  value: string;
  initialMode: KeyboardMode;
};

/**
 * Shared focus/value state for Song Editor fields that use CustomKeyboard.
 * Tracks the active TextInput ref so Done can blur and clear selection.
 */
export function useEditorCustomKeyboard() {
  const [active, setActive] = useState<ActiveFieldState | null>(null);
  const activeRef = useRef<ActiveFieldState | null>(null);
  const inputRefs = useRef<Partial<Record<EditorKeyboardField, TextInput | null>>>({});

  activeRef.current = active;

  const registerInput = useCallback((field: EditorKeyboardField, ref: TextInput | null) => {
    inputRefs.current[field] = ref;
  }, []);

  const focusField = useCallback(
    (field: EditorKeyboardField, value: string, initialMode: KeyboardMode) => {
      const previous = activeRef.current?.field;
      if (previous !== undefined && previous !== field) {
        inputRefs.current[previous]?.blur();
      }
      setActive({ field, value, initialMode });
    },
    [],
  );

  const setValue = useCallback((value: string) => {
    setActive((current) => (current === null ? current : { ...current, value }));
  }, []);

  const dismiss = useCallback(() => {
    const field = activeRef.current?.field;
    setActive(null);
    if (field !== undefined) {
      // Blur after clearing active so the next tap fires onFocus again.
      requestAnimationFrame(() => {
        inputRefs.current[field]?.blur();
      });
    }
  }, []);

  return {
    activeField: active?.field ?? null,
    value: active?.value ?? '',
    initialMode: active?.initialMode ?? 'letters',
    visible: active !== null,
    focusField,
    setValue,
    dismiss,
    registerInput,
  };
}
